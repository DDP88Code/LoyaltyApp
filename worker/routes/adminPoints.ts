import { and, asc, eq, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type {
	AdminPointsActivityPayload,
	AdminPointsCatalogueItemPayload,
	AdminPointsProgramPayload,
	AdminPointsPromotionPayload,
	AdminPointsReportPayload,
} from "@shared/rewardPoints";
import { POINTS_CATALOGUE_REWARD_TYPES } from "@shared/points";
import { getDb } from "@worker/db/client";
import {
	auditLogs,
	appSettings,
	loyaltyPrograms,
	pointsAwards,
	pointsCatalogueItems,
	pointsPromotions,
	pointsRedemptions,
	rewardDefinitions,
} from "@worker/db/schema";
import { SETTINGS_STAFF_VOUCHER_REDEMPTION_ENABLED } from "@worker/lib/defaults";
import { ApiError, ok } from "@worker/lib/http";
import {
	createPointsAdjustment,
	listPointsAdminActivity,
	listPointsReport,
	reversePointsAward,
} from "@worker/lib/points/service";
import {
	ensurePointsProgram,
	readPointsProgramForAdmin,
} from "@worker/lib/points/config";
import { requireAdminOrOwner, requireSession } from "@worker/middleware/auth";
import { validate } from "@worker/middleware/validate";
import type { AppEnv } from "@worker/types";

const programPatchSchema = z
	.object({
		name: z.string().trim().min(2).max(120).optional(),
		active: z.boolean().optional(),
		earnRatePoints: z.coerce.number().int().min(1).max(100_000).optional(),
		earnRateSpendCents: z.coerce.number().int().min(1).max(10_000_000).optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one field must be provided.",
	})
	.refine(
		(value) =>
			(value.earnRatePoints === undefined && value.earnRateSpendCents === undefined) ||
			(value.earnRatePoints !== undefined && value.earnRateSpendCents !== undefined),
		{
			message: "Earn rate points and spend cents must be updated together.",
		},
	);

const promotionCreateSchema = z
	.object({
		name: z.string().trim().min(2).max(120),
		description: z.string().trim().max(500).nullable().optional(),
		promotionType: z.enum(["multiplier", "fixed_bonus"]),
		multiplierBp: z.coerce.number().int().min(10001).max(1_000_000).nullable().optional(),
		fixedBonusPoints: z.coerce.number().int().min(1).max(1_000_000).nullable().optional(),
		minEligibleSpendCents: z.coerce
			.number()
			.int()
			.min(0)
			.max(100_000_000)
			.nullable()
			.optional(),
		startAt: z.coerce.date(),
		endAt: z.coerce.date(),
		enabled: z.boolean().default(true),
	})
	.superRefine((input, ctx) => {
		if (input.endAt.getTime() <= input.startAt.getTime()) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["endAt"],
				message: "End date/time must be after start date/time.",
			});
		}
		if (input.promotionType === "multiplier" && input.multiplierBp == null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["multiplierBp"],
				message: "Multiplier is required for multiplier promotions.",
			});
		}
		if (input.promotionType === "fixed_bonus" && input.fixedBonusPoints == null) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["fixedBonusPoints"],
				message: "Fixed bonus points are required for fixed bonus promotions.",
			});
		}
	});

const promotionUpdateSchema = z
	.object({
		name: z.string().trim().min(2).max(120).optional(),
		description: z.string().trim().max(500).nullable().optional(),
		promotionType: z.enum(["multiplier", "fixed_bonus"]).optional(),
		multiplierBp: z.coerce.number().int().min(10001).max(1_000_000).nullable().optional(),
		fixedBonusPoints: z.coerce.number().int().min(1).max(1_000_000).nullable().optional(),
		minEligibleSpendCents: z.coerce
			.number()
			.int()
			.min(0)
			.max(100_000_000)
			.nullable()
			.optional(),
		startAt: z.coerce.date().optional(),
		endAt: z.coerce.date().optional(),
		enabled: z.boolean().optional(),
		archived: z.boolean().optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one field must be provided.",
	});

const catalogueCreateSchema = z.object({
	rewardDefinitionId: z.string().trim().min(1).max(64),
	pointsCost: z.coerce.number().int().min(1).max(1_000_000),
	active: z.boolean().default(true),
	sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
	imageKey: z.string().trim().max(300).nullable().optional(),
});

const catalogueUpdateSchema = catalogueCreateSchema
	.partial()
	.extend({ archived: z.boolean().optional() })
	.refine((value) => Object.keys(value).length > 0, {
		message: "At least one field must be provided.",
	});

const reversalSchema = z.object({
	reason: z.string().trim().min(5).max(500),
});

const adjustmentSchema = z.object({
	locationId: z.string().trim().min(1).max(64),
	quantity: z.coerce.number().int().refine((value) => value !== 0, {
		message: "Quantity must be a non-zero integer.",
	}),
	reason: z.string().trim().min(5).max(500),
	idempotencyKey: z.string().trim().min(8).max(128),
});

function isPointsCatalogueRewardType(value: string): value is "free_item" | "voucher" {
	return (POINTS_CATALOGUE_REWARD_TYPES as readonly string[]).includes(value);
}

async function toProgramPayload(db: ReturnType<typeof getDb>, businessId: string): Promise<AdminPointsProgramPayload> {
	await ensurePointsProgram(db, businessId);
	const program = await readPointsProgramForAdmin(db, businessId);
	if (!program) {
		throw new ApiError("internal_error", "Reward Points program could not be initialized.");
	}
	return {
		id: program.id,
		name: program.name,
		active: program.active,
		earnRatePoints: program.earnRatePoints,
		earnRateSpendCents: program.earnRateSpendCents,
	};
}

export const adminPoints = new Hono<AppEnv>()
	.use("*", requireSession, requireAdminOrOwner)
	.get("/program", async (c) => {
		const profile = c.get("profile");
		const payload = await toProgramPayload(getDb(c.env), profile.businessId);
		return ok<AdminPointsProgramPayload>(c, payload);
	})
	.patch("/program", validate("json", programPatchSchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const input = c.req.valid("json");
		await ensurePointsProgram(db, profile.businessId);
		const existing = await readPointsProgramForAdmin(db, profile.businessId);
		if (!existing) {
			throw new ApiError("internal_error", "Reward Points program could not be initialized.");
		}

		const [updated] = await db
			.update(loyaltyPrograms)
			.set({
				name: input.name ?? existing.name,
				active: input.active ?? existing.active,
				earnRatePoints: input.earnRatePoints ?? existing.earnRatePoints,
				earnRateSpendCents: input.earnRateSpendCents ?? existing.earnRateSpendCents,
				rewardDefinitionId: null,
			})
			.where(eq(loyaltyPrograms.id, existing.id))
			.returning({
				id: loyaltyPrograms.id,
				name: loyaltyPrograms.name,
				active: loyaltyPrograms.active,
				earnRatePoints: loyaltyPrograms.earnRatePoints,
				earnRateSpendCents: loyaltyPrograms.earnRateSpendCents,
			});
		if (!updated) {
			throw new ApiError("internal_error", "Failed to update Reward Points program.");
		}

		await db.insert(auditLogs).values({
			businessId: profile.businessId,
			actorUserId: profile.authUserId,
			actorRole: profile.role,
			action: "admin.points_program_updated",
			entityType: "loyalty_program",
			entityId: existing.id,
			oldValueJson: {
				name: existing.name,
				active: existing.active,
				earnRatePoints: existing.earnRatePoints,
				earnRateSpendCents: existing.earnRateSpendCents,
			},
			newValueJson: {
				name: updated.name,
				active: updated.active,
				earnRatePoints: updated.earnRatePoints,
				earnRateSpendCents: updated.earnRateSpendCents,
			},
		});

		return ok<AdminPointsProgramPayload>(c, {
			id: updated.id,
			name: updated.name,
			active: updated.active,
			earnRatePoints: updated.earnRatePoints ?? 1,
			earnRateSpendCents: updated.earnRateSpendCents ?? 100,
		});
	})
	.get("/promotions", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const rows = await db
			.select()
			.from(pointsPromotions)
			.where(eq(pointsPromotions.businessId, profile.businessId))
			.orderBy(asc(pointsPromotions.startAt));
		return ok<AdminPointsPromotionPayload[]>(
			c,
			rows.map((row) => ({
				id: row.id,
				name: row.name,
				description: row.description,
				promotionType: row.promotionType,
				multiplierBp: row.multiplierBp,
				fixedBonusPoints: row.fixedBonusPoints,
				minEligibleSpendCents: row.minEligibleSpendCents,
				startAt: row.startAt.toISOString(),
				endAt: row.endAt.toISOString(),
				enabled: row.enabled,
				archivedAt: row.archivedAt?.toISOString() ?? null,
			})),
		);
	})
	.post("/promotions", validate("json", promotionCreateSchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const input = c.req.valid("json");
		const [created] = await db
			.insert(pointsPromotions)
			.values({
				businessId: profile.businessId,
				name: input.name,
				description: input.description ?? null,
				promotionType: input.promotionType,
				multiplierBp: input.promotionType === "multiplier" ? (input.multiplierBp ?? null) : null,
				fixedBonusPoints:
					input.promotionType === "fixed_bonus" ? (input.fixedBonusPoints ?? null) : null,
				minEligibleSpendCents: input.minEligibleSpendCents ?? null,
				startAt: input.startAt,
				endAt: input.endAt,
				enabled: input.enabled,
			})
			.returning();
		if (!created) {
			throw new ApiError("internal_error", "Failed to create points promotion.");
		}
		return ok<AdminPointsPromotionPayload>(c, {
			id: created.id,
			name: created.name,
			description: created.description,
			promotionType: created.promotionType,
			multiplierBp: created.multiplierBp,
			fixedBonusPoints: created.fixedBonusPoints,
			minEligibleSpendCents: created.minEligibleSpendCents,
			startAt: created.startAt.toISOString(),
			endAt: created.endAt.toISOString(),
			enabled: created.enabled,
			archivedAt: created.archivedAt?.toISOString() ?? null,
		});
	})
	.patch("/promotions/:promotionId", validate("json", promotionUpdateSchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const promotionId = c.req.param("promotionId");
		const input = c.req.valid("json");
		const existing = await db.query.pointsPromotions.findFirst({
			where: and(
				eq(pointsPromotions.id, promotionId),
				eq(pointsPromotions.businessId, profile.businessId),
			),
		});
		if (!existing) {
			throw new ApiError("not_found", "Points promotion not found.");
		}

		const promotionType = input.promotionType ?? existing.promotionType;
		const [updated] = await db
			.update(pointsPromotions)
			.set({
				name: input.name ?? existing.name,
				description: input.description ?? existing.description,
				promotionType,
				multiplierBp:
					promotionType === "multiplier"
						? (input.multiplierBp ?? existing.multiplierBp)
						: null,
				fixedBonusPoints:
					promotionType === "fixed_bonus"
						? (input.fixedBonusPoints ?? existing.fixedBonusPoints)
						: null,
				minEligibleSpendCents:
					input.minEligibleSpendCents ?? existing.minEligibleSpendCents,
				startAt: input.startAt ?? existing.startAt,
				endAt: input.endAt ?? existing.endAt,
				enabled: input.enabled ?? existing.enabled,
				archivedAt:
					input.archived === undefined
						? existing.archivedAt
						: input.archived
							? new Date()
							: null,
			})
			.where(eq(pointsPromotions.id, existing.id))
			.returning();

		if (!updated) {
			throw new ApiError("internal_error", "Failed to update points promotion.");
		}

		return ok<AdminPointsPromotionPayload>(c, {
			id: updated.id,
			name: updated.name,
			description: updated.description,
			promotionType: updated.promotionType,
			multiplierBp: updated.multiplierBp,
			fixedBonusPoints: updated.fixedBonusPoints,
			minEligibleSpendCents: updated.minEligibleSpendCents,
			startAt: updated.startAt.toISOString(),
			endAt: updated.endAt.toISOString(),
			enabled: updated.enabled,
			archivedAt: updated.archivedAt?.toISOString() ?? null,
		});
	})
	.delete("/promotions/:promotionId", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const promotionId = c.req.param("promotionId");
		const existing = await db.query.pointsPromotions.findFirst({
			where: and(
				eq(pointsPromotions.id, promotionId),
				eq(pointsPromotions.businessId, profile.businessId),
			),
			columns: { id: true },
		});
		if (!existing) {
			throw new ApiError("not_found", "Points promotion not found.");
		}

		const used = await db.query.pointsAwards.findFirst({
			where: or(
				eq(pointsAwards.multiplierPromotionId, promotionId),
				eq(pointsAwards.bonusPromotionId, promotionId),
			),
			columns: { id: true },
		});
		if (used) {
			throw new ApiError(
				"conflict",
				"This has been used by real transactions. Archive it instead.",
			);
		}

		await db.delete(pointsPromotions).where(eq(pointsPromotions.id, promotionId));
		return ok(c, { deleted: true });
	})
	.get("/catalogue", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const [rows, voucherSetting] = await Promise.all([
			db
				.select({
					id: pointsCatalogueItems.id,
					rewardDefinitionId: pointsCatalogueItems.rewardDefinitionId,
					pointsCost: pointsCatalogueItems.pointsCost,
					active: pointsCatalogueItems.active,
					archivedAt: pointsCatalogueItems.archivedAt,
					sortOrder: pointsCatalogueItems.sortOrder,
					imageKey: pointsCatalogueItems.imageKey,
					maxPerCustomerPerPeriod: pointsCatalogueItems.maxPerCustomerPerPeriod,
					limitPeriodDays: pointsCatalogueItems.limitPeriodDays,
					createdAt: pointsCatalogueItems.createdAt,
					updatedAt: pointsCatalogueItems.updatedAt,
					name: rewardDefinitions.name,
					description: rewardDefinitions.description,
					rewardType: rewardDefinitions.rewardType,
					valueCents: rewardDefinitions.valueCents,
					terms: rewardDefinitions.terms,
				})
				.from(pointsCatalogueItems)
				.innerJoin(
					rewardDefinitions,
					eq(pointsCatalogueItems.rewardDefinitionId, rewardDefinitions.id),
				)
				.where(eq(pointsCatalogueItems.businessId, profile.businessId))
				.orderBy(asc(pointsCatalogueItems.sortOrder), asc(rewardDefinitions.name)),
			db.query.appSettings.findFirst({
				where: and(
					eq(appSettings.businessId, profile.businessId),
					eq(appSettings.key, SETTINGS_STAFF_VOUCHER_REDEMPTION_ENABLED),
				),
				columns: { valueJson: true },
			}),
		]);

		const staffVoucherEnabled =
			typeof voucherSetting?.valueJson === "boolean" ? voucherSetting.valueJson : false;

		return ok(c, {
			items: rows.map((row) => ({
				id: row.id,
				rewardDefinitionId: row.rewardDefinitionId,
				name: row.name,
				description: row.description,
				rewardType: row.rewardType,
				valueCents: row.valueCents,
				pointsCost: row.pointsCost,
				terms: row.terms,
				imageKey: row.imageKey,
				active: row.active,
				sortOrder: row.sortOrder,
				maxPerCustomerPerPeriod: row.maxPerCustomerPerPeriod,
				limitPeriodDays: row.limitPeriodDays,
				archivedAt: row.archivedAt?.toISOString() ?? null,
				createdAt: row.createdAt.toISOString(),
				updatedAt: row.updatedAt.toISOString(),
			})) satisfies AdminPointsCatalogueItemPayload[],
			staffVoucherRedemptionEnabled: staffVoucherEnabled,
		});
	})
	.post("/catalogue", validate("json", catalogueCreateSchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const input = c.req.valid("json");

		const reward = await db.query.rewardDefinitions.findFirst({
			where: and(
				eq(rewardDefinitions.id, input.rewardDefinitionId),
				eq(rewardDefinitions.businessId, profile.businessId),
			),
		});
		if (!reward) {
			throw new ApiError("not_found", "Reward definition not found.");
		}
		if (!isPointsCatalogueRewardType(reward.rewardType)) {
			throw new ApiError(
				"validation_failed",
				"Only free_item and voucher reward types are allowed in points catalogue.",
			);
		}
		if (reward.welcomeReward) {
			throw new ApiError(
				"validation_failed",
				"Welcome reward definitions cannot be used in points catalogue.",
			);
		}

		const [created] = await db
			.insert(pointsCatalogueItems)
			.values({
				businessId: profile.businessId,
				rewardDefinitionId: input.rewardDefinitionId,
				pointsCost: input.pointsCost,
				active: input.active,
				sortOrder: input.sortOrder,
				imageKey: input.imageKey ?? null,
				maxPerCustomerPerPeriod: null,
				limitPeriodDays: null,
			})
			.returning();
		return ok(c, created, 201);
	})
	.patch("/catalogue/:itemId", validate("json", catalogueUpdateSchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const itemId = c.req.param("itemId");
		const input = c.req.valid("json");
		const existing = await db.query.pointsCatalogueItems.findFirst({
			where: and(
				eq(pointsCatalogueItems.id, itemId),
				eq(pointsCatalogueItems.businessId, profile.businessId),
			),
		});
		if (!existing) {
			throw new ApiError("not_found", "Points catalogue item not found.");
		}

		if (input.rewardDefinitionId) {
			const reward = await db.query.rewardDefinitions.findFirst({
				where: and(
					eq(rewardDefinitions.id, input.rewardDefinitionId),
					eq(rewardDefinitions.businessId, profile.businessId),
				),
			});
			if (!reward) {
				throw new ApiError("not_found", "Reward definition not found.");
			}
			if (!isPointsCatalogueRewardType(reward.rewardType)) {
				throw new ApiError(
					"validation_failed",
					"Only free_item and voucher reward types are allowed in points catalogue.",
				);
			}
			if (reward.welcomeReward) {
				throw new ApiError(
					"validation_failed",
					"Welcome reward definitions cannot be used in points catalogue.",
				);
			}
		}

		const [updated] = await db
			.update(pointsCatalogueItems)
			.set({
				rewardDefinitionId: input.rewardDefinitionId ?? existing.rewardDefinitionId,
				pointsCost: input.pointsCost ?? existing.pointsCost,
				active: input.active ?? existing.active,
				sortOrder: input.sortOrder ?? existing.sortOrder,
				imageKey: input.imageKey ?? existing.imageKey,
				archivedAt:
					input.archived === undefined
						? existing.archivedAt
						: input.archived
							? new Date()
							: null,
			})
			.where(eq(pointsCatalogueItems.id, existing.id))
			.returning();

		if (!updated) {
			throw new ApiError("internal_error", "Failed to update points catalogue item.");
		}
		return ok(c, updated);
	})
	.delete("/catalogue/:itemId", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const itemId = c.req.param("itemId");
		const existing = await db.query.pointsCatalogueItems.findFirst({
			where: and(
				eq(pointsCatalogueItems.id, itemId),
				eq(pointsCatalogueItems.businessId, profile.businessId),
			),
			columns: { id: true },
		});
		if (!existing) {
			throw new ApiError("not_found", "Points catalogue item not found.");
		}
		const used = await db.query.pointsRedemptions.findFirst({
			where: eq(pointsRedemptions.catalogueItemId, existing.id),
			columns: { id: true },
		});
		if (used) {
			throw new ApiError(
				"conflict",
				"This has been used by real transactions. Archive it instead.",
			);
		}
		await db.delete(pointsCatalogueItems).where(eq(pointsCatalogueItems.id, existing.id));
		return ok(c, { deleted: true });
	})
	.get("/activity", async (c) => {
		const profile = c.get("profile");
		const payload = await listPointsAdminActivity({
			db: getDb(c.env),
			businessId: profile.businessId,
		});
		return ok<AdminPointsActivityPayload>(c, payload);
	})
	.get("/report", async (c) => {
		const profile = c.get("profile");
		const payload = await listPointsReport({
			db: getDb(c.env),
			businessId: profile.businessId,
		});
		return ok<AdminPointsReportPayload>(c, payload);
	})
	.post("/awards/:awardId/reverse", validate("json", reversalSchema), async (c) => {
		const profile = c.get("profile");
		const payload = await reversePointsAward({
			db: getDb(c.env),
			businessId: profile.businessId,
			awardId: c.req.param("awardId"),
			actorProfileId: profile.id,
			actorUserId: profile.authUserId,
			actorRole: profile.role,
			reason: c.req.valid("json").reason,
		});
		return ok(c, payload);
	})
	.post(
		"/customers/:customerId/adjustments",
		validate("json", adjustmentSchema),
		async (c) => {
			const profile = c.get("profile");
			const customerId = c.req.param("customerId");
			const input = c.req.valid("json");
			const payload = await createPointsAdjustment({
				db: getDb(c.env),
				businessId: profile.businessId,
				customerId,
				locationId: input.locationId,
				actorProfileId: profile.id,
				actorUserId: profile.authUserId,
				actorRole: profile.role,
				quantity: input.quantity,
				reason: input.reason,
				idempotencyKey: input.idempotencyKey,
			});
			return ok(c, payload);
		},
	);
