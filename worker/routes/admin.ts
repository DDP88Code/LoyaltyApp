import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	inArray,
	lt,
	like,
	lte,
	or,
	sql,
} from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type {
	AdminAuditLogEntry,
	AdminAuditLogsPayload,
	AdminCustomerDetail,
	AdminCustomerDetailPayload,
	AdminDashboardPayload,
	AdminLookupsPayload,
	AdminLoyaltyProgram,
	AdminLoyaltyProgramsPayload,
	AdminRewardDefinition,
	AdminRewardDefinitionsPayload,
	AdminReportsPayload,
	AdminSettingsUpdateInput,
	AdminSettingsPayload,
	ReportStaffActivity,
	ReportSummaryMetrics,
	AdminStaffListPayload,
	AdminStaffMember,
	AdminTransactionRecord,
	AdminTransactionsPayload,
	DashboardMetricSummary,
	DayValuePoint,
	RewardTrendPoint,
} from "@shared/admin";
import type { AdminCustomerListPayload } from "@shared/api";
import {
	COFFEE_CURRENCY_CODE,
	REWARD_TYPES,
	TRANSACTION_TYPES,
} from "@shared/domain";
import type { AdjustmentResultPayload } from "@shared/loyalty";
import type {
	AdminMenuCategoriesPayload,
	AdminMenuCategory,
	AdminMenuItem,
	AdminMenuItemVariant,
	AdminMenuItemsPayload,
	MenuGroup,
	MenuImageDeletePayload,
	MenuImageUploadPayload,
} from "@shared/menu";
import type {
	AdminPromotion,
	AdminPromotionsPayload,
	PromotionImageDeletePayload,
	PromotionImageUploadPayload,
} from "@shared/promotions";
import { ROLES } from "@shared/roles";
import { getDb } from "@worker/db/client";
import {
	auditLogs,
	appSettings,
	customerRewards,
	locations,
	loyaltyPrograms,
	loyaltyTransactions,
	menuCategories,
	menuItemVariants,
	menuItems,
	profiles,
	promotions,
	rewardDefinitions,
	user,
} from "@worker/db/schema";
import {
	SETTINGS_CODE_TTL_KEY,
	SETTINGS_WELCOME_REWARD_KEY,
	ensureMvpDefaults,
} from "@worker/lib/defaults";
import { ApiError, ok } from "@worker/lib/http";
import { createLoyaltyAdjustment, getCoffeeProgress } from "@worker/lib/loyalty";
import {
	assertOwnedMenuMediaKey,
	assertOwnedPromotionsMediaKey,
	deleteMenuImageSafe,
	putMenuImage,
	putPromotionImage,
} from "@worker/lib/media";
import { requireLocationInBusiness } from "@worker/lib/scope";
import { requireAdminOrOwner, requireSession } from "@worker/middleware/auth";
import { validate } from "@worker/middleware/validate";
import type { AppEnv } from "@worker/types";

const STAFF_ROLES = ["staff", "admin", "owner"] as const;
const STAFF_ASSIGNABLE_ROLES = ["staff", "admin"] as const;
const TRANSACTION_FILTER_TYPES = TRANSACTION_TYPES;
const DEFAULT_DASHBOARD_DAYS = 30;
const MENU_GROUPS: readonly MenuGroup[] = ["food", "drinks"];

const listQuerySchema = z.object({
	search: z.string().trim().max(80).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(25),
	offset: z.coerce.number().int().min(0).default(0),
});

const dashboardQuerySchema = z.object({
	days: z.coerce.number().int().min(7).max(90).default(DEFAULT_DASHBOARD_DAYS),
});

const customersQuerySchema = z.object({
	search: z.string().trim().max(80).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(25),
	offset: z.coerce.number().int().min(0).default(0),
});

const transactionsQuerySchema = z.object({
	customerId: z.string().trim().max(64).optional(),
	staffId: z.string().trim().max(64).optional(),
	locationId: z.string().trim().max(64).optional(),
	programId: z.string().trim().max(64).optional(),
	type: z.enum(TRANSACTION_FILTER_TYPES).optional(),
	billReference: z.string().trim().max(120).optional(),
	from: z.coerce.date().optional(),
	to: z.coerce.date().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(25),
	offset: z.coerce.number().int().min(0).default(0),
});

const reportsQuerySchema = z.object({
	from: z.coerce.date().optional(),
	to: z.coerce.date().optional(),
	locationId: z.string().trim().max(64).optional(),
});

const loyaltyProgramUpdateSchema = z
	.object({
		name: z.string().trim().min(2).max(120).optional(),
		description: z.string().trim().max(500).nullable().optional(),
		qualifyingPurchasesRequired: z.coerce
			.number()
			.int()
			.min(1)
			.max(1_000)
			.nullable()
			.optional(),
		rewardDefinitionId: z.string().trim().max(64).nullable().optional(),
		active: z.boolean().optional(),
		sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
		locationIds: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
	})
	.refine((input) => Object.keys(input).length > 0, {
		message: "At least one field must be provided.",
	});

const rewardDefinitionCreateSchema = z.object({
	name: z.string().trim().min(2).max(120),
	description: z.string().trim().max(500).nullable().optional(),
	rewardType: z.enum(REWARD_TYPES),
	valueCents: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
	pointsCost: z.coerce.number().int().min(0).max(1_000_000).nullable().optional(),
	itemReference: z.string().trim().max(120).nullable().optional(),
	validDays: z.coerce.number().int().min(1).max(3660).nullable().optional(),
	welcomeReward: z.boolean().default(false),
	active: z.boolean().default(true),
	terms: z.string().trim().max(2_000).nullable().optional(),
});

const rewardDefinitionUpdateSchema = rewardDefinitionCreateSchema
	.partial()
	.refine((input) => Object.keys(input).length > 0, {
		message: "At least one field must be provided.",
	});

const staffListQuerySchema = z.object({
	search: z.string().trim().max(80).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(25),
	offset: z.coerce.number().int().min(0).default(0),
});

const staffCreateSchema = z.object({
	fullName: z.string().trim().min(2).max(120),
	email: z.string().trim().email().max(160),
	mobileNumber: z.string().trim().max(30).nullable().optional(),
	role: z.enum(STAFF_ASSIGNABLE_ROLES).default("staff"),
	assignedLocationId: z.string().trim().max(64).nullable().optional(),
	active: z.boolean().default(true),
});

const staffUpdateSchema = z
	.object({
		fullName: z.string().trim().min(2).max(120).optional(),
		email: z.string().trim().email().max(160).optional(),
		mobileNumber: z.string().trim().max(30).nullable().optional(),
		role: z.enum(STAFF_ROLES).optional(),
		assignedLocationId: z.string().trim().max(64).nullable().optional(),
		active: z.boolean().optional(),
	})
	.refine((input) => Object.keys(input).length > 0, {
		message: "At least one field must be provided.",
	});

const auditListQuerySchema = z.object({
	action: z.string().trim().max(120).optional(),
	entityType: z.string().trim().max(120).optional(),
	actorRole: z.enum(ROLES).optional(),
	entityId: z.string().trim().max(64).optional(),
	from: z.coerce.date().optional(),
	to: z.coerce.date().optional(),
	limit: z.coerce.number().int().min(1).max(200).default(50),
	offset: z.coerce.number().int().min(0).default(0),
});

const settingsUpdateSchema = z
	.object({
		welcomeRewardEnabled: z.boolean().optional(),
		loyaltyCodeTtlSeconds: z.coerce.number().int().min(60).max(3600).optional(),
	})
	.refine((input) => Object.keys(input).length > 0, {
		message: "At least one field must be provided.",
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
}).superRefine((input, ctx) => {
	if (input.transactionType === "adjustment" && input.quantity <= 0) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ["quantity"],
			message: "Adjustment adds coffee, so quantity must be positive.",
		});
	}

	if (input.transactionType === "reversal" && input.quantity >= 0) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ["quantity"],
			message: "Reversal subtracts coffee, so quantity must be negative.",
		});
	}
});

const createCategorySchema = z.object({
	name: z.string().trim().min(2).max(80),
	description: z.string().trim().max(280).nullable().optional(),
	menuGroup: z.enum(MENU_GROUPS).default("food"),
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

const menuItemVariantSchema = z.object({
	name: z.string().trim().min(1).max(80),
	priceCents: z.number().int().min(0).max(1_000_000),
	sortOrder: z.number().int().min(0).max(10_000).default(0),
	active: z.boolean().default(true),
});

const createItemBaseSchema = z.object({
	categoryId: z.string().trim().min(1).max(64),
	name: z.string().trim().min(2).max(120),
	description: z.string().trim().max(500).default(""),
	optionNotes: z.string().trim().max(500).nullable().optional(),
	priceCents: z.number().int().min(0).max(1_000_000),
	imageKey: z.string().trim().max(300).nullable().optional(),
	active: z.boolean().default(true),
	available: z.boolean().default(true),
	popular: z.boolean().default(false),
	vegetarian: z.boolean().default(false),
	spicy: z.boolean().default(false),
	isNew: z.boolean().default(false),
	subjectToAvailability: z.boolean().default(false),
	variants: z.array(menuItemVariantSchema).max(30).default([]),
	sortOrder: z.number().int().min(0).max(10_000).default(0),
});

const createItemSchema = createItemBaseSchema.superRefine((input, ctx) => {
	const seen = new Set<string>();
	for (const [index, variant] of input.variants.entries()) {
		const key = variant.name.trim().toLowerCase();
		if (seen.has(key)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["variants", index, "name"],
				message: "Variant names must be unique per item.",
			});
			continue;
		}
		seen.add(key);
	}
});

const updateItemSchema = createItemBaseSchema
	.omit({ categoryId: true, variants: true })
	.extend({ categoryId: z.string().trim().min(1).max(64).optional() })
	.extend({ variants: z.array(menuItemVariantSchema).max(30).optional() })
	.partial()
	.refine((input) => Object.keys(input).length > 0, {
		message: "At least one field must be provided.",
	})
	.superRefine((input, ctx) => {
		if (!input.variants) return;
		const seen = new Set<string>();
		for (const [index, variant] of input.variants.entries()) {
			const key = variant.name.trim().toLowerCase();
			if (seen.has(key)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["variants", index, "name"],
					message: "Variant names must be unique per item.",
				});
				continue;
			}
			seen.add(key);
		}
	});

const deleteMediaSchema = z.object({
	imageKey: z.string().trim().min(1).max(300),
});

const ctaUrlSchema = z
	.string()
	.trim()
	.max(500)
	.refine(
		(value) => value.startsWith("/") || /^https?:\/\//i.test(value),
		"CTA URL must be an app path or an absolute HTTP(S) URL.",
	);

const promotionFieldsSchema = z.object({
	title: z.string().trim().min(2).max(120),
	subtitle: z.string().trim().max(160).nullable().optional(),
	description: z.string().trim().max(1200).nullable().optional(),
	imageKey: z.string().trim().max(300).nullable().optional(),
	startAt: z.coerce.date(),
	endAt: z.coerce.date(),
	active: z.boolean().default(true),
	ctaText: z.string().trim().min(1).max(80).nullable().optional(),
	ctaUrl: ctaUrlSchema.nullable().optional(),
});

const createPromotionSchema = promotionFieldsSchema
	.refine((input) => input.endAt.getTime() > input.startAt.getTime(), {
		message: "Promotion end time must be after start time.",
	});

const updatePromotionSchema = promotionFieldsSchema
	.partial()
	.refine((input) => Object.keys(input).length > 0, {
		message: "At least one field must be provided.",
	});

function toAdminCategory(
	row: typeof menuCategories.$inferSelect,
): AdminMenuCategory {
	return {
		id: row.id,
		businessId: row.businessId,
		name: row.name,
		description: row.description,
		menuGroup: row.menuGroup,
		imageKey: row.imageKey,
		sortOrder: row.sortOrder,
		active: row.active,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function toAdminVariant(
	row: typeof menuItemVariants.$inferSelect,
): AdminMenuItemVariant {
	return {
		id: row.id,
		menuItemId: row.menuItemId,
		name: row.name,
		priceCents: row.priceCents,
		sortOrder: row.sortOrder,
		active: row.active,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function toAdminItem(
	row: typeof menuItems.$inferSelect,
	variants: AdminMenuItemVariant[] = [],
): AdminMenuItem {
	return {
		id: row.id,
		businessId: row.businessId,
		categoryId: row.categoryId,
		name: row.name,
		description: row.description,
		optionNotes: row.optionNotes,
		priceCents: row.priceCents,
		imageKey: row.imageKey,
		active: row.active,
		available: row.available,
		popular: row.popular,
		vegetarian: row.vegetarian,
		spicy: row.spicy,
		isNew: row.isNew,
		subjectToAvailability: row.subjectToAvailability,
		variants,
		sortOrder: row.sortOrder,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function toAdminPromotion(row: typeof promotions.$inferSelect): AdminPromotion {
	return {
		id: row.id,
		businessId: row.businessId,
		title: row.title,
		subtitle: row.subtitle,
		description: row.description,
		imageKey: row.imageKey,
		startAt: row.startAt.toISOString(),
		endAt: row.endAt.toISOString(),
		active: row.active,
		ctaText: row.ctaText,
		ctaUrl: row.ctaUrl,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function toAdminRewardDefinition(
	row: typeof rewardDefinitions.$inferSelect,
): AdminRewardDefinition {
	return {
		id: row.id,
		businessId: row.businessId,
		name: row.name,
		description: row.description,
		rewardType: row.rewardType,
		valueCents: row.valueCents,
		pointsCost: row.pointsCost,
		itemReference: row.itemReference,
		validDays: row.validDays,
		welcomeReward: row.welcomeReward,
		active: row.active,
		terms: row.terms,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function buildCustomerReference(
	customer: Pick<typeof profiles.$inferSelect, "id" | "email" | "mobileNumber">,
): string {
	return [customer.id, customer.email, customer.mobileNumber]
		.filter((value) => Boolean(value))
		.join(" | ");
}

function isStaffScopedRole(
	role: string,
): role is (typeof STAFF_ROLES)[number] {
	return STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number]);
}

function monthRange(now = new Date()): { monthStart: Date; nextMonthStart: Date } {
	const monthStart = new Date(
		now.getFullYear(),
		now.getMonth(),
		1,
		0,
		0,
		0,
		0,
	);
	const nextMonthStart = new Date(
		now.getFullYear(),
		now.getMonth() + 1,
		1,
		0,
		0,
		0,
		0,
	);
	return { monthStart, nextMonthStart };
}

function asDateKey(value: Date): string {
	return value.toISOString().slice(0, 10);
}

function enumerateDays(start: Date, end: Date): string[] {
	const days: string[] = [];
	const cursor = new Date(start);
	while (cursor.getTime() <= end.getTime()) {
		days.push(asDateKey(cursor));
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return days;
}

function ensureRewardFieldCompatibility(input: {
	rewardType: (typeof REWARD_TYPES)[number];
	valueCents?: number | null;
	pointsCost?: number | null;
	itemReference?: string | null;
}) {
	if (input.rewardType === "voucher" || input.rewardType === "discount") {
		if (input.valueCents == null) {
			throw new ApiError(
				"validation_failed",
				"Value cents is required for voucher and discount rewards.",
			);
		}
	}

	if (input.rewardType === "points_reward" && input.pointsCost == null) {
		throw new ApiError(
			"validation_failed",
			"Points cost is required for points rewards.",
		);
	}

	if (input.rewardType === "free_item" && !input.itemReference?.trim()) {
		throw new ApiError(
			"validation_failed",
			"Item reference is required for free-item rewards.",
		);
	}
}

async function buildAdminTransactions(
	db: ReturnType<typeof getDb>,
	businessId: string,
	input: z.output<typeof transactionsQuerySchema>,
): Promise<AdminTransactionsPayload> {
	const toInclusive = input.to
		? new Date(input.to.getTime() + 86_399_999)
		: undefined;

	const where = and(
		eq(loyaltyTransactions.businessId, businessId),
		input.customerId ? eq(loyaltyTransactions.customerId, input.customerId) : undefined,
		input.staffId ? eq(loyaltyTransactions.staffId, input.staffId) : undefined,
		input.locationId ? eq(loyaltyTransactions.locationId, input.locationId) : undefined,
		input.programId ? eq(loyaltyTransactions.programId, input.programId) : undefined,
		input.type
			? eq(loyaltyTransactions.transactionType, input.type)
			: undefined,
		input.billReference
			? like(loyaltyTransactions.billReference, `%${input.billReference}%`)
			: undefined,
		input.from ? gte(loyaltyTransactions.createdAt, input.from) : undefined,
		toInclusive ? lte(loyaltyTransactions.createdAt, toInclusive) : undefined,
	);

	const [rows, [totals]] = await Promise.all([
		db
			.select({
				id: loyaltyTransactions.id,
				transactionType: loyaltyTransactions.transactionType,
				quantity: loyaltyTransactions.quantity,
				billReference: loyaltyTransactions.billReference,
				notes: loyaltyTransactions.notes,
				reason: loyaltyTransactions.reason,
				createdAt: loyaltyTransactions.createdAt,
				customerId: loyaltyTransactions.customerId,
				staffId: loyaltyTransactions.staffId,
				approvedById: loyaltyTransactions.approvedBy,
				locationId: loyaltyTransactions.locationId,
				programId: loyaltyTransactions.programId,
			})
			.from(loyaltyTransactions)
			.where(where)
			.orderBy(desc(loyaltyTransactions.createdAt))
			.limit(input.limit)
			.offset(input.offset),
		db.select({ value: count() }).from(loyaltyTransactions).where(where),
	]);

	const profileIds = new Set<string>();
	const locationIds = new Set<string>();
	const programIds = new Set<string>();

	for (const row of rows) {
		profileIds.add(row.customerId);
		if (row.staffId) profileIds.add(row.staffId);
		if (row.approvedById) profileIds.add(row.approvedById);
		locationIds.add(row.locationId);
		if (row.programId) programIds.add(row.programId);
	}

	const [profileRows, locationRows, programRows] = await Promise.all([
		profileIds.size > 0
			? db
				.select({ id: profiles.id, fullName: profiles.fullName })
				.from(profiles)
				.where(
					and(
						eq(profiles.businessId, businessId),
						inArray(profiles.id, Array.from(profileIds)),
					),
				)
			: Promise.resolve([]),
		locationIds.size > 0
			? db
				.select({ id: locations.id, name: locations.name })
				.from(locations)
				.where(
					and(
						eq(locations.businessId, businessId),
						inArray(locations.id, Array.from(locationIds)),
					),
				)
			: Promise.resolve([]),
		programIds.size > 0
			? db
				.select({ id: loyaltyPrograms.id, name: loyaltyPrograms.name })
				.from(loyaltyPrograms)
				.where(
					and(
						eq(loyaltyPrograms.businessId, businessId),
						inArray(loyaltyPrograms.id, Array.from(programIds)),
					),
				)
			: Promise.resolve([]),
	]);

	const profileNameById = new Map(profileRows.map((row) => [row.id, row.fullName]));
	const locationNameById = new Map(locationRows.map((row) => [row.id, row.name]));
	const programNameById = new Map(programRows.map((row) => [row.id, row.name]));

	return {
		transactions: rows.map(
			(row): AdminTransactionRecord => ({
				id: row.id,
				transactionType: row.transactionType,
				quantity: row.quantity,
				billReference: row.billReference,
				notes: row.notes,
				reason: row.reason,
				createdAt: row.createdAt.toISOString(),
				customerId: row.customerId,
				customerName: profileNameById.get(row.customerId) ?? "Unknown customer",
				staffId: row.staffId,
				staffName: row.staffId
					? profileNameById.get(row.staffId) ?? "Unknown staff"
					: null,
				approvedById: row.approvedById,
				approvedByName: row.approvedById
					? profileNameById.get(row.approvedById) ?? "Unknown approver"
					: null,
				locationId: row.locationId,
				locationName: locationNameById.get(row.locationId) ?? "Unknown location",
				programId: row.programId,
				programName: row.programId
					? programNameById.get(row.programId) ?? "Unknown program"
					: null,
			}),
		),
		total: totals?.value ?? 0,
		limit: input.limit,
		offset: input.offset,
	};
}

async function ensureRewardDefinitionInBusiness(
	db: ReturnType<typeof getDb>,
	businessId: string,
	rewardDefinitionId: string,
) {
	const reward = await db.query.rewardDefinitions.findFirst({
		where: and(
			eq(rewardDefinitions.id, rewardDefinitionId),
			eq(rewardDefinitions.businessId, businessId),
		),
		columns: { id: true },
	});
	if (!reward) {
		throw new ApiError("not_found", "That reward definition was not found.");
	}
}

async function getSettingValue(
	db: ReturnType<typeof getDb>,
	businessId: string,
	key: string,
) {
	return db.query.appSettings.findFirst({
		where: and(eq(appSettings.businessId, businessId), eq(appSettings.key, key)),
		columns: { id: true, valueJson: true },
	});
}

async function upsertSettingValue(
	db: ReturnType<typeof getDb>,
	businessId: string,
	key: string,
	valueJson: unknown,
) {
	const existing = await getSettingValue(db, businessId, key);
	if (existing) {
		await db
			.update(appSettings)
			.set({ valueJson })
			.where(eq(appSettings.id, existing.id));
		return;
	}

	await db.insert(appSettings).values({
		businessId,
		key,
		valueJson,
	});
}

function normalizeReportDateRange(input: {
	from?: Date;
	to?: Date;
}): { from: Date; to: Date; toInclusive: Date } {
	const now = new Date();
	const today = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
	const from = input.from ?? new Date(today.getTime() - 29 * 86_400_000);
	const to = input.to ?? today;
	if (to.getTime() < from.getTime()) {
		throw new ApiError("validation_failed", "End date must be after start date.");
	}
	const toInclusive = new Date(to.getTime() + 86_399_999);
	return { from, to, toInclusive };
}

function isRoleElevation(
	fromRole: (typeof STAFF_ROLES)[number],
	toRole: (typeof STAFF_ROLES)[number],
): boolean {
	const rank = { staff: 1, admin: 2, owner: 3 } as const;
	return rank[toRole] > rank[fromRole];
}

function assertCtaPair(
	ctaText: string | null | undefined,
	ctaUrl: string | null | undefined,
): void {
	if (Boolean(ctaText) !== Boolean(ctaUrl)) {
		throw new ApiError(
			"validation_failed",
			"CTA text and CTA URL must both be provided or both be empty.",
		);
	}
}

async function isImageKeyStillInUse(
	db: ReturnType<typeof getDb>,
	businessId: string,
	imageKey: string,
): Promise<boolean> {
	const [categoryRef, itemRef, promotionRef] = await Promise.all([
		db.query.menuCategories.findFirst({
			where: and(
				eq(menuCategories.businessId, businessId),
				eq(menuCategories.imageKey, imageKey),
			),
			columns: { id: true },
		}),
		db.query.menuItems.findFirst({
			where: and(
				eq(menuItems.businessId, businessId),
				eq(menuItems.imageKey, imageKey),
			),
			columns: { id: true },
		}),
		db.query.promotions.findFirst({
			where: and(
				eq(promotions.businessId, businessId),
				eq(promotions.imageKey, imageKey),
			),
			columns: { id: true },
		}),
	]);

	return Boolean(categoryRef || itemRef || promotionRef);
}

function rethrowAsConflict(error: unknown, message: string): never {
	if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
		throw new ApiError("conflict", message);
	}
	throw error;
}

export const admin = new Hono<AppEnv>()
	.use("*", requireSession, requireAdminOrOwner)

	.get("/dashboard", validate("query", dashboardQuerySchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const { days } = c.req.valid("query");
		await ensureMvpDefaults(db, c.env.BUSINESS_SLUG);

		const now = new Date();
		const today = new Date(
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
		);
		const fromDate = new Date(today.getTime() - (days - 1) * 86_400_000);
		const { monthStart, nextMonthStart } = monthRange(now);

		const [
			[totalMembersRow],
			[activeMembersRow],
			[newMembersThisMonthRow],
			[coffeesPurchasedRow],
			[freeCoffeesIssuedRow],
			[freeCoffeesRedeemedRow],
			[outstandingRewardsRow],
			rewardRows,
			memberRows,
			coffeeRows,
		] = await Promise.all([
			db
				.select({ value: count() })
				.from(profiles)
				.where(
					and(
						eq(profiles.businessId, profile.businessId),
						eq(profiles.role, "customer"),
					),
				),
			db
				.select({ value: count() })
				.from(profiles)
				.where(
					and(
						eq(profiles.businessId, profile.businessId),
						eq(profiles.role, "customer"),
						eq(profiles.active, true),
					),
				),
			db
				.select({ value: count() })
				.from(profiles)
				.where(
					and(
						eq(profiles.businessId, profile.businessId),
						eq(profiles.role, "customer"),
						gte(profiles.createdAt, monthStart),
						lt(profiles.createdAt, nextMonthStart),
					),
				),
			db
				.select({
					value: sql<number>`coalesce(sum(${loyaltyTransactions.quantity}), 0)`,
				})
				.from(loyaltyTransactions)
				.where(
					and(
						eq(loyaltyTransactions.businessId, profile.businessId),
						eq(loyaltyTransactions.transactionType, "earn"),
					),
				),
			db
				.select({ value: count() })
				.from(customerRewards)
				.innerJoin(
					rewardDefinitions,
					eq(customerRewards.rewardDefinitionId, rewardDefinitions.id),
				)
				.where(
					and(
						eq(customerRewards.businessId, profile.businessId),
						eq(rewardDefinitions.rewardType, "free_item"),
					),
				),
			db
				.select({ value: count() })
				.from(customerRewards)
				.innerJoin(
					rewardDefinitions,
					eq(customerRewards.rewardDefinitionId, rewardDefinitions.id),
				)
				.where(
					and(
						eq(customerRewards.businessId, profile.businessId),
						eq(customerRewards.status, "redeemed"),
						eq(rewardDefinitions.rewardType, "free_item"),
					),
				),
			db
				.select({ value: count() })
				.from(customerRewards)
				.where(
					and(
						eq(customerRewards.businessId, profile.businessId),
						eq(customerRewards.status, "available"),
					),
				),
			db
				.select({
					issuedAt: customerRewards.issuedAt,
					redeemedAt: customerRewards.redeemedAt,
				})
				.from(customerRewards)
				.where(
					and(
						eq(customerRewards.businessId, profile.businessId),
						gte(customerRewards.issuedAt, fromDate),
					),
				),
			db
				.select({ createdAt: profiles.createdAt })
				.from(profiles)
				.where(
					and(
						eq(profiles.businessId, profile.businessId),
						eq(profiles.role, "customer"),
						gte(profiles.createdAt, fromDate),
					),
				),
			db
				.select({
					createdAt: loyaltyTransactions.createdAt,
					quantity: loyaltyTransactions.quantity,
				})
				.from(loyaltyTransactions)
				.where(
					and(
						eq(loyaltyTransactions.businessId, profile.businessId),
						eq(loyaltyTransactions.transactionType, "earn"),
						gte(loyaltyTransactions.createdAt, fromDate),
					),
				),
		]);

		const totalMembers = totalMembersRow?.value ?? 0;
		const activeMembers = activeMembersRow?.value ?? 0;
		const newMembersThisMonth = newMembersThisMonthRow?.value ?? 0;
		const coffeesPurchased = coffeesPurchasedRow?.value ?? 0;
		const freeCoffeesIssued = freeCoffeesIssuedRow?.value ?? 0;
		const freeCoffeesRedeemed = freeCoffeesRedeemedRow?.value ?? 0;
		const outstandingRewards = outstandingRewardsRow?.value ?? 0;
		const redemptionRatePercent =
			freeCoffeesIssued > 0
				? Math.round((freeCoffeesRedeemed / freeCoffeesIssued) * 10_000) / 100
				: 0;

		const metrics: DashboardMetricSummary = {
			totalMembers,
			activeMembers,
			newMembersThisMonth,
			coffeesPurchased,
			freeCoffeesIssued,
			freeCoffeesRedeemed,
			outstandingRewards,
			redemptionRatePercent,
		};

		const allDays = enumerateDays(fromDate, today);

		const memberMap = new Map<string, number>();
		for (const row of memberRows) {
			const day = asDateKey(row.createdAt);
			memberMap.set(day, (memberMap.get(day) ?? 0) + 1);
		}

		const coffeeMap = new Map<string, number>();
		for (const row of coffeeRows) {
			const day = asDateKey(row.createdAt);
			coffeeMap.set(day, (coffeeMap.get(day) ?? 0) + row.quantity);
		}

		const issuedMap = new Map<string, number>();
		const redeemedMap = new Map<string, number>();
		for (const row of rewardRows) {
			const issuedDay = asDateKey(row.issuedAt);
			issuedMap.set(issuedDay, (issuedMap.get(issuedDay) ?? 0) + 1);
			if (row.redeemedAt) {
				const redeemedDay = asDateKey(row.redeemedAt);
				redeemedMap.set(
					redeemedDay,
					(redeemedMap.get(redeemedDay) ?? 0) + 1,
				);
			}
		}

		const newMembersOverTime: DayValuePoint[] = allDays.map((date) => ({
			date,
			value: memberMap.get(date) ?? 0,
		}));

		const coffeePurchasesOverTime: DayValuePoint[] = allDays.map((date) => ({
			date,
			value: coffeeMap.get(date) ?? 0,
		}));

		const rewardsEarnedVsRedeemed: RewardTrendPoint[] = allDays.map((date) => ({
			date,
			issued: issuedMap.get(date) ?? 0,
			redeemed: redeemedMap.get(date) ?? 0,
		}));

		const payload: AdminDashboardPayload = {
			metrics,
			newMembersOverTime,
			coffeePurchasesOverTime,
			rewardsEarnedVsRedeemed,
		};

		return ok<AdminDashboardPayload>(c, payload);
	})

	.get("/lookups", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		await ensureMvpDefaults(db, c.env.BUSINESS_SLUG);

		const [customerRows, staffRows, locationRows, programRows] = await Promise.all([
			db
				.select({ id: profiles.id, fullName: profiles.fullName, email: profiles.email })
				.from(profiles)
				.where(
					and(
						eq(profiles.businessId, profile.businessId),
						eq(profiles.role, "customer"),
					),
				)
				.orderBy(asc(profiles.fullName)),
			db
				.select({
					id: profiles.id,
					fullName: profiles.fullName,
					email: profiles.email,
					role: profiles.role,
				})
				.from(profiles)
				.where(
					and(
						eq(profiles.businessId, profile.businessId),
						inArray(profiles.role, STAFF_ROLES),
					),
				)
				.orderBy(asc(profiles.fullName)),
			db
				.select({ id: locations.id, name: locations.name, address: locations.address })
				.from(locations)
				.where(eq(locations.businessId, profile.businessId))
				.orderBy(asc(locations.name)),
			db
				.select({
					id: loyaltyPrograms.id,
					name: loyaltyPrograms.name,
					programType: loyaltyPrograms.programType,
				})
				.from(loyaltyPrograms)
				.where(eq(loyaltyPrograms.businessId, profile.businessId))
				.orderBy(asc(loyaltyPrograms.sortOrder), asc(loyaltyPrograms.name)),
		]);

		return ok<AdminLookupsPayload>(c, {
			customers: customerRows,
			staff: staffRows,
			locations: locationRows,
			programs: programRows,
		});
	})

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

	.get("/customers-v2", validate("query", customersQuerySchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const { search, limit, offset } = c.req.valid("query");

		const foundByReferenceIds = search
			? await db
				.selectDistinct({ customerId: loyaltyTransactions.customerId })
				.from(loyaltyTransactions)
				.where(
					and(
						eq(loyaltyTransactions.businessId, profile.businessId),
						like(loyaltyTransactions.billReference, `%${search}%`),
					),
				)
			: [];

		const referenceIds = foundByReferenceIds.map((row) => row.customerId);

		const where = and(
			eq(profiles.businessId, profile.businessId),
			eq(profiles.role, "customer"),
			search
				? or(
						like(profiles.fullName, `%${search}%`),
						like(profiles.email, `%${search}%`),
						like(profiles.mobileNumber, `%${search}%`),
						referenceIds.length > 0 ? inArray(profiles.id, referenceIds) : undefined,
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
				id: row.id,
				fullName: row.fullName,
				email: row.email,
				mobileNumber: row.mobileNumber,
				active: row.active,
				createdAt: row.createdAt.toISOString(),
			})),
			total: totals?.value ?? 0,
			limit,
			offset,
		});
	})

	.get("/customers/:customerId", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const customerId = c.req.param("customerId");

		const customer = await db.query.profiles.findFirst({
			where: and(
				eq(profiles.id, customerId),
				eq(profiles.businessId, profile.businessId),
				eq(profiles.role, "customer"),
			),
		});
		if (!customer) {
			throw new ApiError("not_found", "That customer was not found.");
		}

		const [coffee, rewards, transactions] = await Promise.all([
			getCoffeeProgress(db, profile.businessId, customer.id),
			(async () => {
				const rows = await db
					.select()
					.from(customerRewards)
					.innerJoin(
						rewardDefinitions,
						eq(customerRewards.rewardDefinitionId, rewardDefinitions.id),
					)
					.where(
						and(
							eq(customerRewards.businessId, profile.businessId),
							eq(customerRewards.customerId, customer.id),
						),
					)
					.orderBy(desc(customerRewards.issuedAt));

				const now = Date.now();
				return rows.map((row) => {
					const expired =
						row.customer_rewards.status === "available" &&
						row.customer_rewards.expiresAt !== null &&
						row.customer_rewards.expiresAt.getTime() < now;
					return {
						id: row.customer_rewards.id,
						name: row.reward_definitions.name,
						rewardType: row.reward_definitions.rewardType,
						status: expired ? "expired" : row.customer_rewards.status,
						valueCents: row.reward_definitions.valueCents,
						issuedAt: row.customer_rewards.issuedAt.toISOString(),
						expiresAt: row.customer_rewards.expiresAt?.toISOString() ?? null,
						redeemedAt: row.customer_rewards.redeemedAt?.toISOString() ?? null,
					};
				});
			})(),
			buildAdminTransactions(db, profile.businessId, {
				limit: 100,
				offset: 0,
				customerId: customer.id,
				staffId: undefined,
				locationId: undefined,
				programId: undefined,
				type: undefined,
				billReference: undefined,
				from: undefined,
				to: undefined,
			}),
		]);

		const detail: AdminCustomerDetail = {
			id: customer.id,
			fullName: customer.fullName,
			email: customer.email,
			mobileNumber: customer.mobileNumber,
			active: customer.active,
			createdAt: customer.createdAt.toISOString(),
			reference: buildCustomerReference(customer),
		};

		return ok<AdminCustomerDetailPayload>(c, {
			customer: detail,
			coffee,
			rewards,
			transactions: transactions.transactions,
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

	.get("/loyalty/programs", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		await ensureMvpDefaults(db, c.env.BUSINESS_SLUG);

		const [programRows, locationRows, rewardRows] = await Promise.all([
			db
				.select({
					id: loyaltyPrograms.id,
					businessId: loyaltyPrograms.businessId,
					name: loyaltyPrograms.name,
					description: loyaltyPrograms.description,
					programType: loyaltyPrograms.programType,
					currencyCode: loyaltyPrograms.currencyCode,
					qualifyingPurchasesRequired: loyaltyPrograms.qualifyingPurchasesRequired,
					rewardDefinitionId: loyaltyPrograms.rewardDefinitionId,
					rewardName: rewardDefinitions.name,
					rewardValidDays: rewardDefinitions.validDays,
					active: loyaltyPrograms.active,
					sortOrder: loyaltyPrograms.sortOrder,
					updatedAt: loyaltyPrograms.updatedAt,
				})
				.from(loyaltyPrograms)
				.leftJoin(
					rewardDefinitions,
					eq(loyaltyPrograms.rewardDefinitionId, rewardDefinitions.id),
				)
				.where(eq(loyaltyPrograms.businessId, profile.businessId))
				.orderBy(asc(loyaltyPrograms.sortOrder), asc(loyaltyPrograms.name)),
			db
				.select({ id: locations.id, name: locations.name, address: locations.address })
				.from(locations)
				.where(eq(locations.businessId, profile.businessId))
				.orderBy(asc(locations.name)),
			db
				.select()
				.from(rewardDefinitions)
				.where(eq(rewardDefinitions.businessId, profile.businessId))
				.orderBy(asc(rewardDefinitions.name)),
		]);

		const assignments = await Promise.all(
			programRows.map((program) =>
				getSettingValue(
					db,
					profile.businessId,
					`loyalty_program:${program.id}:location_ids`,
				),
			),
		);

		const programs: AdminLoyaltyProgram[] = programRows.map((row, index) => {
			const assignment = assignments[index]?.valueJson;
			const locationIds = Array.isArray(assignment)
				? assignment.filter((value): value is string => typeof value === "string")
				: [];

			return {
				id: row.id,
				businessId: row.businessId,
				name: row.name,
				description: row.description,
				programType: row.programType,
				currencyCode: row.currencyCode,
				qualifyingPurchasesRequired: row.qualifyingPurchasesRequired,
				rewardDefinitionId: row.rewardDefinitionId,
				rewardName: row.rewardName,
				rewardValidDays: row.rewardValidDays,
				active: row.active,
				sortOrder: row.sortOrder,
				locationIds,
				updatedAt: row.updatedAt.toISOString(),
			};
		});

		return ok<AdminLoyaltyProgramsPayload>(c, {
			programs,
			locations: locationRows,
			rewardOptions: rewardRows.map(toAdminRewardDefinition),
		});
	})

	.patch(
		"/loyalty/programs/:programId",
		validate("json", loyaltyProgramUpdateSchema),
		async (c) => {
			const profile = c.get("profile");
			const db = getDb(c.env);
			const programId = c.req.param("programId");
			const input = c.req.valid("json");

			const existing = await db.query.loyaltyPrograms.findFirst({
				where: and(
					eq(loyaltyPrograms.id, programId),
					eq(loyaltyPrograms.businessId, profile.businessId),
				),
			});
			if (!existing) {
				throw new ApiError("not_found", "That loyalty program was not found.");
			}

			if (input.rewardDefinitionId) {
				await ensureRewardDefinitionInBusiness(
					db,
					profile.businessId,
					input.rewardDefinitionId,
				);
			}

			if (input.locationIds) {
				const locationRows = await db
					.select({ id: locations.id })
					.from(locations)
					.where(
						and(
							eq(locations.businessId, profile.businessId),
							inArray(locations.id, input.locationIds),
						),
					);
				if (locationRows.length !== input.locationIds.length) {
					throw new ApiError(
						"validation_failed",
						"One or more locations are invalid for this business.",
					);
				}
			}

			const [updated] = await db
				.update(loyaltyPrograms)
				.set({
					name: input.name,
					description: input.description,
					qualifyingPurchasesRequired: input.qualifyingPurchasesRequired,
					rewardDefinitionId: input.rewardDefinitionId,
					active: input.active,
					sortOrder: input.sortOrder,
				})
				.where(eq(loyaltyPrograms.id, existing.id))
				.returning();

			if (!updated) {
				throw new ApiError("internal_error", "Failed to update loyalty program.");
			}

			if (input.locationIds) {
				const key = `loyalty_program:${updated.id}:location_ids`;
				const existingSetting = await getSettingValue(db, profile.businessId, key);
				if (existingSetting) {
					await db
						.update(appSettings)
						.set({ valueJson: input.locationIds })
						.where(eq(appSettings.id, existingSetting.id));
				} else {
					await db.insert(appSettings).values({
						businessId: profile.businessId,
						key,
						valueJson: input.locationIds,
					});
				}
			}

			await db.insert(auditLogs).values({
				businessId: profile.businessId,
				actorUserId: profile.authUserId,
				actorRole: profile.role,
				action: "admin.loyalty_program.updated",
				entityType: "loyalty_program",
				entityId: updated.id,
				oldValueJson: existing,
				newValueJson: updated,
				metadataJson: { locationIdsUpdated: Boolean(input.locationIds) },
			});

			return ok(c, { updated: true });
		},
	)

	.get("/rewards", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		await ensureMvpDefaults(db, c.env.BUSINESS_SLUG);
		const rows = await db
			.select()
			.from(rewardDefinitions)
			.where(eq(rewardDefinitions.businessId, profile.businessId))
			.orderBy(asc(rewardDefinitions.name));

		return ok<AdminRewardDefinitionsPayload>(c, {
			rewards: rows.map(toAdminRewardDefinition),
		});
	})

	.post("/rewards", validate("json", rewardDefinitionCreateSchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const input = c.req.valid("json");

		ensureRewardFieldCompatibility(input);

		if (input.welcomeReward) {
			const existingWelcome = await db.query.rewardDefinitions.findFirst({
				where: and(
					eq(rewardDefinitions.businessId, profile.businessId),
					eq(rewardDefinitions.welcomeReward, true),
				),
			});
			if (existingWelcome) {
				throw new ApiError(
					"conflict",
					"A welcome reward already exists. Disable it first.",
				);
			}
		}

		const [created] = await db
			.insert(rewardDefinitions)
			.values({
				businessId: profile.businessId,
				name: input.name,
				description: input.description ?? null,
				rewardType: input.rewardType,
				valueCents: input.valueCents ?? null,
				pointsCost: input.pointsCost ?? null,
				itemReference: input.itemReference ?? null,
				validDays: input.validDays ?? null,
				welcomeReward: input.welcomeReward,
				active: input.active,
				terms: input.terms ?? null,
			})
			.returning();

		if (!created) {
			throw new ApiError("internal_error", "Failed to create reward definition.");
		}

		await db.insert(auditLogs).values({
			businessId: profile.businessId,
			actorUserId: profile.authUserId,
			actorRole: profile.role,
			action: "admin.reward_definition.created",
			entityType: "reward_definition",
			entityId: created.id,
			newValueJson: created,
		});

		return ok<AdminRewardDefinition>(c, toAdminRewardDefinition(created), 201);
	})

	.patch(
		"/rewards/:rewardId",
		validate("json", rewardDefinitionUpdateSchema),
		async (c) => {
			const profile = c.get("profile");
			const db = getDb(c.env);
			const rewardId = c.req.param("rewardId");
			const input = c.req.valid("json");

			const existing = await db.query.rewardDefinitions.findFirst({
				where: and(
					eq(rewardDefinitions.id, rewardId),
					eq(rewardDefinitions.businessId, profile.businessId),
				),
			});
			if (!existing) {
				throw new ApiError("not_found", "That reward definition was not found.");
			}

			const nextType = input.rewardType ?? existing.rewardType;
			ensureRewardFieldCompatibility({
				rewardType: nextType,
				valueCents: input.valueCents ?? existing.valueCents,
				pointsCost: input.pointsCost ?? existing.pointsCost,
				itemReference: input.itemReference ?? existing.itemReference,
			});

			if (input.welcomeReward) {
				const existingWelcome = await db.query.rewardDefinitions.findFirst({
					where: and(
						eq(rewardDefinitions.businessId, profile.businessId),
						eq(rewardDefinitions.welcomeReward, true),
					),
				});
				if (existingWelcome && existingWelcome.id !== existing.id) {
					throw new ApiError(
						"conflict",
						"A welcome reward already exists. Disable it first.",
					);
				}
			}

			const [updated] = await db
				.update(rewardDefinitions)
				.set({
					name: input.name,
					description: input.description,
					rewardType: input.rewardType,
					valueCents: input.valueCents,
					pointsCost: input.pointsCost,
					itemReference: input.itemReference,
					validDays: input.validDays,
					welcomeReward: input.welcomeReward,
					active: input.active,
					terms: input.terms,
				})
				.where(eq(rewardDefinitions.id, existing.id))
				.returning();

			if (!updated) {
				throw new ApiError("internal_error", "Failed to update reward definition.");
			}

			await db.insert(auditLogs).values({
				businessId: profile.businessId,
				actorUserId: profile.authUserId,
				actorRole: profile.role,
				action: "admin.reward_definition.updated",
				entityType: "reward_definition",
				entityId: updated.id,
				oldValueJson: existing,
				newValueJson: updated,
			});

			return ok<AdminRewardDefinition>(c, toAdminRewardDefinition(updated));
		},
	)

	.delete("/rewards/:rewardId", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const rewardId = c.req.param("rewardId");

		const existing = await db.query.rewardDefinitions.findFirst({
			where: and(
				eq(rewardDefinitions.id, rewardId),
				eq(rewardDefinitions.businessId, profile.businessId),
			),
		});
		if (!existing) {
			throw new ApiError("not_found", "That reward definition was not found.");
		}

		if (existing.welcomeReward) {
			throw new ApiError(
				"conflict",
				"Welcome rewards cannot be deleted. Deactivate them instead.",
			);
		}

		const [usage] = await db
			.select({ value: count() })
			.from(customerRewards)
			.where(eq(customerRewards.rewardDefinitionId, existing.id));

		const [programUsage] = await db
			.select({ value: count() })
			.from(loyaltyPrograms)
			.where(
				and(
					eq(loyaltyPrograms.businessId, profile.businessId),
					eq(loyaltyPrograms.rewardDefinitionId, existing.id),
				),
			);

		if ((usage?.value ?? 0) > 0) {
			throw new ApiError(
				"conflict",
				"That reward has already been issued to customers and cannot be deleted.",
			);
		}

		if ((programUsage?.value ?? 0) > 0) {
			throw new ApiError(
				"conflict",
				"That reward is linked to a loyalty program and cannot be deleted.",
			);
		}

		await db.delete(rewardDefinitions).where(eq(rewardDefinitions.id, existing.id));

		await db.insert(auditLogs).values({
			businessId: profile.businessId,
			actorUserId: profile.authUserId,
			actorRole: profile.role,
			action: "admin.reward_definition.deleted",
			entityType: "reward_definition",
			entityId: existing.id,
			oldValueJson: existing,
		});

		return ok<{ deleted: true }>(c, { deleted: true });
	})

	.get("/transactions", validate("query", transactionsQuerySchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const query = c.req.valid("query");

		if (query.customerId) {
			const customer = await db.query.profiles.findFirst({
				where: and(
					eq(profiles.id, query.customerId),
					eq(profiles.businessId, profile.businessId),
				),
				columns: { id: true },
			});
			if (!customer) throw new ApiError("not_found", "Customer not found.");
		}

		if (query.staffId) {
			const staff = await db.query.profiles.findFirst({
				where: and(
					eq(profiles.id, query.staffId),
					eq(profiles.businessId, profile.businessId),
				),
				columns: { id: true },
			});
			if (!staff) throw new ApiError("not_found", "Staff member not found.");
		}

		if (query.locationId) {
			await requireLocationInBusiness(db, profile.businessId, query.locationId);
		}

		if (query.programId) {
			const program = await db.query.loyaltyPrograms.findFirst({
				where: and(
					eq(loyaltyPrograms.id, query.programId),
					eq(loyaltyPrograms.businessId, profile.businessId),
				),
				columns: { id: true },
			});
			if (!program) throw new ApiError("not_found", "Program not found.");
		}

		const payload = await buildAdminTransactions(db, profile.businessId, query);
		return ok<AdminTransactionsPayload>(c, payload);
	})

	.get("/reports", validate("query", reportsQuerySchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const query = c.req.valid("query");

		await ensureMvpDefaults(db, c.env.BUSINESS_SLUG);

		if (query.locationId) {
			await requireLocationInBusiness(db, profile.businessId, query.locationId);
		}

		const range = normalizeReportDateRange(query);
		const dayKeys = enumerateDays(range.from, range.to);

		const txWhere = and(
			eq(loyaltyTransactions.businessId, profile.businessId),
			query.locationId
				? eq(loyaltyTransactions.locationId, query.locationId)
				: undefined,
			gte(loyaltyTransactions.createdAt, range.from),
			lte(loyaltyTransactions.createdAt, range.toInclusive),
		);

		const issuedWhere = and(
			eq(customerRewards.businessId, profile.businessId),
			gte(customerRewards.issuedAt, range.from),
			lte(customerRewards.issuedAt, range.toInclusive),
		);

		const redeemedWhere = and(
			eq(customerRewards.businessId, profile.businessId),
			eq(customerRewards.status, "redeemed"),
			gte(customerRewards.redeemedAt, range.from),
			lte(customerRewards.redeemedAt, range.toInclusive),
			query.locationId
				? eq(customerRewards.locationId, query.locationId)
				: undefined,
		);

		const [
			[totalMembersRow],
			[newMembersRow],
			[coffeeTxRow],
			[coffeeQtyRow],
			[issuedRow],
			[redeemedRow],
			[outstandingRow],
			memberRows,
			coffeeRows,
			issuedRows,
			redeemedRows,
			staffRows,
		] = await Promise.all([
			db
				.select({ value: count() })
				.from(profiles)
				.where(
					and(
						eq(profiles.businessId, profile.businessId),
						eq(profiles.role, "customer"),
					),
				),
			db
				.select({ value: count() })
				.from(profiles)
				.where(
					and(
						eq(profiles.businessId, profile.businessId),
						eq(profiles.role, "customer"),
						gte(profiles.createdAt, range.from),
						lte(profiles.createdAt, range.toInclusive),
					),
				),
			db
				.select({ value: count() })
				.from(loyaltyTransactions)
				.where(and(txWhere, eq(loyaltyTransactions.transactionType, "earn"))),
			db
				.select({
					value: sql<number>`coalesce(sum(${loyaltyTransactions.quantity}), 0)`,
				})
				.from(loyaltyTransactions)
				.where(and(txWhere, eq(loyaltyTransactions.transactionType, "earn"))),
			db.select({ value: count() }).from(customerRewards).where(issuedWhere),
			db.select({ value: count() }).from(customerRewards).where(redeemedWhere),
			db
				.select({ value: count() })
				.from(customerRewards)
				.where(
					and(
						eq(customerRewards.businessId, profile.businessId),
						eq(customerRewards.status, "available"),
					),
				),
			db
				.select({ createdAt: profiles.createdAt })
				.from(profiles)
				.where(
					and(
						eq(profiles.businessId, profile.businessId),
						eq(profiles.role, "customer"),
						gte(profiles.createdAt, range.from),
						lte(profiles.createdAt, range.toInclusive),
					),
				),
			db
				.select({
					createdAt: loyaltyTransactions.createdAt,
					quantity: loyaltyTransactions.quantity,
				})
				.from(loyaltyTransactions)
				.where(and(txWhere, eq(loyaltyTransactions.transactionType, "earn"))),
			db
				.select({ issuedAt: customerRewards.issuedAt })
				.from(customerRewards)
				.where(issuedWhere),
			db
				.select({ redeemedAt: customerRewards.redeemedAt })
				.from(customerRewards)
				.where(redeemedWhere),
			db
				.select({
					staffId: loyaltyTransactions.staffId,
					transactionType: loyaltyTransactions.transactionType,
					quantity: loyaltyTransactions.quantity,
				})
				.from(loyaltyTransactions)
				.where(and(txWhere, sql`${loyaltyTransactions.staffId} is not null`)),
		]);

		const metrics: ReportSummaryMetrics = {
			totalMembers: totalMembersRow?.value ?? 0,
			newMembersInRange: newMembersRow?.value ?? 0,
			coffeeTransactions: coffeeTxRow?.value ?? 0,
			coffeesPurchased: coffeeQtyRow?.value ?? 0,
			rewardsIssued: issuedRow?.value ?? 0,
			rewardsRedeemed: redeemedRow?.value ?? 0,
			outstandingRewards: outstandingRow?.value ?? 0,
			redemptionRatePercent:
				(issuedRow?.value ?? 0) > 0
					? Math.round(((redeemedRow?.value ?? 0) / (issuedRow?.value ?? 0)) * 10_000) /
						100
					: 0,
		};

		const memberMap = new Map<string, number>();
		for (const row of memberRows) {
			const day = asDateKey(row.createdAt);
			memberMap.set(day, (memberMap.get(day) ?? 0) + 1);
		}

		const coffeeMap = new Map<string, number>();
		for (const row of coffeeRows) {
			const day = asDateKey(row.createdAt);
			coffeeMap.set(day, (coffeeMap.get(day) ?? 0) + row.quantity);
		}

		const issuedMap = new Map<string, number>();
		for (const row of issuedRows) {
			const day = asDateKey(row.issuedAt);
			issuedMap.set(day, (issuedMap.get(day) ?? 0) + 1);
		}

		const redeemedMap = new Map<string, number>();
		for (const row of redeemedRows) {
			if (!row.redeemedAt) continue;
			const day = asDateKey(row.redeemedAt);
			redeemedMap.set(day, (redeemedMap.get(day) ?? 0) + 1);
		}

		const staffIds = Array.from(
			new Set(
				staffRows
					.map((row) => row.staffId)
					.filter((value): value is string => typeof value === "string"),
			),
		);
		const staffProfiles =
			staffIds.length > 0
				? await db
					.select({
						id: profiles.id,
						fullName: profiles.fullName,
						role: profiles.role,
					})
					.from(profiles)
					.where(
						and(
							eq(profiles.businessId, profile.businessId),
							inArray(profiles.id, staffIds),
						),
					)
				: [];
		const staffProfileById = new Map(staffProfiles.map((row) => [row.id, row]));

		const staffActivityById = new Map<string, ReportStaffActivity>();
		for (const row of staffRows) {
			if (!row.staffId) continue;
			const staffProfile = staffProfileById.get(row.staffId);
			if (!staffProfile || !isStaffScopedRole(staffProfile.role)) continue;

			const current =
				staffActivityById.get(row.staffId) ??
				({
					staffId: row.staffId,
					staffName: staffProfile.fullName,
					staffRole: staffProfile.role,
					totalTransactions: 0,
					earnTransactions: 0,
					coffeesAdded: 0,
					redeemTransactions: 0,
					adjustmentTransactions: 0,
					reversalTransactions: 0,
				} satisfies ReportStaffActivity);

			current.totalTransactions += 1;
			if (row.transactionType === "earn") {
				current.earnTransactions += 1;
				current.coffeesAdded += row.quantity;
			}
			if (row.transactionType === "redeem") current.redeemTransactions += 1;
			if (row.transactionType === "adjustment") current.adjustmentTransactions += 1;
			if (row.transactionType === "reversal") current.reversalTransactions += 1;

			staffActivityById.set(row.staffId, current);
		}

		const payload: AdminReportsPayload = {
			from: range.from.toISOString(),
			to: range.to.toISOString(),
			locationId: query.locationId ?? null,
			metrics,
			newMembersOverTime: dayKeys.map((date) => ({
				date,
				value: memberMap.get(date) ?? 0,
			})),
			coffeePurchasesOverTime: dayKeys.map((date) => ({
				date,
				value: coffeeMap.get(date) ?? 0,
			})),
			rewardsIssuedOverTime: dayKeys.map((date) => ({
				date,
				value: issuedMap.get(date) ?? 0,
			})),
			rewardsRedeemedOverTime: dayKeys.map((date) => ({
				date,
				value: redeemedMap.get(date) ?? 0,
			})),
			staffActivity: Array.from(staffActivityById.values()).sort(
				(a, b) => b.totalTransactions - a.totalTransactions,
			),
		};

		return ok<AdminReportsPayload>(c, payload);
	})

	.get("/staff", validate("query", staffListQuerySchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const { search, limit, offset } = c.req.valid("query");
		await ensureMvpDefaults(db, c.env.BUSINESS_SLUG);

		const where = and(
			eq(profiles.businessId, profile.businessId),
			inArray(profiles.role, STAFF_ROLES),
			search
				? or(
						like(profiles.fullName, `%${search}%`),
						like(profiles.email, `%${search}%`),
						like(profiles.mobileNumber, `%${search}%`),
					)
				: undefined,
		);

		const [rows, [totals], locationRows] = await Promise.all([
			db
				.select()
				.from(profiles)
				.where(where)
				.orderBy(asc(profiles.role), asc(profiles.fullName))
				.limit(limit)
				.offset(offset),
			db.select({ value: count() }).from(profiles).where(where),
			db
				.select({ id: locations.id, name: locations.name, address: locations.address })
				.from(locations)
				.where(eq(locations.businessId, profile.businessId))
				.orderBy(asc(locations.name)),
		]);

		const settingsByStaffId = new Map<string, string | null>();
		for (const row of rows) {
			const key = `staff:${row.id}:assigned_location_id`;
			const setting = await getSettingValue(db, profile.businessId, key);
			settingsByStaffId.set(
				row.id,
				typeof setting?.valueJson === "string"
					? setting.valueJson
					: null,
			);
		}

		const locationMap = new Map(locationRows.map((row) => [row.id, row.name]));

		const staff: AdminStaffMember[] = rows.map((row) => {
			const assignedLocationId = settingsByStaffId.get(row.id) ?? null;
			return {
				id: row.id,
				fullName: row.fullName,
				email: row.email,
				mobileNumber: row.mobileNumber,
				role: row.role,
				active: row.active,
				assignedLocationId,
				assignedLocationName: assignedLocationId
					? locationMap.get(assignedLocationId) ?? null
					: null,
				createdAt: row.createdAt.toISOString(),
			};
		});

		return ok<AdminStaffListPayload>(c, {
			staff,
			total: totals?.value ?? 0,
			limit,
			offset,
			locations: locationRows,
		});
	})

	.post("/staff", validate("json", staffCreateSchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const input = c.req.valid("json");
		await ensureMvpDefaults(db, c.env.BUSINESS_SLUG);

		if (input.role === "admin" && profile.role !== "owner") {
			throw new ApiError(
				"forbidden",
				"Only owners can create admin staff profiles.",
			);
		}

		if (input.assignedLocationId) {
			await requireLocationInBusiness(db, profile.businessId, input.assignedLocationId);
		}

		const normalizedEmail = input.email.trim().toLowerCase();
		const authMatch = await db.query.user.findFirst({
			where: sql`lower(${user.email}) = ${normalizedEmail}`,
			columns: { id: true, name: true, email: true },
		});

		let target = await db.query.profiles.findFirst({
			where: and(
				eq(profiles.businessId, profile.businessId),
				sql`lower(${profiles.email}) = ${normalizedEmail}`,
			),
		});

		if (!target && authMatch) {
			const [createdProfile] = await db
				.insert(profiles)
				.values({
					authUserId: authMatch.id,
					businessId: profile.businessId,
					fullName: input.fullName || authMatch.name || authMatch.email,
					email: authMatch.email,
					mobileNumber: input.mobileNumber ?? null,
					role: "customer",
					active: true,
				})
				.onConflictDoNothing()
				.returning();

			target =
				createdProfile ??
				(await db.query.profiles.findFirst({
					where: and(
						eq(profiles.businessId, profile.businessId),
						eq(profiles.authUserId, authMatch.id),
					),
				}));
		}

		if (!target) {
			throw new ApiError(
				"validation_failed",
				"No account exists for this email yet. Ask the user to sign up first, then assign staff access.",
			);
		}

		if (target.role === "owner" && profile.role !== "owner") {
			throw new ApiError("forbidden", "Only owners can modify owner profiles.");
		}

		const [updated] = await db
			.update(profiles)
			.set({
				fullName: input.fullName,
				email: input.email,
				mobileNumber: input.mobileNumber ?? null,
				role: input.role,
				active: input.active,
				updatedAt: new Date(),
			})
			.where(eq(profiles.id, target.id))
			.returning();

		if (!updated) {
			throw new ApiError("internal_error", "Failed to update staff profile.");
		}

		const locationSettingKey = `staff:${updated.id}:assigned_location_id`;
		if (input.assignedLocationId) {
			await upsertSettingValue(
				db,
				profile.businessId,
				locationSettingKey,
				input.assignedLocationId,
			);
		} else {
			const current = await getSettingValue(db, profile.businessId, locationSettingKey);
			if (current) {
				await db.delete(appSettings).where(eq(appSettings.id, current.id));
			}
		}

		await db.insert(auditLogs).values({
			businessId: profile.businessId,
			actorUserId: profile.authUserId,
			actorRole: profile.role,
			action: "admin.staff.assigned",
			entityType: "profile",
			entityId: updated.id,
			oldValueJson: target,
			newValueJson: updated,
			metadataJson: {
				assignedLocationId: input.assignedLocationId ?? null,
				authLinked: Boolean(authMatch),
			},
		});

		return ok<AdminStaffMember>(
			c,
			{
				id: updated.id,
				fullName: updated.fullName,
				email: updated.email,
				mobileNumber: updated.mobileNumber,
				role: updated.role,
				active: updated.active,
				assignedLocationId: input.assignedLocationId ?? null,
				assignedLocationName: null,
				createdAt: updated.createdAt.toISOString(),
			},
			201,
		);
	})

	.patch("/staff/:staffId", validate("json", staffUpdateSchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const staffId = c.req.param("staffId");
		const input = c.req.valid("json");
		await ensureMvpDefaults(db, c.env.BUSINESS_SLUG);

		const existing = await db.query.profiles.findFirst({
			where: and(
				eq(profiles.id, staffId),
				eq(profiles.businessId, profile.businessId),
				inArray(profiles.role, STAFF_ROLES),
			),
		});
		if (!existing) {
			throw new ApiError("not_found", "That staff profile was not found.");
		}

		if (input.role && input.role !== existing.role) {
			if (!isStaffScopedRole(existing.role)) {
				throw new ApiError("forbidden", "That role cannot be updated here.");
			}
			const elevating = isRoleElevation(existing.role, input.role);
			if (elevating && profile.role !== "owner") {
				throw new ApiError(
					"forbidden",
					"Only owners can elevate staff roles.",
				);
			}
		}

		if (input.assignedLocationId) {
			await requireLocationInBusiness(db, profile.businessId, input.assignedLocationId);
		}

		const [updated] = await db
			.update(profiles)
			.set({
				fullName: input.fullName,
				email: input.email,
				mobileNumber: input.mobileNumber,
				role: input.role,
				active: input.active,
			})
			.where(eq(profiles.id, existing.id))
			.returning();

		if (!updated) {
			throw new ApiError("internal_error", "Failed to update staff profile.");
		}

		if (input.assignedLocationId !== undefined) {
			const key = `staff:${updated.id}:assigned_location_id`;
			const setting = await getSettingValue(db, profile.businessId, key);
			if (input.assignedLocationId === null) {
				if (setting) {
					await db.delete(appSettings).where(eq(appSettings.id, setting.id));
				}
			} else if (setting) {
				await db
					.update(appSettings)
					.set({ valueJson: input.assignedLocationId })
					.where(eq(appSettings.id, setting.id));
			} else {
				await db.insert(appSettings).values({
					businessId: profile.businessId,
					key,
					valueJson: input.assignedLocationId,
				});
			}
		}

		await db.insert(auditLogs).values({
			businessId: profile.businessId,
			actorUserId: profile.authUserId,
			actorRole: profile.role,
			action: "admin.staff.updated",
			entityType: "profile",
			entityId: updated.id,
			oldValueJson: existing,
			newValueJson: updated,
			metadataJson: { assignedLocationUpdated: input.assignedLocationId !== undefined },
		});

		return ok<{ updated: true }>(c, { updated: true });
	})

	.get("/audit", validate("query", auditListQuerySchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const query = c.req.valid("query");
		const toInclusive = query.to
			? new Date(query.to.getTime() + 86_399_999)
			: undefined;

		const where = and(
			eq(auditLogs.businessId, profile.businessId),
			query.action ? like(auditLogs.action, `%${query.action}%`) : undefined,
			query.entityType
				? like(auditLogs.entityType, `%${query.entityType}%`)
				: undefined,
			query.actorRole ? eq(auditLogs.actorRole, query.actorRole) : undefined,
			query.entityId ? eq(auditLogs.entityId, query.entityId) : undefined,
			query.from ? gte(auditLogs.createdAt, query.from) : undefined,
			toInclusive ? lte(auditLogs.createdAt, toInclusive) : undefined,
		);

		const [rows, [totals]] = await Promise.all([
			db
				.select({
					id: auditLogs.id,
					createdAt: auditLogs.createdAt,
					actorUserId: auditLogs.actorUserId,
					actorRole: auditLogs.actorRole,
					action: auditLogs.action,
					entityType: auditLogs.entityType,
					entityId: auditLogs.entityId,
					oldValueJson: auditLogs.oldValueJson,
					newValueJson: auditLogs.newValueJson,
					metadataJson: auditLogs.metadataJson,
				})
				.from(auditLogs)
				.where(where)
				.orderBy(desc(auditLogs.createdAt))
				.limit(query.limit)
				.offset(query.offset),
			db.select({ value: count() }).from(auditLogs).where(where),
		]);

		const actorUserIds = Array.from(
			new Set(rows.map((row) => row.actorUserId).filter((value) => value.length > 0)),
		);
		const actorRows =
			actorUserIds.length > 0
				? await db
					.select({ authUserId: profiles.authUserId, fullName: profiles.fullName })
					.from(profiles)
					.where(
						and(
							eq(profiles.businessId, profile.businessId),
							inArray(profiles.authUserId, actorUserIds),
						),
					)
				: [];
		const actorNameByAuthUserId = new Map(
			actorRows.map((row) => [row.authUserId, row.fullName]),
		);

		return ok<AdminAuditLogsPayload>(c, {
			entries: rows.map(
				(row): AdminAuditLogEntry => ({
					id: row.id,
					createdAt: row.createdAt.toISOString(),
					actorUserId: row.actorUserId,
					actorName: actorNameByAuthUserId.get(row.actorUserId) ?? null,
					actorRole: row.actorRole,
					action: row.action,
					entityType: row.entityType,
					entityId: row.entityId,
					oldValueJson: row.oldValueJson,
					newValueJson: row.newValueJson,
					metadataJson: row.metadataJson,
				}),
			),
			total: totals?.value ?? 0,
			limit: query.limit,
			offset: query.offset,
		});
	})

	.get("/settings", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		await ensureMvpDefaults(db, c.env.BUSINESS_SLUG);

		const [welcomeSetting, ttlSetting] = await Promise.all([
			getSettingValue(db, profile.businessId, SETTINGS_WELCOME_REWARD_KEY),
			getSettingValue(db, profile.businessId, SETTINGS_CODE_TTL_KEY),
		]);

		const payload: AdminSettingsPayload = {
			welcomeRewardEnabled:
				typeof welcomeSetting?.valueJson === "boolean"
					? welcomeSetting.valueJson
					: true,
			loyaltyCodeTtlSeconds:
				typeof ttlSetting?.valueJson === "number" ? ttlSetting.valueJson : 600,
		};

		return ok<AdminSettingsPayload>(c, payload);
	})

	.patch("/settings", validate("json", settingsUpdateSchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const input: AdminSettingsUpdateInput = c.req.valid("json");
		await ensureMvpDefaults(db, c.env.BUSINESS_SLUG);

		const previous = await Promise.all([
			getSettingValue(db, profile.businessId, SETTINGS_WELCOME_REWARD_KEY),
			getSettingValue(db, profile.businessId, SETTINGS_CODE_TTL_KEY),
		]);

		if (input.welcomeRewardEnabled !== undefined) {
			await upsertSettingValue(
				db,
				profile.businessId,
				SETTINGS_WELCOME_REWARD_KEY,
				input.welcomeRewardEnabled,
			);
		}

		if (input.loyaltyCodeTtlSeconds !== undefined) {
			await upsertSettingValue(
				db,
				profile.businessId,
				SETTINGS_CODE_TTL_KEY,
				input.loyaltyCodeTtlSeconds,
			);
		}

		const [welcomeSetting, ttlSetting] = await Promise.all([
			getSettingValue(db, profile.businessId, SETTINGS_WELCOME_REWARD_KEY),
			getSettingValue(db, profile.businessId, SETTINGS_CODE_TTL_KEY),
		]);

		const payload: AdminSettingsPayload = {
			welcomeRewardEnabled:
				typeof welcomeSetting?.valueJson === "boolean"
					? welcomeSetting.valueJson
					: true,
			loyaltyCodeTtlSeconds:
				typeof ttlSetting?.valueJson === "number" ? ttlSetting.valueJson : 600,
		};

		await db.insert(auditLogs).values({
			businessId: profile.businessId,
			actorUserId: profile.authUserId,
			actorRole: profile.role,
			action: "admin.settings.updated",
			entityType: "app_settings",
			entityId: SETTINGS_WELCOME_REWARD_KEY,
			oldValueJson: {
				welcomeRewardEnabled:
					typeof previous[0]?.valueJson === "boolean"
						? previous[0].valueJson
						: true,
				loyaltyCodeTtlSeconds:
					typeof previous[1]?.valueJson === "number" ? previous[1].valueJson : 600,
			},
			newValueJson: payload,
		});

		return ok<AdminSettingsPayload>(c, payload);
	})

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
					menuGroup: input.menuGroup,
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
						menuGroup: input.menuGroup,
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
					existing.imageKey !== updated.imageKey &&
					!(await isImageKeyStillInUse(db, profile.businessId, existing.imageKey))
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
		const db = getDb(c.env);

		const where = and(
			eq(menuItems.businessId, businessId),
			categoryId ? eq(menuItems.categoryId, categoryId) : undefined,
		);

		const rows = await db
			.select()
			.from(menuItems)
			.where(where)
			.orderBy(asc(menuItems.sortOrder), asc(menuItems.name));

		const itemIds = rows.map((item) => item.id);
		const variantRows =
			itemIds.length === 0
				? []
				: await db
					.select()
					.from(menuItemVariants)
					.where(inArray(menuItemVariants.menuItemId, itemIds))
					.orderBy(
						asc(menuItemVariants.sortOrder),
						asc(menuItemVariants.name),
					);

		const variantsByItemId = new Map<string, AdminMenuItemVariant[]>();
		for (const row of variantRows) {
			const list = variantsByItemId.get(row.menuItemId) ?? [];
			list.push(toAdminVariant(row));
			variantsByItemId.set(row.menuItemId, list);
		}

		return ok<AdminMenuItemsPayload>(c, {
			items: rows.map((item) => toAdminItem(item, variantsByItemId.get(item.id) ?? [])),
		});
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

		try {
			const created = await db.transaction(async (tx) => {
				const [item] = await tx
					.insert(menuItems)
					.values({
						businessId: profile.businessId,
						categoryId: category.id,
						name: input.name,
						description: input.description,
						optionNotes: input.optionNotes ?? "",
						priceCents: input.priceCents,
						imageKey: input.imageKey ?? null,
						active: input.active,
						available: input.available,
						popular: input.popular,
						vegetarian: input.vegetarian,
						spicy: input.spicy,
						isNew: input.isNew,
						subjectToAvailability: input.subjectToAvailability,
						sortOrder: input.sortOrder,
					})
					.returning();

				if (!item) {
					throw new ApiError("internal_error", "Failed to create menu item.");
				}

				if (input.variants.length > 0) {
					await tx.insert(menuItemVariants).values(
						input.variants.map((variant) => ({
							menuItemId: item.id,
							name: variant.name,
							priceCents: variant.priceCents,
							sortOrder: variant.sortOrder,
							active: variant.active,
						})),
					);
				}

				const variants = await tx
					.select()
					.from(menuItemVariants)
					.where(eq(menuItemVariants.menuItemId, item.id))
					.orderBy(asc(menuItemVariants.sortOrder), asc(menuItemVariants.name));

				return toAdminItem(item, variants.map(toAdminVariant));
			});

			return ok<AdminMenuItem>(c, created, 201);
		} catch (error) {
			rethrowAsConflict(
				error,
				"Could not save this item. Check duplicate names or variants.",
			);
		}
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

		try {
			const updated = await db.transaction(async (tx) => {
				const [row] = await tx
					.update(menuItems)
					.set({
						categoryId: input.categoryId,
						name: input.name,
						description: input.description,
						optionNotes:
							input.optionNotes === null ? "" : input.optionNotes,
						priceCents: input.priceCents,
						imageKey: input.imageKey,
						active: input.active,
						available: input.available,
						popular: input.popular,
						vegetarian: input.vegetarian,
						spicy: input.spicy,
						isNew: input.isNew,
						subjectToAvailability: input.subjectToAvailability,
						sortOrder: input.sortOrder,
					})
					.where(eq(menuItems.id, existing.id))
					.returning();

				if (!row) {
					throw new ApiError("internal_error", "Failed to update menu item.");
				}

				if (input.variants !== undefined) {
					await tx
						.delete(menuItemVariants)
						.where(eq(menuItemVariants.menuItemId, existing.id));

					if (input.variants.length > 0) {
						await tx.insert(menuItemVariants).values(
							input.variants.map((variant) => ({
								menuItemId: existing.id,
								name: variant.name,
								priceCents: variant.priceCents,
								sortOrder: variant.sortOrder,
								active: variant.active,
							})),
						);
					}
				}

				const variants = await tx
					.select()
					.from(menuItemVariants)
					.where(eq(menuItemVariants.menuItemId, existing.id))
					.orderBy(asc(menuItemVariants.sortOrder), asc(menuItemVariants.name));

				return {
					item: row,
					variants: variants.map(toAdminVariant),
				};
			});

			if (
				input.imageKey !== undefined &&
				existing.imageKey &&
				existing.imageKey !== updated.item.imageKey &&
				!(await isImageKeyStillInUse(db, profile.businessId, existing.imageKey))
			) {
				await deleteMenuImageSafe(c.env.MEDIA, existing.imageKey);
			}

			return ok<AdminMenuItem>(
				c,
				toAdminItem(updated.item, updated.variants),
			);
		} catch (error) {
			rethrowAsConflict(
				error,
				"Could not update this item. Check duplicate names or variants.",
			);
		}
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

		if (await isImageKeyStillInUse(db, profile.businessId, imageKey)) {
			throw new ApiError(
				"conflict",
				"That image is still in use. Remove it from records before deleting.",
			);
		}

		await deleteMenuImageSafe(c.env.MEDIA, imageKey);
		return ok<MenuImageDeletePayload>(c, { deleted: true });
	})

	.get("/promotions", async (c) => {
		const profile = c.get("profile");
		const rows = await getDb(c.env)
			.select()
			.from(promotions)
			.where(eq(promotions.businessId, profile.businessId))
			.orderBy(desc(promotions.startAt), desc(promotions.createdAt));

		return ok<AdminPromotionsPayload>(c, {
			promotions: rows.map(toAdminPromotion),
		});
	})

	.post("/promotions", validate("json", createPromotionSchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const input = c.req.valid("json");

		assertCtaPair(input.ctaText, input.ctaUrl);
		if (input.imageKey) {
			assertOwnedPromotionsMediaKey(profile.businessId, input.imageKey);
		}

		const [created] = await db
			.insert(promotions)
			.values({
				businessId: profile.businessId,
				title: input.title,
				subtitle: input.subtitle ?? null,
				description: input.description ?? null,
				imageKey: input.imageKey ?? null,
				startAt: input.startAt,
				endAt: input.endAt,
				active: input.active,
				ctaText: input.ctaText ?? null,
				ctaUrl: input.ctaUrl ?? null,
			})
			.returning();

		if (!created) {
			throw new ApiError("internal_error", "Failed to create promotion.");
		}

		return ok<AdminPromotion>(c, toAdminPromotion(created), 201);
	})

	.patch(
		"/promotions/:promotionId",
		validate("json", updatePromotionSchema),
		async (c) => {
			const profile = c.get("profile");
			const db = getDb(c.env);
			const promotionId = c.req.param("promotionId");
			const input = c.req.valid("json");

			const existing = await db.query.promotions.findFirst({
				where: and(
					eq(promotions.id, promotionId),
					eq(promotions.businessId, profile.businessId),
				),
			});
			if (!existing) {
				throw new ApiError("not_found", "That promotion was not found.");
			}

			const nextStartAt = input.startAt ?? existing.startAt;
			const nextEndAt = input.endAt ?? existing.endAt;
			if (nextEndAt.getTime() <= nextStartAt.getTime()) {
				throw new ApiError(
					"validation_failed",
					"Promotion end time must be after start time.",
				);
			}

			const nextCtaText =
				input.ctaText === undefined ? existing.ctaText : input.ctaText;
			const nextCtaUrl = input.ctaUrl === undefined ? existing.ctaUrl : input.ctaUrl;
			assertCtaPair(nextCtaText, nextCtaUrl);

			if (input.imageKey) {
				assertOwnedPromotionsMediaKey(profile.businessId, input.imageKey);
			}

			const [updated] = await db
				.update(promotions)
				.set({
					title: input.title,
					subtitle: input.subtitle,
					description: input.description,
					imageKey: input.imageKey,
					startAt: input.startAt,
					endAt: input.endAt,
					active: input.active,
					ctaText: input.ctaText,
					ctaUrl: input.ctaUrl,
				})
				.where(eq(promotions.id, existing.id))
				.returning();

			if (!updated) {
				throw new ApiError("internal_error", "Failed to update promotion.");
			}

			if (
				input.imageKey !== undefined &&
				existing.imageKey &&
				existing.imageKey !== updated.imageKey &&
				!(await isImageKeyStillInUse(db, profile.businessId, existing.imageKey))
			) {
				await deleteMenuImageSafe(c.env.MEDIA, existing.imageKey);
			}

			return ok<AdminPromotion>(c, toAdminPromotion(updated));
		},
	)

	.delete("/promotions/:promotionId", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const promotionId = c.req.param("promotionId");

		const existing = await db.query.promotions.findFirst({
			where: and(
				eq(promotions.id, promotionId),
				eq(promotions.businessId, profile.businessId),
			),
		});
		if (!existing) {
			throw new ApiError("not_found", "That promotion was not found.");
		}

		if (existing.active && existing.endAt.getTime() > Date.now()) {
			throw new ApiError(
				"conflict",
				"Deactivate or expire the promotion before deleting it.",
			);
		}

		await db.delete(promotions).where(eq(promotions.id, existing.id));

		if (
			existing.imageKey &&
			!(await isImageKeyStillInUse(db, profile.businessId, existing.imageKey))
		) {
			await deleteMenuImageSafe(c.env.MEDIA, existing.imageKey);
		}

		return ok<{ deleted: true }>(c, { deleted: true });
	})

	.post("/promotions/media/upload", async (c) => {
		const profile = c.get("profile");
		const form = await c.req.formData();
		const file = form.get("file");
		if (!(file instanceof File)) {
			throw new ApiError("validation_failed", "Please attach an image file.");
		}

		const uploaded = await putPromotionImage(c.env.MEDIA, profile.businessId, file);
		return ok<PromotionImageUploadPayload>(c, uploaded, 201);
	})

	.post(
		"/promotions/media/delete",
		validate("json", deleteMediaSchema),
		async (c) => {
			const profile = c.get("profile");
			const db = getDb(c.env);
			const { imageKey } = c.req.valid("json");

			assertOwnedPromotionsMediaKey(profile.businessId, imageKey);

			if (await isImageKeyStillInUse(db, profile.businessId, imageKey)) {
				throw new ApiError(
					"conflict",
					"That image is still in use. Remove it from records before deleting.",
				);
			}

			await deleteMenuImageSafe(c.env.MEDIA, imageKey);
			return ok<PromotionImageDeletePayload>(c, { deleted: true });
		},
	);
