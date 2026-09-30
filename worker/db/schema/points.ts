import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
	POINTS_AWARD_SOURCES,
	POINTS_PROMOTION_TYPES,
} from "../../../shared/points";
import { createdAt, flag, json, pk, updatedAt } from "./_columns";
import { billEvents } from "./bills";
import { businesses, locations } from "./business";
import { loyaltyPrograms, loyaltyTransactions } from "./loyalty";
import { profiles } from "./profiles";
import { customerRewards, rewardDefinitions } from "./rewards";

export const pointsPromotions = sqliteTable(
	"points_promotions",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		promotionType: text("promotion_type", { enum: POINTS_PROMOTION_TYPES }).notNull(),
		multiplierBp: integer("multiplier_bp"),
		fixedBonusPoints: integer("fixed_bonus_points"),
		minEligibleSpendCents: integer("min_eligible_spend_cents"),
		startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
		endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
		enabled: flag("enabled").notNull().default(true),
		archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		index("points_promotions_window_idx").on(
			t.businessId,
			t.enabled,
			t.startAt,
			t.endAt,
		),
		index("points_promotions_archived_idx").on(t.businessId, t.archivedAt),
		check("points_promotions_window_chk", sql`${t.endAt} > ${t.startAt}`),
		check(
			"points_promotions_multiplier_chk",
			sql`${t.promotionType} <> 'multiplier' OR (${t.multiplierBp} IS NOT NULL AND ${t.multiplierBp} > 10000)`,
		),
		check(
			"points_promotions_bonus_chk",
			sql`${t.promotionType} <> 'fixed_bonus' OR (${t.fixedBonusPoints} IS NOT NULL AND ${t.fixedBonusPoints} > 0)`,
		),
		check(
			"points_promotions_min_spend_chk",
			sql`${t.minEligibleSpendCents} IS NULL OR ${t.minEligibleSpendCents} >= 0`,
		),
	],
);

export const pointsAwards = sqliteTable(
	"points_awards",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		programId: text("program_id")
			.notNull()
			.references(() => loyaltyPrograms.id, { onDelete: "restrict" }),
		customerId: text("customer_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "restrict" }),
		billEventId: text("bill_event_id").references(() => billEvents.id, {
			onDelete: "set null",
		}),
		locationId: text("location_id")
			.notNull()
			.references(() => locations.id, { onDelete: "restrict" }),
		staffId: text("staff_id").references(() => profiles.id, { onDelete: "restrict" }),
		source: text("source", { enum: POINTS_AWARD_SOURCES }).notNull().default("staff_manual"),
		eligibleSpendCents: integer("eligible_spend_cents").notNull(),
		ratePoints: integer("rate_points").notNull(),
		rateSpendCents: integer("rate_spend_cents").notNull(),
		basePoints: integer("base_points").notNull(),
		bonusPoints: integer("bonus_points").notNull().default(0),
		totalPoints: integer("total_points").notNull(),
		multiplierPromotionId: text("multiplier_promotion_id").references(
			() => pointsPromotions.id,
			{ onDelete: "restrict" },
		),
		multiplierPromotionName: text("multiplier_promotion_name"),
		appliedMultiplierBp: integer("applied_multiplier_bp"),
		bonusPromotionId: text("bonus_promotion_id").references(
			() => pointsPromotions.id,
			{ onDelete: "restrict" },
		),
		bonusPromotionName: text("bonus_promotion_name"),
		appliedFixedBonusPoints: integer("applied_fixed_bonus_points"),
		billReference: text("bill_reference").notNull(),
		billReferenceKey: text("bill_reference_key").notNull(),
		businessDay: text("business_day").notNull(),
		dedupeGuardKey: text("dedupe_guard_key"),
		releasedGuardKey: text("released_guard_key"),
		duplicateOverride: flag("duplicate_override").notNull().default(false),
		duplicateOverrideReason: text("duplicate_override_reason"),
		duplicateOverrideBy: text("duplicate_override_by").references(() => profiles.id, {
			onDelete: "restrict",
		}),
		requestIdempotencyKey: text("request_idempotency_key").notNull(),
		reversedAt: integer("reversed_at", { mode: "timestamp_ms" }),
		reversedBy: text("reversed_by").references(() => profiles.id, {
			onDelete: "restrict",
		}),
		reversalReason: text("reversal_reason"),
		calculationJson: json("calculation_json"),
		createdAt: createdAt(),
	},
	(t) => [
		uniqueIndex("points_awards_dedupe_guard_unq").on(t.dedupeGuardKey),
		uniqueIndex("points_awards_request_idem_unq").on(
			t.businessId,
			t.requestIdempotencyKey,
		),
		index("points_awards_customer_idx").on(t.customerId, t.createdAt),
		index("points_awards_business_created_idx").on(t.businessId, t.createdAt),
		index("points_awards_bill_event_idx").on(t.billEventId),
		index("points_awards_staff_idx").on(t.staffId),
		index("points_awards_location_day_idx").on(t.locationId, t.businessDay),
		index("points_awards_mult_promo_idx").on(t.multiplierPromotionId),
		index("points_awards_bonus_promo_idx").on(t.bonusPromotionId),
		check(
			"points_awards_total_chk",
			sql`${t.totalPoints} = ${t.basePoints} + ${t.bonusPoints}`,
		),
		check(
			"points_awards_positive_chk",
			sql`${t.eligibleSpendCents} > 0 AND ${t.ratePoints} > 0 AND ${t.rateSpendCents} > 0 AND ${t.basePoints} >= 0 AND ${t.bonusPoints} >= 0 AND ${t.totalPoints} > 0`,
		),
		check(
			"points_awards_override_chk",
			sql`${t.duplicateOverride} = 0 OR (${t.duplicateOverrideReason} IS NOT NULL AND ${t.duplicateOverrideBy} IS NOT NULL)`,
		),
	],
);

export const pointsCatalogueItems = sqliteTable(
	"points_catalogue_items",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		rewardDefinitionId: text("reward_definition_id")
			.notNull()
			.references(() => rewardDefinitions.id, { onDelete: "restrict" }),
		pointsCost: integer("points_cost").notNull(),
		active: flag("active").notNull().default(true),
		archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
		sortOrder: integer("sort_order").notNull().default(0),
		imageKey: text("image_key"),
		maxPerCustomerPerPeriod: integer("max_per_customer_per_period"),
		limitPeriodDays: integer("limit_period_days"),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		uniqueIndex("points_catalogue_reward_unq").on(t.businessId, t.rewardDefinitionId),
		index("points_catalogue_listing_idx").on(t.businessId, t.active, t.sortOrder),
		check("points_catalogue_cost_chk", sql`${t.pointsCost} > 0`),
		check(
			"points_catalogue_limit_chk",
			sql`(${t.maxPerCustomerPerPeriod} IS NULL OR ${t.maxPerCustomerPerPeriod} > 0) AND (${t.limitPeriodDays} IS NULL OR ${t.limitPeriodDays} > 0)`,
		),
	],
);

export const pointsRedemptions = sqliteTable(
	"points_redemptions",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		programId: text("program_id")
			.notNull()
			.references(() => loyaltyPrograms.id, { onDelete: "restrict" }),
		customerId: text("customer_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "restrict" }),
		catalogueItemId: text("catalogue_item_id")
			.notNull()
			.references(() => pointsCatalogueItems.id, { onDelete: "restrict" }),
		rewardDefinitionId: text("reward_definition_id")
			.notNull()
			.references(() => rewardDefinitions.id, { onDelete: "restrict" }),
		catalogueItemName: text("catalogue_item_name").notNull(),
		pointsCost: integer("points_cost").notNull(),
		ledgerTransactionId: text("ledger_transaction_id")
			.notNull()
			.references(() => loyaltyTransactions.id, { onDelete: "restrict" }),
		customerRewardId: text("customer_reward_id")
			.notNull()
			.references(() => customerRewards.id, { onDelete: "restrict" }),
		requestIdempotencyKey: text("request_idempotency_key").notNull(),
		createdAt: createdAt(),
	},
	(t) => [
		uniqueIndex("points_redemptions_request_unq").on(
			t.businessId,
			t.customerId,
			t.requestIdempotencyKey,
		),
		uniqueIndex("points_redemptions_ledger_unq").on(t.ledgerTransactionId),
		uniqueIndex("points_redemptions_reward_unq").on(t.customerRewardId),
		index("points_redemptions_customer_idx").on(t.customerId, t.createdAt),
		index("points_redemptions_item_idx").on(t.catalogueItemId),
		check("points_redemptions_cost_chk", sql`${t.pointsCost} > 0`),
	],
);
