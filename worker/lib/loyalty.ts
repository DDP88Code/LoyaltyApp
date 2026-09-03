import { and, count, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { COFFEE_CURRENCY_CODE } from "@shared/domain";
import type {
	CoffeeProgress,
	RewardSummary,
	TransactionSummary,
} from "@shared/loyalty";
import { newId } from "@worker/db/ids";
import type { Db } from "@worker/db/client";
import type { Role } from "@shared/roles";
import {
	auditLogs,
	customerRewards,
	loyaltyPrograms,
	loyaltyTransactions,
	rewardDefinitions,
} from "@worker/db/schema";
import { ApiError } from "@worker/lib/http";

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
			.leftJoin(
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

export interface RecordCoffeeEarnParams {
	businessId: string;
	locationId: string;
	customerId: string;
	staffId: string;
	quantity: number;
	billReference: string | null;
	idempotencyKey: string;
}

/**
 * Records a qualifying coffee purchase and issues any reward the customer has
 * now newly earned. The earn's own `idempotency_key` makes a retried request a
 * no-op; the totals below and after that key are only ever advanced once.
 */
export async function recordCoffeeEarn(
	db: Db,
	params: RecordCoffeeEarnParams,
): Promise<{ issuedRewardIds: string[] }> {
	const program = await db.query.loyaltyPrograms.findFirst({
		where: and(
			eq(loyaltyPrograms.businessId, params.businessId),
			eq(loyaltyPrograms.currencyCode, COFFEE_CURRENCY_CODE),
			eq(loyaltyPrograms.active, true),
		),
	});
	if (!program) {
		throw new ApiError(
			"bad_request",
			"No active coffee program is configured for this business.",
		);
	}

	// Computed before the insert so a duplicate (idempotency-key-conflict) call
	// leaves it unchanged rather than double-counting.
	const [beforeRow] = await db
		.select({
			total: sql<number>`coalesce(sum(${loyaltyTransactions.quantity}), 0)`,
		})
		.from(loyaltyTransactions)
		.where(
			and(
				eq(loyaltyTransactions.customerId, params.customerId),
				eq(loyaltyTransactions.programId, program.id),
			),
		);
	const beforeTotal = beforeRow?.total ?? 0;

	const inserted = await db
		.insert(loyaltyTransactions)
		.values({
			businessId: params.businessId,
			locationId: params.locationId,
			customerId: params.customerId,
			staffId: params.staffId,
			programId: program.id,
			transactionType: "earn",
			quantity: params.quantity,
			billReference: params.billReference,
			idempotencyKey: params.idempotencyKey,
		})
		.onConflictDoNothing()
		.returning({ id: loyaltyTransactions.id });

	const wasNewInsert = inserted.length > 0;
	const afterTotal = wasNewInsert ? beforeTotal + params.quantity : beforeTotal;

	const issuedRewardIds: string[] = [];
	const threshold = program.qualifyingPurchasesRequired;

	if (wasNewInsert && threshold && threshold > 0 && program.rewardDefinitionId) {
		const beforeCycles = Math.floor(beforeTotal / threshold);
		const afterCycles = Math.floor(afterTotal / threshold);

		if (afterCycles > beforeCycles) {
			const reward = await db.query.rewardDefinitions.findFirst({
				where: eq(rewardDefinitions.id, program.rewardDefinitionId),
			});
			const expiresAt = reward?.validDays
				? new Date(Date.now() + reward.validDays * DAY_MS)
				: null;

			for (let cycle = beforeCycles + 1; cycle <= afterCycles; cycle++) {
				const [row] = await db
					.insert(customerRewards)
					.values({
						businessId: params.businessId,
						customerId: params.customerId,
						rewardDefinitionId: program.rewardDefinitionId,
						expiresAt,
						// Deterministic per cycle, so a race can never issue the same one twice.
						issuanceKey: `stamp:${program.id}:${params.customerId}:${cycle}`,
					})
					.onConflictDoNothing()
					.returning({ id: customerRewards.id });
				if (row) issuedRewardIds.push(row.id);
			}
		}
	}

	return { issuedRewardIds };
}

export interface RedeemCustomerRewardParams {
	businessId: string;
	customerId: string;
	rewardId: string;
	staffId: string;
	locationId: string;
	billReference: string | null;
}

/**
 * Redeems one reward instance. The ledger's unique `idempotency_key`
 * (`redeem:<rewardId>`) is the single source of truth for "has this reward
 * already been redeemed" — a losing concurrent call fails there and never
 * touches `customer_rewards`, so the reward can never be redeemed twice.
 */
export async function redeemCustomerReward(
	db: Db,
	params: RedeemCustomerRewardParams,
): Promise<void> {
	const now = new Date();

	const existing = await db
		.select({
			id: customerRewards.id,
			status: customerRewards.status,
			expiresAt: customerRewards.expiresAt,
			rewardDefinitionId: customerRewards.rewardDefinitionId,
			name: rewardDefinitions.name,
		})
		.from(customerRewards)
		.innerJoin(
			rewardDefinitions,
			eq(customerRewards.rewardDefinitionId, rewardDefinitions.id),
		)
		.where(
			and(
				eq(customerRewards.id, params.rewardId),
				eq(customerRewards.customerId, params.customerId),
				eq(customerRewards.businessId, params.businessId),
			),
		)
		.then((rows) => rows[0]);

	if (!existing) {
		throw new ApiError("not_found", "That reward was not found.");
	}
	if (
		existing.status !== "available" ||
		(existing.expiresAt !== null && existing.expiresAt.getTime() < now.getTime())
	) {
		throw new ApiError(
			"conflict",
			"This reward is no longer available to redeem.",
		);
	}

	// Not tied to a stamp/points program for a reward like the welcome voucher.
	const program = await db.query.loyaltyPrograms.findFirst({
		where: eq(loyaltyPrograms.rewardDefinitionId, existing.rewardDefinitionId),
	});

	const transactionId = newId();
	const inserted = await db
		.insert(loyaltyTransactions)
		.values({
			id: transactionId,
			businessId: params.businessId,
			locationId: params.locationId,
			customerId: params.customerId,
			staffId: params.staffId,
			programId: program?.id ?? null,
			transactionType: "redeem",
			quantity: 0,
			billReference: params.billReference,
			notes: `Redeemed: ${existing.name}`,
			idempotencyKey: `redeem:${params.rewardId}`,
		})
		.onConflictDoNothing()
		.returning({ id: loyaltyTransactions.id });

	if (inserted.length === 0) {
		throw new ApiError("conflict", "This reward has already been redeemed.");
	}

	// The WHERE clause repeats the availability guard as the true compare-and-
	// swap: only a row still `available` and unexpired can transition here.
	const updated = await db
		.update(customerRewards)
		.set({
			status: "redeemed",
			redeemedAt: now,
			redeemedBy: params.staffId,
			locationId: params.locationId,
			redemptionTransactionId: transactionId,
		})
		.where(
			and(
				eq(customerRewards.id, params.rewardId),
				eq(customerRewards.customerId, params.customerId),
				eq(customerRewards.businessId, params.businessId),
				eq(customerRewards.status, "available"),
				or(isNull(customerRewards.expiresAt), gt(customerRewards.expiresAt, now)),
			),
		)
		.returning({ id: customerRewards.id });

	if (updated.length === 0) {
		throw new ApiError(
			"conflict",
			"This reward is no longer available to redeem.",
		);
	}
}

export interface CreateLoyaltyAdjustmentParams {
	businessId: string;
	customerId: string;
	programId: string;
	locationId: string;
	/** The admin/owner profile making the change; also recorded as the approver. */
	staffId: string;
	/** Better Auth user id of the same actor, for the audit log. */
	actorUserId: string;
	actorRole: Role;
	transactionType: "adjustment" | "reversal";
	quantity: number;
	reason: string;
	billReference: string | null;
	idempotencyKey: string;
}

/**
 * A manual, audited ledger correction. Nothing here ever updates or deletes an
 * existing row — a mistake is corrected by writing a new compensating entry,
 * same as every other transaction type.
 */
export async function createLoyaltyAdjustment(
	db: Db,
	params: CreateLoyaltyAdjustmentParams,
): Promise<{ transactionId: string }> {
	const transactionId = newId();
	const inserted = await db
		.insert(loyaltyTransactions)
		.values({
			id: transactionId,
			businessId: params.businessId,
			locationId: params.locationId,
			customerId: params.customerId,
			staffId: params.staffId,
			programId: params.programId,
			transactionType: params.transactionType,
			quantity: params.quantity,
			billReference: params.billReference,
			reason: params.reason,
			approvedBy: params.staffId,
			idempotencyKey: params.idempotencyKey,
		})
		.onConflictDoNothing()
		.returning({ id: loyaltyTransactions.id });

	if (inserted.length === 0) {
		// A retried submission of the same action — the original entry already
		// exists and is returned as-is, so no second audit log is written either.
		const existing = await db.query.loyaltyTransactions.findFirst({
			where: eq(loyaltyTransactions.idempotencyKey, params.idempotencyKey),
		});
		return { transactionId: existing?.id ?? transactionId };
	}

	await db.insert(auditLogs).values({
		businessId: params.businessId,
		actorUserId: params.actorUserId,
		actorRole: params.actorRole,
		action: `admin.loyalty_${params.transactionType}`,
		entityType: "loyalty_transaction",
		entityId: transactionId,
		newValueJson: {
			customerId: params.customerId,
			programId: params.programId,
			quantity: params.quantity,
			reason: params.reason,
		},
	});

	return { transactionId };
}

