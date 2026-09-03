import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
	CUSTOMER_REWARD_STATUSES,
	REWARD_TYPES,
} from "../../../shared/domain";
import { createdAt, flag, pk, timestampMs, updatedAt } from "./_columns";
import { businesses, locations } from "./business";
import { loyaltyTransactions } from "./loyalty";
import { profiles } from "./profiles";

export const rewardDefinitions = sqliteTable(
	"reward_definitions",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		rewardType: text("reward_type", { enum: REWARD_TYPES }).notNull(),
		valueCents: integer("value_cents"),
		pointsCost: integer("points_cost"),
		itemReference: text("item_reference"),
		validDays: integer("valid_days"),
		welcomeReward: flag("welcome_reward").notNull().default(false),
		active: flag("active").notNull().default(true),
		terms: text("terms"),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		index("reward_definitions_business_active_idx").on(t.businessId, t.active),
		// At most one welcome reward per business, enforced in SQLite rather than code.
		// Unqualified column name: SQLite rejects `table.column` in an index predicate.
		uniqueIndex("reward_definitions_welcome_unq")
			.on(t.businessId)
			.where(sql`welcome_reward = 1`),
	],
);

/**
 * A reward instance held by a customer. `issuance_key` is the deduplication
 * token — "welcome:<customerId>" or "stamp:<programId>:<customerId>:<cycle>" —
 * so a retried or concurrent issuance collides instead of granting twice.
 */
export const customerRewards = sqliteTable(
	"customer_rewards",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		customerId: text("customer_id")
			.notNull()
			.references(() => profiles.id),
		rewardDefinitionId: text("reward_definition_id")
			.notNull()
			.references(() => rewardDefinitions.id),
		status: text("status", { enum: CUSTOMER_REWARD_STATUSES })
			.notNull()
			.default("available"),
		issuedAt: timestampMs("issued_at")
			.notNull()
			.$defaultFn(() => new Date()),
		expiresAt: timestampMs("expires_at"),
		redeemedAt: timestampMs("redeemed_at"),
		redeemedBy: text("redeemed_by").references(() => profiles.id),
		locationId: text("location_id").references(() => locations.id),
		redemptionTransactionId: text("redemption_transaction_id").references(
			() => loyaltyTransactions.id,
		),
		issuanceKey: text("issuance_key"),
		createdAt: createdAt(),
	},
	(t) => [
		// SQLite treats NULLs as distinct here, so unissued rows never collide.
		uniqueIndex("customer_rewards_issuance_key_unq").on(t.issuanceKey),
		index("customer_rewards_customer_status_idx").on(t.customerId, t.status),
		index("customer_rewards_business_idx").on(t.businessId),
		index("customer_rewards_expires_at_idx").on(t.expiresAt),
	],
);

/**
 * Short-lived loyalty identification codes shown on MY FIVES CODE. These are
 * not login credentials. Only hashes are stored; expiry is enforced server-side.
 */
export const loyaltyCodes = sqliteTable(
	"loyalty_codes",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		customerId: text("customer_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		otpHash: text("otp_hash").notNull(),
		qrTokenHash: text("qr_token_hash").notNull(),
		expiresAt: timestampMs("expires_at").notNull(),
		usedAt: timestampMs("used_at"),
		createdAt: createdAt(),
	},
	(t) => [
		// A 6-digit OTP is not unique on its own; staff resolution filters by expiry.
		index("loyalty_codes_otp_idx").on(t.businessId, t.otpHash, t.expiresAt),
		uniqueIndex("loyalty_codes_qr_token_unq").on(t.qrTokenHash),
		index("loyalty_codes_customer_idx").on(t.customerId, t.expiresAt),
	],
);
