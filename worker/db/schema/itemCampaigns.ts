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
	ITEM_CAMPAIGN_STATUSES,
	ITEM_CAMPAIGN_TRANSACTION_TYPES,
} from "../../../shared/itemCampaigns";
import { createdAt, flag, pk, timestampMs, updatedAt } from "./_columns";
import { billEvents } from "./bills";
import { businesses, locations } from "./business";
import { profiles } from "./profiles";
import { rewardDefinitions, customerRewards } from "./rewards";

export const itemCampaigns = sqliteTable(
	"item_campaigns",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		itemReference: text("item_reference").notNull(),
		itemReferenceKey: text("item_reference_key").notNull(),
		activeItemKey: text("active_item_key"),
		unitPriceCents: integer("unit_price_cents").notNull(),
		targetQuantity: integer("target_quantity").notNull(),
		rewardDefinitionId: text("reward_definition_id")
			.notNull()
			.references(() => rewardDefinitions.id, { onDelete: "restrict" }),
		earnsRewardPoints: flag("earns_reward_points").notNull().default(false),
		status: text("status", { enum: ITEM_CAMPAIGN_STATUSES })
			.notNull()
			.default("active"),
		startAt: timestampMs("start_at"),
		endAt: timestampMs("end_at"),
		maxQuantityPerBill: integer("max_quantity_per_bill"),
		sortOrder: integer("sort_order").notNull().default(0),
		archivedAt: timestampMs("archived_at"),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		uniqueIndex("item_campaigns_active_item_unq").on(t.businessId, t.activeItemKey),
		index("item_campaigns_listing_idx").on(t.businessId, t.status, t.sortOrder),
		index("item_campaigns_reward_idx").on(t.rewardDefinitionId),
		check("item_campaigns_price_chk", sql`${t.unitPriceCents} > 0`),
		check(
			"item_campaigns_target_chk",
			sql`${t.targetQuantity} >= 2 AND ${t.targetQuantity} <= 1000`,
		),
		check(
			"item_campaigns_max_qty_chk",
			sql`${t.maxQuantityPerBill} IS NULL OR (${t.maxQuantityPerBill} > 0 AND ${t.maxQuantityPerBill} <= 500)`,
		),
		check(
			"item_campaigns_window_chk",
			sql`${t.startAt} IS NULL OR ${t.endAt} IS NULL OR ${t.endAt} > ${t.startAt}`,
		),
		check(
			"item_campaigns_archive_chk",
			sql`(${t.status} = 'archived' AND ${t.archivedAt} IS NOT NULL AND ${t.activeItemKey} IS NULL) OR (${t.status} <> 'archived' AND ${t.archivedAt} IS NULL AND ${t.activeItemKey} IS NOT NULL)`,
		),
	],
);

export const itemCampaignTransactions = sqliteTable(
	"item_campaign_transactions",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		campaignId: text("campaign_id")
			.notNull()
			.references(() => itemCampaigns.id, { onDelete: "restrict" }),
		customerId: text("customer_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "restrict" }),
		locationId: text("location_id")
			.notNull()
			.references(() => locations.id, { onDelete: "restrict" }),
		staffId: text("staff_id").references(() => profiles.id, { onDelete: "restrict" }),
		billEventId: text("bill_event_id")
			.notNull()
			.references(() => billEvents.id, { onDelete: "restrict" }),
		transactionType: text("transaction_type", {
			enum: ITEM_CAMPAIGN_TRANSACTION_TYPES,
		}).notNull(),
		quantity: integer("quantity").notNull(),
		unitPriceCents: integer("unit_price_cents").notNull(),
		campaignSpendCents: integer("campaign_spend_cents").notNull(),
		earnsRewardPoints: flag("earns_reward_points").notNull(),
		campaignNameSnapshot: text("campaign_name_snapshot").notNull(),
		itemReferenceSnapshot: text("item_reference_snapshot").notNull(),
		billReference: text("bill_reference"),
		reason: text("reason"),
		approvedBy: text("approved_by").references(() => profiles.id, {
			onDelete: "restrict",
		}),
		idempotencyKey: text("idempotency_key").notNull(),
		relatedTransactionId: text("related_transaction_id"),
		createdAt: createdAt(),
	},
	(t) => [
		uniqueIndex("item_campaign_tx_idem_unq").on(t.idempotencyKey),
		uniqueIndex("item_campaign_tx_bill_campaign_type_unq").on(
			t.billEventId,
			t.campaignId,
			t.transactionType,
		),
		index("item_campaign_tx_progress_idx").on(
			t.customerId,
			t.campaignId,
			t.createdAt,
		),
		index("item_campaign_tx_campaign_created_idx").on(t.campaignId, t.createdAt),
		index("item_campaign_tx_business_created_idx").on(t.businessId, t.createdAt),
		index("item_campaign_tx_bill_idx").on(t.billEventId),
		check("item_campaign_tx_qty_non_zero_chk", sql`${t.quantity} <> 0`),
		check("item_campaign_tx_price_non_negative_chk", sql`${t.unitPriceCents} >= 0`),
		check(
			"item_campaign_tx_type_qty_chk",
			sql`(${t.transactionType} = 'purchase' AND ${t.quantity} > 0) OR (${t.transactionType} = 'reversal' AND ${t.quantity} < 0) OR ${t.transactionType} = 'adjustment'`,
		),
		check(
			"item_campaign_tx_spend_formula_chk",
			sql`${t.campaignSpendCents} = (${t.quantity} * ${t.unitPriceCents})`,
		),
	],
);

export const itemCampaignRewardIssuances = sqliteTable(
	"item_campaign_reward_issuances",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		campaignId: text("campaign_id")
			.notNull()
			.references(() => itemCampaigns.id, { onDelete: "restrict" }),
		customerId: text("customer_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "restrict" }),
		cycleIndex: integer("cycle_index").notNull(),
		activeCycleKey: text("active_cycle_key"),
		releasedCycleKey: text("released_cycle_key"),
		customerRewardId: text("customer_reward_id")
			.notNull()
			.references(() => customerRewards.id, { onDelete: "restrict" }),
		billEventId: text("bill_event_id")
			.notNull()
			.references(() => billEvents.id, { onDelete: "restrict" }),
		issuedAt: timestampMs("issued_at").notNull(),
		cancelledAt: timestampMs("cancelled_at"),
		createdAt: createdAt(),
	},
	(t) => [
		uniqueIndex("item_campaign_issuance_cycle_unq").on(t.activeCycleKey),
		index("item_campaign_issuance_customer_idx").on(
			t.campaignId,
			t.customerId,
			t.cycleIndex,
		),
		index("item_campaign_issuance_bill_idx").on(t.billEventId),
		index("item_campaign_issuance_reward_idx").on(t.customerRewardId),
		check("item_campaign_issuance_cycle_positive_chk", sql`${t.cycleIndex} > 0`),
		check(
			"item_campaign_issuance_release_chk",
			sql`(${t.activeCycleKey} IS NULL AND ${t.cancelledAt} IS NOT NULL AND ${t.releasedCycleKey} IS NOT NULL) OR (${t.activeCycleKey} IS NOT NULL AND ${t.cancelledAt} IS NULL)`,
		),
	],
);
