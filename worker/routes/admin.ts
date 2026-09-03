import { and, asc, count, desc, eq, like, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AdminCustomerListPayload } from "@shared/api";
import { COFFEE_CURRENCY_CODE } from "@shared/domain";
import type { AdjustmentResultPayload } from "@shared/loyalty";
import type {
	AdminMenuCategoriesPayload,
	AdminMenuCategory,
	AdminMenuItem,
	AdminMenuItemsPayload,
	MenuImageDeletePayload,
	MenuImageUploadPayload,
} from "@shared/menu";
import { getDb } from "@worker/db/client";
import {
	loyaltyPrograms,
	menuCategories,
	menuItems,
	profiles,
	promotions,
} from "@worker/db/schema";
import { ApiError, ok } from "@worker/lib/http";
import { createLoyaltyAdjustment, getCoffeeProgress } from "@worker/lib/loyalty";
import {
	assertOwnedMenuMediaKey,
	deleteMenuImageSafe,
	putMenuImage,
} from "@worker/lib/media";
import { requireLocationInBusiness } from "@worker/lib/scope";
import { requireAdminOrOwner, requireSession } from "@worker/middleware/auth";
import { validate } from "@worker/middleware/validate";
import type { AppEnv } from "@worker/types";

const listQuerySchema = z.object({
	search: z.string().trim().max(80).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(25),
	offset: z.coerce.number().int().min(0).default(0),
});

const createAdjustmentSchema = z.object({
	programId: z.string().min(1).max(64),
	locationId: z.string().min(1).max(64),
	transactionType: z.enum(["adjustment", "reversal"]),
	quantity: z.coerce
		.number()
		.int()
		.refine((value) => value !== 0 && Math.abs(value) <= 1000, {
			message: "Enter a non-zero quantity of at most 1000.",
		}),
	reason: z
		.string()
		.trim()
		.min(5, "Explain why you're making this adjustment.")
		.max(500),
	billReference: z.string().trim().max(120).nullable().optional(),
	// Client-generated per confirmed action, so a retried tap never double-adjusts.
	idempotencyKey: z.string().trim().min(8).max(128),
});

const createCategorySchema = z.object({
	name: z.string().trim().min(2).max(80),
	description: z.string().trim().max(280).nullable().optional(),
	imageKey: z.string().trim().max(300).nullable().optional(),
	sortOrder: z.number().int().min(0).max(10_000).default(0),
	active: z.boolean().default(true),
});

const updateCategorySchema = createCategorySchema
	.partial()
	.refine((input) => Object.keys(input).length > 0, {
		message: "At least one field must be provided.",
	});

const listItemsQuerySchema = z.object({
	categoryId: z.string().trim().max(64).optional(),
});

const createItemSchema = z.object({
	categoryId: z.string().trim().min(1).max(64),
	name: z.string().trim().min(2).max(120),
	description: z.string().trim().max(500).default(""),
	priceCents: z.number().int().min(0).max(1_000_000),
	imageKey: z.string().trim().max(300).nullable().optional(),
	active: z.boolean().default(true),
	available: z.boolean().default(true),
	popular: z.boolean().default(false),
	vegetarian: z.boolean().default(false),
	spicy: z.boolean().default(false),
	sortOrder: z.number().int().min(0).max(10_000).default(0),
});

const updateItemSchema = createItemSchema
	.omit({ categoryId: true })
	.extend({ categoryId: z.string().trim().min(1).max(64).optional() })
	.partial()
	.refine((input) => Object.keys(input).length > 0, {
		message: "At least one field must be provided.",
	});

const deleteMediaSchema = z.object({
	imageKey: z.string().trim().min(1).max(300),
});

function toAdminCategory(
	row: typeof menuCategories.$inferSelect,
): AdminMenuCategory {
	return {
		id: row.id,
		businessId: row.businessId,
		name: row.name,
		description: row.description,
		imageKey: row.imageKey,
		sortOrder: row.sortOrder,
		active: row.active,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function toAdminItem(row: typeof menuItems.$inferSelect): AdminMenuItem {
	return {
		id: row.id,
		businessId: row.businessId,
		categoryId: row.categoryId,
		name: row.name,
		description: row.description,
		priceCents: row.priceCents,
		imageKey: row.imageKey,
		active: row.active,
		available: row.available,
		popular: row.popular,
		vegetarian: row.vegetarian,
		spicy: row.spicy,
		sortOrder: row.sortOrder,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function rethrowAsConflict(error: unknown, message: string): never {
	if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
		throw new ApiError("conflict", message);
	}
	throw error;
}

export const admin = new Hono<AppEnv>()
	.use("*", requireSession, requireAdminOrOwner)

	.get("/customers", validate("query", listQuerySchema), async (c) => {
		const { businessId } = c.get("profile");
		const { search, limit, offset } = c.req.valid("query");
		const db = getDb(c.env);

		// Business scope is part of the predicate, not a filter applied afterwards,
		// so no query path can return another business's customers.
		const where = and(
			eq(profiles.businessId, businessId),
			eq(profiles.role, "customer"),
			search
				? or(
						like(profiles.fullName, `%${search}%`),
						like(profiles.email, `%${search}%`),
						like(profiles.mobileNumber, `%${search}%`),
					)
				: undefined,
		);

		const [rows, [totals]] = await Promise.all([
			db
				.select({
					id: profiles.id,
					fullName: profiles.fullName,
					email: profiles.email,
					mobileNumber: profiles.mobileNumber,
					active: profiles.active,
					createdAt: profiles.createdAt,
				})
				.from(profiles)
				.where(where)
				.orderBy(desc(profiles.createdAt))
				.limit(limit)
				.offset(offset),
			db.select({ value: count() }).from(profiles).where(where),
		]);

		return ok<AdminCustomerListPayload>(c, {
			customers: rows.map((row) => ({
				...row,
				createdAt: row.createdAt.toISOString(),
			})),
			total: totals?.value ?? 0,
			limit,
			offset,
		});
	})

	.post(
		"/customers/:customerId/adjustments",
		validate("json", createAdjustmentSchema),
		async (c) => {
			const admin = c.get("profile");
			const db = getDb(c.env);
			const customerId = c.req.param("customerId");
			const input = c.req.valid("json");

			const customer = await db.query.profiles.findFirst({
				where: and(
					eq(profiles.id, customerId),
					eq(profiles.businessId, admin.businessId),
					eq(profiles.role, "customer"),
				),
			});
			if (!customer) {
				throw new ApiError("not_found", "That customer was not found.");
			}

			const program = await db.query.loyaltyPrograms.findFirst({
				where: and(
					eq(loyaltyPrograms.id, input.programId),
					eq(loyaltyPrograms.businessId, admin.businessId),
				),
			});
			if (!program) {
				throw new ApiError("not_found", "That loyalty program was not found.");
			}

			await requireLocationInBusiness(db, admin.businessId, input.locationId);

			const { transactionId } = await createLoyaltyAdjustment(db, {
				businessId: admin.businessId,
				customerId: customer.id,
				programId: program.id,
				locationId: input.locationId,
				staffId: admin.id,
				actorUserId: admin.authUserId,
				actorRole: admin.role,
				transactionType: input.transactionType,
				quantity: input.quantity,
				reason: input.reason,
				billReference: input.billReference ?? null,
				idempotencyKey: input.idempotencyKey,
			});

			const coffee =
				program.currencyCode === COFFEE_CURRENCY_CODE
					? await getCoffeeProgress(db, admin.businessId, customer.id)
					: null;

			return ok<AdjustmentResultPayload>(c, { transactionId, coffee });
		},
	)

	.get("/menu/categories", async (c) => {
		const { businessId } = c.get("profile");
		const rows = await getDb(c.env)
			.select()
			.from(menuCategories)
			.where(eq(menuCategories.businessId, businessId))
			.orderBy(asc(menuCategories.sortOrder), asc(menuCategories.name));

		return ok<AdminMenuCategoriesPayload>(c, {
			categories: rows.map(toAdminCategory),
		});
	})

	.post("/menu/categories", validate("json", createCategorySchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const input = c.req.valid("json");

		if (input.imageKey) {
			assertOwnedMenuMediaKey(profile.businessId, input.imageKey);
		}

		try {
			const [created] = await db
				.insert(menuCategories)
				.values({
					businessId: profile.businessId,
					name: input.name,
					description: input.description ?? null,
					imageKey: input.imageKey ?? null,
					sortOrder: input.sortOrder,
					active: input.active,
				})
				.returning();

			if (!created) {
				throw new ApiError("internal_error", "Failed to create menu category.");
			}

			return ok<AdminMenuCategory>(c, toAdminCategory(created), 201);
		} catch (error) {
			rethrowAsConflict(error, "A category with that name already exists.");
		}
	})

	.patch(
		"/menu/categories/:categoryId",
		validate("json", updateCategorySchema),
		async (c) => {
			const profile = c.get("profile");
			const db = getDb(c.env);
			const categoryId = c.req.param("categoryId");
			const input = c.req.valid("json");

			const existing = await db.query.menuCategories.findFirst({
				where: and(
					eq(menuCategories.id, categoryId),
					eq(menuCategories.businessId, profile.businessId),
				),
			});
			if (!existing) {
				throw new ApiError("not_found", "That menu category was not found.");
			}

			if (input.imageKey) {
				assertOwnedMenuMediaKey(profile.businessId, input.imageKey);
			}

			try {
				const [updated] = await db
					.update(menuCategories)
					.set({
						name: input.name,
						description: input.description,
						imageKey: input.imageKey,
						sortOrder: input.sortOrder,
						active: input.active,
					})
					.where(eq(menuCategories.id, existing.id))
					.returning();

				if (!updated) {
					throw new ApiError("internal_error", "Failed to update menu category.");
				}

				if (
					input.imageKey !== undefined &&
					existing.imageKey &&
					existing.imageKey !== updated.imageKey
				) {
					await deleteMenuImageSafe(c.env.MEDIA, existing.imageKey);
				}

				return ok<AdminMenuCategory>(c, toAdminCategory(updated));
			} catch (error) {
				rethrowAsConflict(error, "A category with that name already exists.");
			}
		},
	)

	.get("/menu/items", validate("query", listItemsQuerySchema), async (c) => {
		const { businessId } = c.get("profile");
		const { categoryId } = c.req.valid("query");

		const where = and(
			eq(menuItems.businessId, businessId),
			categoryId ? eq(menuItems.categoryId, categoryId) : undefined,
		);

		const rows = await getDb(c.env)
			.select()
			.from(menuItems)
			.where(where)
			.orderBy(asc(menuItems.sortOrder), asc(menuItems.name));

		return ok<AdminMenuItemsPayload>(c, { items: rows.map(toAdminItem) });
	})

	.post("/menu/items", validate("json", createItemSchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const input = c.req.valid("json");

		const category = await db.query.menuCategories.findFirst({
			where: and(
				eq(menuCategories.id, input.categoryId),
				eq(menuCategories.businessId, profile.businessId),
			),
		});
		if (!category) {
			throw new ApiError("not_found", "That menu category was not found.");
		}

		if (input.imageKey) {
			assertOwnedMenuMediaKey(profile.businessId, input.imageKey);
		}

		const [created] = await db
			.insert(menuItems)
			.values({
				businessId: profile.businessId,
				categoryId: category.id,
				name: input.name,
				description: input.description,
				priceCents: input.priceCents,
				imageKey: input.imageKey ?? null,
				active: input.active,
				available: input.available,
				popular: input.popular,
				vegetarian: input.vegetarian,
				spicy: input.spicy,
				sortOrder: input.sortOrder,
			})
			.returning();

		if (!created) {
			throw new ApiError("internal_error", "Failed to create menu item.");
		}

		return ok<AdminMenuItem>(c, toAdminItem(created), 201);
	})

	.patch("/menu/items/:itemId", validate("json", updateItemSchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const itemId = c.req.param("itemId");
		const input = c.req.valid("json");

		const existing = await db.query.menuItems.findFirst({
			where: and(
				eq(menuItems.id, itemId),
				eq(menuItems.businessId, profile.businessId),
			),
		});
		if (!existing) {
			throw new ApiError("not_found", "That menu item was not found.");
		}

		if (input.categoryId) {
			const category = await db.query.menuCategories.findFirst({
				where: and(
					eq(menuCategories.id, input.categoryId),
					eq(menuCategories.businessId, profile.businessId),
				),
			});
			if (!category) {
				throw new ApiError("not_found", "That menu category was not found.");
			}
		}

		if (input.imageKey) {
			assertOwnedMenuMediaKey(profile.businessId, input.imageKey);
		}

		const [updated] = await db
			.update(menuItems)
			.set({
				categoryId: input.categoryId,
				name: input.name,
				description: input.description,
				priceCents: input.priceCents,
				imageKey: input.imageKey,
				active: input.active,
				available: input.available,
				popular: input.popular,
				vegetarian: input.vegetarian,
				spicy: input.spicy,
				sortOrder: input.sortOrder,
			})
			.where(eq(menuItems.id, existing.id))
			.returning();

		if (!updated) {
			throw new ApiError("internal_error", "Failed to update menu item.");
		}

		if (
			input.imageKey !== undefined &&
			existing.imageKey &&
			existing.imageKey !== updated.imageKey
		) {
			await deleteMenuImageSafe(c.env.MEDIA, existing.imageKey);
		}

		return ok<AdminMenuItem>(c, toAdminItem(updated));
	})

	.post("/menu/media/upload", async (c) => {
		const profile = c.get("profile");
		const form = await c.req.formData();
		const file = form.get("file");
		if (!(file instanceof File)) {
			throw new ApiError("validation_failed", "Please attach an image file.");
		}

		const uploaded = await putMenuImage(c.env.MEDIA, profile.businessId, file);
		return ok<MenuImageUploadPayload>(c, uploaded, 201);
	})

	.post("/menu/media/delete", validate("json", deleteMediaSchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const { imageKey } = c.req.valid("json");

		assertOwnedMenuMediaKey(profile.businessId, imageKey);

		const [categoryRef, itemRef, promotionRef] = await Promise.all([
			db.query.menuCategories.findFirst({
				where: and(
					eq(menuCategories.businessId, profile.businessId),
					eq(menuCategories.imageKey, imageKey),
				),
				columns: { id: true },
			}),
			db.query.menuItems.findFirst({
				where: and(
					eq(menuItems.businessId, profile.businessId),
					eq(menuItems.imageKey, imageKey),
				),
				columns: { id: true },
			}),
			db.query.promotions.findFirst({
				where: and(
					eq(promotions.businessId, profile.businessId),
					eq(promotions.imageKey, imageKey),
				),
				columns: { id: true },
			}),
		]);

		if (categoryRef || itemRef || promotionRef) {
			throw new ApiError(
				"conflict",
				"That image is still in use. Remove it from records before deleting.",
			);
		}

		await deleteMenuImageSafe(c.env.MEDIA, imageKey);
		return ok<MenuImageDeletePayload>(c, { deleted: true });
	});
