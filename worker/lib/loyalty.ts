import { and, count, desc, eq, sql } from "drizzle-orm";
import { COFFEE_CURRENCY_CODE } from "@shared/domain";
import type {
	CoffeeProgress,
	RewardSummary,
	TransactionSummary,
} from "@shared/loyalty";
import type { Db } from "@worker/db/client";
import {
	customerRewards,
	loyaltyPrograms,
	loyaltyTransactions,
	rewardDefinitions,
} from "@worker/db/schema";

const DAY_MS = 86_400_000;

/**
 * Coffee progress is the sum of every ledger row for this customer and
 * program, never a stored counter. A stamp threshold of 10 turns 12 lifetime
 * units into "2/10, one reward issued" — the modulo and floor below, not a
 * decrement anywhere else.
 */
export async function getCoffeeProgress(
	db: Db,
	businessId: string,
	customerId: string,
): Promise<CoffeeProgress | null> {
	const program = await db.query.loyaltyPrograms.findFirst({
		where: and(
			eq(loyaltyPrograms.businessId, businessId),
			eq(loyaltyPrograms.currencyCode, COFFEE_CURRENCY_CODE),
			eq(loyaltyPrograms.active, true),
		),
	});
	if (!program) return null;

	const [row] = await db
		.select({
			total: sql<number>`coalesce(sum(${loyaltyTransactions.quantity}), 0)`,
		})
		.from(loyaltyTransactions)
		.where(
			and(
				eq(loyaltyTransactions.customerId, customerId),
				eq(loyaltyTransactions.programId, program.id),
			),
		);

	const total = row?.total ?? 0;
	const threshold = program.qualifyingPurchasesRequired;
	const hasThreshold = threshold !== null && threshold > 0;

	return {
		programId: program.id,
		programName: program.name,
		currencyCode: program.currencyCode,
		current: hasThreshold ? total % threshold : total,
		threshold,
		cyclesCompleted: hasThreshold ? Math.floor(total / threshold) : 0,
	};
}

export async function isPointsProgramActive(
	db: Db,
	businessId: string,
): Promise<boolean> {
	const program = await db.query.loyaltyPrograms.findFirst({
		where: and(
			eq(loyaltyPrograms.businessId, businessId),
			eq(loyaltyPrograms.programType, "points"),
			eq(loyaltyPrograms.active, true),
		),
	});
	return Boolean(program);
}

/**
 * A reward past its expiry is shown as expired without ever being written back —
 * the periodic job that flips `status` is a Phase 8 concern, not a read path.
 */
export async function listCustomerRewards(
	db: Db,
	businessId: string,
	customerId: string,
): Promise<RewardSummary[]> {
	const rows = await db
		.select({
			id: customerRewards.id,
			status: customerRewards.status,
			issuedAt: customerRewards.issuedAt,
			expiresAt: customerRewards.expiresAt,
			redeemedAt: customerRewards.redeemedAt,
			name: rewardDefinitions.name,
			rewardType: rewardDefinitions.rewardType,
			valueCents: rewardDefinitions.valueCents,
		})
		.from(customerRewards)
		.innerJoin(
			rewardDefinitions,
			eq(customerRewards.rewardDefinitionId, rewardDefinitions.id),
		)
		.where(
			and(
				eq(customerRewards.businessId, businessId),
				eq(customerRewards.customerId, customerId),
			),
		)
		.orderBy(desc(customerRewards.issuedAt));

	const now = Date.now();
	return rows.map((row) => {
		const displayExpired =
			row.status === "available" &&
			row.expiresAt !== null &&
			row.expiresAt.getTime() < now;

		return {
			id: row.id,
			name: row.name,
			rewardType: row.rewardType,
			status: displayExpired ? "expired" : row.status,
			valueCents: row.valueCents,
			issuedAt: row.issuedAt.toISOString(),
			expiresAt: row.expiresAt?.toISOString() ?? null,
			redeemedAt: row.redeemedAt?.toISOString() ?? null,
		};
	});
}

export async function listCustomerTransactions(
	db: Db,
	businessId: string,
	customerId: string,
	limit: number,
	offset: number,
): Promise<{ rows: TransactionSummary[]; total: number }> {
	const where = and(
		eq(loyaltyTransactions.businessId, businessId),
		eq(loyaltyTransactions.customerId, customerId),
	);

	const [rows, [totals]] = await Promise.all([
		db
			.select({
				id: loyaltyTransactions.id,
				transactionType: loyaltyTransactions.transactionType,
				quantity: loyaltyTransactions.quantity,
				billReference: loyaltyTransactions.billReference,
				notes: loyaltyTransactions.notes,
				createdAt: loyaltyTransactions.createdAt,
				programName: loyaltyPrograms.name,
			})
			.from(loyaltyTransactions)
			.innerJoin(
				loyaltyPrograms,
				eq(loyaltyTransactions.programId, loyaltyPrograms.id),
			)
			.where(where)
			.orderBy(desc(loyaltyTransactions.createdAt))
			.limit(limit)
			.offset(offset),
		db.select({ value: count() }).from(loyaltyTransactions).where(where),
	]);

	return {
		rows: rows.map((row) => ({
			...row,
			createdAt: row.createdAt.toISOString(),
		})),
		total: totals?.value ?? 0,
	};
}

/**
 * Exactly-once via `issuance_key`, not an application-level check-then-insert —
 * two concurrent registrations for the same customer id can never both succeed.
 */
export async function issueWelcomeReward(
	db: Db,
	businessId: string,
	customerId: string,
): Promise<void> {
	const welcome = await db.query.rewardDefinitions.findFirst({
		where: and(
			eq(rewardDefinitions.businessId, businessId),
			eq(rewardDefinitions.welcomeReward, true),
			eq(rewardDefinitions.active, true),
		),
	});
	if (!welcome) return;

	const expiresAt = welcome.validDays
		? new Date(Date.now() + welcome.validDays * DAY_MS)
		: null;

	await db
		.insert(customerRewards)
		.values({
			businessId,
			customerId,
			rewardDefinitionId: welcome.id,
			expiresAt,
			issuanceKey: `welcome:${customerId}`,
		})
		.onConflictDoNothing();
}
