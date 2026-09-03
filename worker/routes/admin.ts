import { and, count, desc, eq, like, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AdminCustomerListPayload } from "@shared/api";
import { COFFEE_CURRENCY_CODE } from "@shared/domain";
import type { AdjustmentResultPayload } from "@shared/loyalty";
import { getDb } from "@worker/db/client";
import { loyaltyPrograms, profiles } from "@worker/db/schema";
import { ApiError, ok } from "@worker/lib/http";
import { createLoyaltyAdjustment, getCoffeeProgress } from "@worker/lib/loyalty";
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
	);
