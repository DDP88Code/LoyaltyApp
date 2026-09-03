import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { PROGRAM_TYPES, TRANSACTION_TYPES } from "../../../shared/domain";
import { createdAt, flag, pk, updatedAt } from "./_columns";
import { businesses, locations } from "./business";
import { profiles } from "./profiles";
import { rewardDefinitions } from "./rewards";

export const loyaltyPrograms = sqliteTable(
	"loyalty_programs",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		programType: text("program_type", { enum: PROGRAM_TYPES }).notNull(),
		// Unit the ledger counts, e.g. "COFFEE" for stamps or "POINTS".
		currencyCode: text("currency_code").notNull(),
		// Stamp threshold. Admin-configurable; never hard-coded in business logic.
		qualifyingPurchasesRequired: integer("qualifying_purchases_required"),
		rewardDefinitionId: text("reward_definition_id").references(
			() => rewardDefinitions.id,
			{ onDelete: "set null" },
		),
		active: flag("active").notNull().default(true),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		uniqueIndex("loyalty_programs_business_currency_unq").on(
			t.businessId,
			t.currencyCode,
		),
		index("loyalty_programs_business_active_idx").on(t.businessId, t.active),
	],
);

/**
 * Append-only loyalty ledger. Every earn, bonus, redemption, adjustment and
 * reversal is a row here; rows are never updated or deleted. A mistake is
 * corrected by writing a compensating `reversal`.
 */
export const loyaltyTransactions = sqliteTable(
	"loyalty_transactions",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		locationId: text("location_id")
			.notNull()
			.references(() => locations.id),
		customerId: text("customer_id")
			.notNull()
			.references(() => profiles.id),
		staffId: text("staff_id").references(() => profiles.id),
		programId: text("program_id")
			.notNull()
			.references(() => loyaltyPrograms.id),
		transactionType: text("transaction_type", {
			enum: TRANSACTION_TYPES,
		}).notNull(),
		// Signed: positive accrues, negative consumes.
		quantity: integer("quantity").notNull(),
		spendAmountCents: integer("spend_amount_cents"),
		billReference: text("bill_reference"),
		notes: text("notes"),
		reason: text("reason"),
		approvedBy: text("approved_by").references(() => profiles.id),
		idempotencyKey: text("idempotency_key").notNull(),
		createdAt: createdAt(),
	},
	(t) => [
		// The database, not the application, is what makes a replayed write impossible.
		uniqueIndex("loyalty_transactions_idempotency_key_unq").on(t.idempotencyKey),
		index("loyalty_transactions_customer_idx").on(t.customerId),
		index("loyalty_transactions_program_idx").on(t.programId),
		index("loyalty_transactions_staff_idx").on(t.staffId),
		index("loyalty_transactions_location_idx").on(t.locationId),
		index("loyalty_transactions_created_at_idx").on(t.createdAt),
		// Serves the progress query: one customer's entries for one program, in order.
		index("loyalty_transactions_progress_idx").on(
			t.customerId,
			t.programId,
			t.createdAt,
		),
	],
);
