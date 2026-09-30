import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { BILL_EVENT_SOURCES } from "../../../shared/itemCampaigns";
import { createdAt, flag, json, pk, timestampMs } from "./_columns";
import { businesses, locations } from "./business";
import { profiles } from "./profiles";

export const billEvents = sqliteTable(
	"bill_events",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		locationId: text("location_id")
			.notNull()
			.references(() => locations.id, { onDelete: "restrict" }),
		customerId: text("customer_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "restrict" }),
		staffId: text("staff_id").references(() => profiles.id, {
			onDelete: "restrict",
		}),
		source: text("source", { enum: BILL_EVENT_SOURCES })
			.notNull()
			.default("staff_manual"),
		billTotalCents: integer("bill_total_cents").notNull(),
		campaignSpendCents: integer("campaign_spend_cents").notNull().default(0),
		excludedCampaignSpendCents: integer("excluded_campaign_spend_cents")
			.notNull()
			.default(0),
		otherExcludedSpendCents: integer("other_excluded_spend_cents")
			.notNull()
			.default(0),
		eligibleSpendCents: integer("eligible_spend_cents").notNull().default(0),
		totalPoints: integer("total_points").notNull().default(0),
		billReference: text("bill_reference").notNull(),
		billReferenceKey: text("bill_reference_key").notNull(),
		businessDay: text("business_day").notNull(),
		dedupeGuardKey: text("dedupe_guard_key"),
		releasedGuardKey: text("released_guard_key"),
		duplicateOverride: flag("duplicate_override").notNull().default(false),
		duplicateOverrideReason: text("duplicate_override_reason"),
		duplicateOverrideBy: text("duplicate_override_by").references(
			() => profiles.id,
			{ onDelete: "restrict" },
		),
		requestIdempotencyKey: text("request_idempotency_key").notNull(),
		rewardsSettledAt: timestampMs("rewards_settled_at"),
		reversedAt: timestampMs("reversed_at"),
		reversedBy: text("reversed_by").references(() => profiles.id, {
			onDelete: "restrict",
		}),
		reversalReason: text("reversal_reason"),
		calculationJson: json("calculation_json"),
		createdAt: createdAt(),
	},
	(t) => [
		uniqueIndex("bill_events_dedupe_guard_unq").on(t.dedupeGuardKey),
		uniqueIndex("bill_events_request_idem_unq").on(
			t.businessId,
			t.requestIdempotencyKey,
		),
		index("bill_events_customer_created_idx").on(t.customerId, t.createdAt),
		index("bill_events_business_created_idx").on(t.businessId, t.createdAt),
		index("bill_events_location_day_idx").on(t.locationId, t.businessDay),
		index("bill_events_staff_idx").on(t.staffId),
		index("bill_events_settlement_idx").on(t.rewardsSettledAt),
		check("bill_events_total_positive_chk", sql`${t.billTotalCents} > 0`),
		check(
			"bill_events_non_negative_chk",
			sql`${t.campaignSpendCents} >= 0 AND ${t.excludedCampaignSpendCents} >= 0 AND ${t.otherExcludedSpendCents} >= 0 AND ${t.eligibleSpendCents} >= 0`,
		),
		check(
			"bill_events_spend_balance_chk",
			sql`${t.campaignSpendCents} + ${t.otherExcludedSpendCents} <= ${t.billTotalCents}`,
		),
		check(
			"bill_events_override_chk",
			sql`${t.duplicateOverride} = 0 OR (${t.duplicateOverrideReason} IS NOT NULL AND ${t.duplicateOverrideBy} IS NOT NULL)`,
		),
	],
);
