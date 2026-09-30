import {
	and,
	asc,
	desc,
	eq,
	gte,
	inArray,
	isNull,
	lte,
	sql,
} from "drizzle-orm";
import type {
	CustomerPointsPayload,
	CustomerPointsRedeemResultPayload,
	CustomerPointsSummary,
	StaffPointsAwardPayload,
	StaffPointsPromotionContext,
	StaffPointsQuotePayload,
} from "@shared/rewardPoints";
import { DEFAULT_TIMEZONE } from "@shared/domain";
import { POINTS_CATALOGUE_REWARD_TYPES } from "@shared/points";
import type { Role } from "@shared/roles";
import type { Db } from "@worker/db/client";
import { newId } from "@worker/db/ids";
import {
	auditLogs,
	billEvents,
	businesses,
	locations,
	loyaltyTransactions,
	pointsAwards,
	pointsCatalogueItems,
	pointsPromotions,
	pointsRedemptions,
	profiles,
	rewardDefinitions,
} from "@worker/db/schema";
import { ApiError } from "@worker/lib/http";
import {
	listCustomerItemCampaignProgress,
	listStaffItemCampaignContext,
} from "@worker/lib/itemCampaigns/service";
import {
	calculatePointsQuote,
	type PointsQuote,
} from "@worker/lib/points/calculate";
import {
	readPointsProgramForAdmin,
	requirePointsProgram,
	resolvePointsRedemptionLocationId,
} from "@worker/lib/points/config";

const DAY_MS = 86_400_000;

function isPointsCatalogueRewardType(value: string): value is "free_item" | "voucher" {
	return (POINTS_CATALOGUE_REWARD_TYPES as readonly string[]).includes(value);
}

interface ActivePromotionRow {
	id: string;
	name: string;
	promotionType: "multiplier" | "fixed_bonus";
	multiplierBp: number | null;
	fixedBonusPoints: number | null;
	minEligibleSpendCents: number | null;
}

interface AwardRowShape {
	id: string;
	customerId: string;
	basePoints: number;
	bonusPoints: number;
	totalPoints: number;
	multiplierPromotionName: string | null;
	appliedMultiplierBp: number | null;
	bonusPromotionName: string | null;
	appliedFixedBonusPoints: number | null;
	duplicateOverride: boolean;
	programId: string;
}

export function normalizeBillReference(value: string): string {
	return value.trim().toUpperCase().replace(/[\s\-_/.]/g, "");
}

function businessDayKey(at: Date, timeZone: string): string {
	try {
		return new Intl.DateTimeFormat("en-CA", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(at);
	} catch {
		return new Intl.DateTimeFormat("en-CA", {
			timeZone: DEFAULT_TIMEZONE,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).format(at);
	}
}

async function getBusinessTimezone(db: Db, businessId: string): Promise<string> {
	const business = await db.query.businesses.findFirst({
		where: eq(businesses.id, businessId),
		columns: { timezone: true },
	});
	return business?.timezone || DEFAULT_TIMEZONE;
}

async function listActivePromotions(
	db: Db,
	businessId: string,
	at: Date,
): Promise<ActivePromotionRow[]> {
	const rows = await db.query.pointsPromotions.findMany({
		where: and(
			eq(pointsPromotions.businessId, businessId),
			eq(pointsPromotions.enabled, true),
			isNull(pointsPromotions.archivedAt),
			lte(pointsPromotions.startAt, at),
			gte(pointsPromotions.endAt, at),
		),
	});
	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		promotionType: row.promotionType,
		multiplierBp: row.multiplierBp,
		fixedBonusPoints: row.fixedBonusPoints,
		minEligibleSpendCents: row.minEligibleSpendCents,
	}));
}

async function getRawBalance(
	db: Db,
	customerId: string,
	programId: string,
): Promise<number> {
	const [row] = await db
		.select({
			total: sql<number>`coalesce(sum(${loyaltyTransactions.quantity}), 0)`,
		})
		.from(loyaltyTransactions)
		.where(
			and(
				eq(loyaltyTransactions.customerId, customerId),
				eq(loyaltyTransactions.programId, programId),
			),
		);
	return row?.total ?? 0;
}

function toSummary(programName: string, rawBalance: number): CustomerPointsSummary {
	return {
		enabled: true,
		programName,
		availableBalance: Math.max(0, rawBalance),
		recoveryPoints: Math.max(0, -rawBalance),
		inRecovery: rawBalance < 0,
	};
}

function toQuotePayload(quote: PointsQuote, programName: string): StaffPointsQuotePayload {
	return {
		programName,
		eligibleSpendCents: quote.eligibleSpendCents,
		basePoints: quote.basePoints,
		bonusPoints: quote.bonusPoints,
		totalPoints: quote.totalPoints,
		multiplierPromotionName: quote.multiplierPromotion?.name ?? null,
		appliedMultiplierBp: quote.multiplierPromotion?.multiplierBp ?? null,
		fixedBonusPromotionName: quote.bonusPromotion?.name ?? null,
		appliedFixedBonusPoints: quote.bonusPromotion?.fixedBonusPoints ?? null,
	};
}

function buildDedupeGuardKey(params: {
	businessId: string;
	locationId: string;
	businessDay: string;
	billReferenceKey: string;
}): string {
	return `bill:${params.businessId}:${params.locationId}:${params.businessDay}:${params.billReferenceKey}`;
}

async function pointsSummaryForCustomer(
	db: Db,
	programId: string,
	programName: string,
	customerId: string,
): Promise<CustomerPointsSummary> {
	const rawBalance = await getRawBalance(db, customerId, programId);
	return toSummary(programName, rawBalance);
}

export async function getStaffPointsContext(
	db: Db,
	businessId: string,
	customerId: string,
): Promise<StaffPointsPromotionContext> {
	const program = await readPointsProgramForAdmin(db, businessId);
	if (!program || !program.active) {
		const itemCampaigns = await listStaffItemCampaignContext({
			db,
			businessId,
			customerId,
		});
		return {
			enabled: false,
			programName: program?.name ?? null,
			availableBalance: 0,
			recoveryPoints: 0,
			inRecovery: false,
			activePromotionSummary: null,
			itemCampaigns,
		};
	}

	const [rawBalance, activePromotions, itemCampaigns] = await Promise.all([
		getRawBalance(db, customerId, program.id),
		listActivePromotions(db, businessId, new Date()),
		listStaffItemCampaignContext({
			db,
			businessId,
			customerId,
		}),
	]);

	const highestMultiplier = activePromotions
		.filter((promotion) => promotion.promotionType === "multiplier")
		.sort((a, b) => (b.multiplierBp ?? 0) - (a.multiplierBp ?? 0))[0];
	const highestFixedBonus = activePromotions
		.filter((promotion) => promotion.promotionType === "fixed_bonus")
		.sort((a, b) => (b.fixedBonusPoints ?? 0) - (a.fixedBonusPoints ?? 0))[0];

	const summaryParts: string[] = [];
	if (highestMultiplier?.multiplierBp) {
		summaryParts.push(`${highestMultiplier.name} (${(highestMultiplier.multiplierBp / 10000).toFixed(2)}x)`);
	}
	if (highestFixedBonus?.fixedBonusPoints) {
		summaryParts.push(`${highestFixedBonus.name} (+${highestFixedBonus.fixedBonusPoints})`);
	}

	return {
		enabled: true,
		programName: program.name,
		availableBalance: Math.max(0, rawBalance),
		recoveryPoints: Math.max(0, -rawBalance),
		inRecovery: rawBalance < 0,
		activePromotionSummary: summaryParts.length > 0 ? summaryParts.join(" + ") : null,
		itemCampaigns,
	};
}

export async function quotePointsAward(params: {
	db: Db;
	businessId: string;
	eligibleSpendCents: number;
}): Promise<StaffPointsQuotePayload> {
	const { db, businessId, eligibleSpendCents } = params;
	if (!Number.isInteger(eligibleSpendCents) || eligibleSpendCents <= 0) {
		throw new ApiError(
			"validation_failed",
			"Points-eligible spend must be a whole number of cents greater than zero.",
		);
	}
	const program = await requirePointsProgram(db, businessId);
	const promotions = await listActivePromotions(db, businessId, new Date());
	const quote = calculatePointsQuote(
		eligibleSpendCents,
		{ points: program.earnRatePoints, spendCents: program.earnRateSpendCents },
		promotions,
	);
	if (quote.totalPoints <= 0) {
		throw new ApiError(
			"validation_failed",
			"This amount does not earn any points at the current rate.",
		);
	}
	return toQuotePayload(quote, program.name);
}

async function rebuildAwardResult(
	db: Db,
	businessId: string,
	award: AwardRowShape,
): Promise<StaffPointsAwardPayload> {
	const program = await requirePointsProgram(db, businessId);
	const summary = await pointsSummaryForCustomer(
		db,
		program.id,
		program.name,
		award.customerId,
	);
	return {
		awardId: award.id,
		programName: program.name,
		basePoints: award.basePoints,
		bonusPoints: award.bonusPoints,
		totalPoints: award.totalPoints,
		summary,
		duplicateOverride: award.duplicateOverride,
	};
}

export async function awardPointsForBill(params: {
	db: Db;
	businessId: string;
	customerId: string;
	locationId: string;
	staffId: string;
	staffRole: Role;
	staffAuthUserId: string;
	eligibleSpendCents: number;
	billReference: string;
	requestIdempotencyKey: string;
	duplicateOverrideReason: string | null;
}): Promise<StaffPointsAwardPayload> {
	const {
		db,
		businessId,
		customerId,
		locationId,
		staffId,
		staffRole,
		staffAuthUserId,
		eligibleSpendCents,
		billReference,
		requestIdempotencyKey,
		duplicateOverrideReason,
	} = params;

	if (!Number.isInteger(eligibleSpendCents) || eligibleSpendCents <= 0) {
		throw new ApiError(
			"validation_failed",
			"Points-eligible spend must be a whole number of cents greater than zero.",
		);
	}

	const normalizedReference = normalizeBillReference(billReference);
	if (!normalizedReference) {
		throw new ApiError("validation_failed", "Bill reference is required.");
	}

	const existingByRequest = await db.query.pointsAwards.findFirst({
		where: and(
			eq(pointsAwards.businessId, businessId),
			eq(pointsAwards.requestIdempotencyKey, requestIdempotencyKey),
		),
	});
	if (existingByRequest) {
		return rebuildAwardResult(db, businessId, existingByRequest);
	}

	const program = await requirePointsProgram(db, businessId);
	const timezone = await getBusinessTimezone(db, businessId);
	const now = new Date();
	const businessDay = businessDayKey(now, timezone);
	const dedupeGuardKey = buildDedupeGuardKey({
		businessId,
		locationId,
		businessDay,
		billReferenceKey: normalizedReference,
	});

	const duplicateOverride = Boolean(duplicateOverrideReason?.trim());
	let collidingAwardId: string | null = null;

	if (duplicateOverride) {
		if (!(staffRole === "admin" || staffRole === "owner")) {
			throw new ApiError(
				"forbidden",
				"Only admin or owner can override a duplicate receipt.",
			);
		}
		const reason = duplicateOverrideReason?.trim() ?? "";
		if (reason.length < 5) {
			throw new ApiError(
				"validation_failed",
				"Duplicate override reason must be at least 5 characters.",
			);
		}
		const colliding = await db.query.pointsAwards.findFirst({
			where: eq(pointsAwards.dedupeGuardKey, dedupeGuardKey),
			columns: { id: true },
		});
		if (!colliding) {
			throw new ApiError(
				"conflict",
				"No duplicate bill exists for this reference to override.",
			);
		}
		collidingAwardId = colliding.id;
	} else {
		const colliding = await db.query.pointsAwards.findFirst({
			where: eq(pointsAwards.dedupeGuardKey, dedupeGuardKey),
			columns: {
				id: true,
				totalPoints: true,
				createdAt: true,
				staffId: true,
			},
		});
		if (colliding) {
			throw new ApiError("conflict", "This bill reference was already awarded.", {
				existingAwardId: colliding.id,
				totalPoints: colliding.totalPoints,
				createdAt: colliding.createdAt.toISOString(),
				staffId: colliding.staffId,
			});
		}
	}

	const promotions = await listActivePromotions(db, businessId, now);
	const quote = calculatePointsQuote(
		eligibleSpendCents,
		{ points: program.earnRatePoints, spendCents: program.earnRateSpendCents },
		promotions,
	);
	if (quote.totalPoints <= 0) {
		throw new ApiError(
			"validation_failed",
			"This amount does not earn any points at the current rate.",
		);
	}

	const awardId = newId();
	const earnTxId = newId();
	const bonusTxId = newId();

	const batchOps = [
		db.insert(pointsAwards).values({
			id: awardId,
			businessId,
			programId: program.id,
			customerId,
			locationId,
			staffId,
			source: "staff_manual",
			eligibleSpendCents,
			ratePoints: quote.ratePoints,
			rateSpendCents: quote.rateSpendCents,
			basePoints: quote.basePoints,
			bonusPoints: quote.bonusPoints,
			totalPoints: quote.totalPoints,
			multiplierPromotionId: quote.multiplierPromotion?.id ?? null,
			multiplierPromotionName: quote.multiplierPromotion?.name ?? null,
			appliedMultiplierBp: quote.multiplierPromotion?.multiplierBp ?? null,
			bonusPromotionId: quote.bonusPromotion?.id ?? null,
			bonusPromotionName: quote.bonusPromotion?.name ?? null,
			appliedFixedBonusPoints: quote.bonusPromotion?.fixedBonusPoints ?? null,
			billReference,
			billReferenceKey: normalizedReference,
			businessDay,
			dedupeGuardKey: duplicateOverride ? null : dedupeGuardKey,
			releasedGuardKey: null,
			duplicateOverride,
			duplicateOverrideReason: duplicateOverride
				? (duplicateOverrideReason?.trim() ?? null)
				: null,
			duplicateOverrideBy: duplicateOverride ? staffId : null,
			requestIdempotencyKey,
			calculationJson: quote.calculationJson,
		}),
		db.insert(loyaltyTransactions).values({
			id: earnTxId,
			businessId,
			locationId,
			customerId,
			staffId,
			programId: program.id,
			transactionType: "earn",
			quantity: quote.basePoints,
			spendAmountCents: eligibleSpendCents,
			billReference,
			notes: `${program.name} bill points`,
			idempotencyKey: `points-earn:${awardId}`,
			pointsAwardId: awardId,
			relatedTransactionId: null,
		}),
	];

	if (quote.bonusPoints > 0) {
		batchOps.push(
			db.insert(loyaltyTransactions).values({
				id: bonusTxId,
				businessId,
				locationId,
				customerId,
				staffId,
				programId: program.id,
				transactionType: "bonus",
				quantity: quote.bonusPoints,
				spendAmountCents: null,
				billReference,
				notes: quote.bonusPromotion?.name
					? `${quote.bonusPromotion.name} bonus`
					: "Points promotion bonus",
				idempotencyKey: `points-bonus:${awardId}`,
				pointsAwardId: awardId,
				relatedTransactionId: earnTxId,
			}),
		);
	}

	try {
		await db.batch(batchOps as [typeof batchOps[number], ...typeof batchOps[number][]]);
	} catch (error) {
		const replay = await db.query.pointsAwards.findFirst({
			where: and(
				eq(pointsAwards.businessId, businessId),
				eq(pointsAwards.requestIdempotencyKey, requestIdempotencyKey),
			),
		});
		if (replay) {
			return rebuildAwardResult(db, businessId, replay);
		}

		const duplicate = await db.query.pointsAwards.findFirst({
			where: eq(pointsAwards.dedupeGuardKey, dedupeGuardKey),
			columns: { id: true, totalPoints: true, createdAt: true, staffId: true },
		});
		if (duplicate) {
			throw new ApiError("conflict", "This bill reference was already awarded.", {
				existingAwardId: duplicate.id,
				totalPoints: duplicate.totalPoints,
				createdAt: duplicate.createdAt.toISOString(),
				staffId: duplicate.staffId,
			});
		}
		throw error;
	}

	if (duplicateOverride && collidingAwardId) {
		await db.insert(auditLogs).values({
			businessId,
			actorUserId: staffAuthUserId,
			actorRole: staffRole,
			action: "admin.points_award_duplicate_override",
			entityType: "points_award",
			entityId: awardId,
			newValueJson: {
				dedupeGuardKey,
				collidingAwardId,
				reason: duplicateOverrideReason,
			},
		});
	}

	const summary = await pointsSummaryForCustomer(db, program.id, program.name, customerId);
	return {
		awardId,
		programName: program.name,
		basePoints: quote.basePoints,
		bonusPoints: quote.bonusPoints,
		totalPoints: quote.totalPoints,
		summary,
		duplicateOverride,
	};
}

export async function listCustomerPointsPayload(params: {
	db: Db;
	businessId: string;
	customerId: string;
}): Promise<CustomerPointsPayload | null> {
	const { db, businessId, customerId } = params;
	const program = await readPointsProgramForAdmin(db, businessId);
	if (!program || !program.active) {
		return null;
	}

	const summary = await pointsSummaryForCustomer(db, program.id, program.name, customerId);

	const catalogueRows = await db
		.select({
			id: pointsCatalogueItems.id,
			rewardDefinitionId: pointsCatalogueItems.rewardDefinitionId,
			pointsCost: pointsCatalogueItems.pointsCost,
			imageKey: pointsCatalogueItems.imageKey,
			active: pointsCatalogueItems.active,
			sortOrder: pointsCatalogueItems.sortOrder,
			maxPerCustomerPerPeriod: pointsCatalogueItems.maxPerCustomerPerPeriod,
			limitPeriodDays: pointsCatalogueItems.limitPeriodDays,
			name: rewardDefinitions.name,
			description: rewardDefinitions.description,
			rewardType: rewardDefinitions.rewardType,
			valueCents: rewardDefinitions.valueCents,
			terms: rewardDefinitions.terms,
			validDays: rewardDefinitions.validDays,
		})
		.from(pointsCatalogueItems)
		.innerJoin(
			rewardDefinitions,
			eq(pointsCatalogueItems.rewardDefinitionId, rewardDefinitions.id),
		)
		.where(
			and(
				eq(pointsCatalogueItems.businessId, businessId),
				eq(pointsCatalogueItems.active, true),
				isNull(pointsCatalogueItems.archivedAt),
				eq(rewardDefinitions.active, true),
			),
		)
		.orderBy(asc(pointsCatalogueItems.sortOrder), asc(rewardDefinitions.name));

	const txRows = await db
		.select({
			id: loyaltyTransactions.id,
			transactionType: loyaltyTransactions.transactionType,
			quantity: loyaltyTransactions.quantity,
			reason: loyaltyTransactions.reason,
			notes: loyaltyTransactions.notes,
			createdAt: loyaltyTransactions.createdAt,
			pointsAwardId: loyaltyTransactions.pointsAwardId,
			locationName: locations.name,
		})
		.from(loyaltyTransactions)
		.leftJoin(locations, eq(loyaltyTransactions.locationId, locations.id))
		.where(
			and(
				eq(loyaltyTransactions.customerId, customerId),
				eq(loyaltyTransactions.programId, program.id),
			),
		)
		.orderBy(desc(loyaltyTransactions.createdAt))
		.limit(60);

	const awardIds = txRows
		.map((row) => row.pointsAwardId)
		.filter((id): id is string => Boolean(id));
	const txIds = txRows.map((row) => row.id);

	const [awardRows, redemptionRows] = await Promise.all([
		awardIds.length
			? db
				.select({ id: pointsAwards.id, bonusPromotionName: pointsAwards.bonusPromotionName })
				.from(pointsAwards)
				.where(inArray(pointsAwards.id, awardIds))
			: Promise.resolve([]),
		txIds.length
			? db
				.select({
					ledgerTransactionId: pointsRedemptions.ledgerTransactionId,
					catalogueItemName: pointsRedemptions.catalogueItemName,
				})
				.from(pointsRedemptions)
				.where(inArray(pointsRedemptions.ledgerTransactionId, txIds))
			: Promise.resolve([]),
	]);

	const awardById = new Map(awardRows.map((row) => [row.id, row]));
	const redemptionByTxId = new Map(
		redemptionRows.map((row) => [row.ledgerTransactionId, row]),
	);

	const history = txRows.map((row) => {
		let label = "Activity";
		if (row.transactionType === "earn") {
			label = "Purchase";
		} else if (row.transactionType === "bonus") {
			label = awardById.get(row.pointsAwardId ?? "")?.bonusPromotionName
				? `${awardById.get(row.pointsAwardId ?? "")?.bonusPromotionName} Bonus`
				: "Bonus";
		} else if (row.transactionType === "redeem") {
			label = redemptionByTxId.get(row.id)?.catalogueItemName ?? "Redeemed";
		} else if (row.transactionType === "adjustment") {
			label = "Adjustment";
		} else if (row.transactionType === "reversal") {
			label = "Reversal";
		}

		return {
			id: row.id,
			transactionType: row.transactionType,
			quantity: row.quantity,
			label,
			detail: row.reason ?? row.notes ?? row.locationName ?? null,
			createdAt: row.createdAt.toISOString(),
		};
	});

	const campaigns = await listCustomerItemCampaignProgress({
		db,
		businessId,
		customerId,
	});

	return {
		summary,
		catalogue: catalogueRows.map((row) => ({
			id: row.id,
			rewardDefinitionId: row.rewardDefinitionId,
			name: row.name,
			description: row.description,
			rewardType: row.rewardType,
			valueCents: row.valueCents,
			pointsCost: row.pointsCost,
			terms: row.terms,
			validDays: row.validDays,
			imageKey: row.imageKey,
			active: row.active,
			sortOrder: row.sortOrder,
			maxPerCustomerPerPeriod: row.maxPerCustomerPerPeriod,
			limitPeriodDays: row.limitPeriodDays,
		})),
		history,
		campaigns,
	};
}

async function replayRedemptionResult(params: {
	db: Db;
	businessId: string;
	customerId: string;
	programId: string;
	programName: string;
	requestIdempotencyKey: string;
}): Promise<CustomerPointsRedeemResultPayload | null> {
	const { db, businessId, customerId, programId, programName, requestIdempotencyKey } = params;
	const redemption = await db.query.pointsRedemptions.findFirst({
		where: and(
			eq(pointsRedemptions.businessId, businessId),
			eq(pointsRedemptions.customerId, customerId),
			eq(pointsRedemptions.requestIdempotencyKey, requestIdempotencyKey),
		),
	});
	if (!redemption) return null;

	const summary = await pointsSummaryForCustomer(db, programId, programName, customerId);
	return {
		redeemed: true,
		summary,
		customerRewardId: redemption.customerRewardId,
		catalogueItemName: redemption.catalogueItemName,
		pointsCost: redemption.pointsCost,
	};
}

export async function redeemPointsCatalogueItem(params: {
	db: Db;
	d1: D1Database;
	businessId: string;
	customerId: string;
	catalogueItemId: string;
	requestIdempotencyKey: string;
}): Promise<CustomerPointsRedeemResultPayload> {
	const { db, d1, businessId, customerId, catalogueItemId, requestIdempotencyKey } = params;
	const program = await requirePointsProgram(db, businessId);

	const replay = await replayRedemptionResult({
		db,
		businessId,
		customerId,
		programId: program.id,
		programName: program.name,
		requestIdempotencyKey,
	});
	if (replay) return replay;

	const item = await db
		.select({
			id: pointsCatalogueItems.id,
			pointsCost: pointsCatalogueItems.pointsCost,
			rewardDefinitionId: pointsCatalogueItems.rewardDefinitionId,
			itemName: rewardDefinitions.name,
			rewardType: rewardDefinitions.rewardType,
			validDays: rewardDefinitions.validDays,
			rewardActive: rewardDefinitions.active,
		})
		.from(pointsCatalogueItems)
		.innerJoin(
			rewardDefinitions,
			eq(pointsCatalogueItems.rewardDefinitionId, rewardDefinitions.id),
		)
		.where(
			and(
				eq(pointsCatalogueItems.id, catalogueItemId),
				eq(pointsCatalogueItems.businessId, businessId),
				eq(pointsCatalogueItems.active, true),
				isNull(pointsCatalogueItems.archivedAt),
			),
		)
		.then((rows) => rows[0] ?? null);

	if (!item) {
		throw new ApiError("not_found", "That points reward is no longer available.");
	}
	if (!item.rewardActive) {
		throw new ApiError("conflict", "That reward definition is not active.");
	}
	if (!isPointsCatalogueRewardType(item.rewardType)) {
		throw new ApiError("conflict", "That reward type cannot be redeemed for points.");
	}

	const currentRawBalance = await getRawBalance(db, customerId, program.id);
	if (currentRawBalance < item.pointsCost) {
		throw new ApiError(
			"validation_failed",
			"You do not have enough points for this reward.",
		);
	}

	const locationId = await resolvePointsRedemptionLocationId(db, businessId);
	const now = Date.now();
	const txId = newId();
	const rewardId = newId();
	const redemptionId = newId();
	const notes = `Redeemed ${item.itemName} for ${item.pointsCost} points`;
	const expiresAt = item.validDays ? now + item.validDays * DAY_MS : null;
	const ledgerKey = `points-redeem:${customerId}:${requestIdempotencyKey}`;
	const issuanceKey = `points-redeem:${txId}`;

	const statementA = d1
		.prepare(`
			INSERT INTO loyalty_transactions
				(id, business_id, location_id, customer_id, staff_id, program_id,
				 transaction_type, quantity, spend_amount_cents, bill_reference, notes, reason,
				 approved_by, idempotency_key, points_award_id, related_transaction_id, created_at)
			SELECT
				?, ?, ?, ?, NULL, ?,
				'redeem', ?, NULL, NULL, ?, NULL,
				NULL, ?, NULL, NULL, ?
			WHERE (
				SELECT COALESCE(SUM(quantity), 0)
				FROM loyalty_transactions
				WHERE customer_id = ? AND program_id = ?
			) >= ?
		`)
		.bind(
			txId,
			businessId,
			locationId,
			customerId,
			program.id,
			-item.pointsCost,
			notes,
			ledgerKey,
			now,
			customerId,
			program.id,
			item.pointsCost,
		);

	const statementB = d1
		.prepare(`
			INSERT INTO customer_rewards
				(id, business_id, customer_id, reward_definition_id, status, issued_at,
				 expires_at, redeemed_at, redeemed_by, location_id, redemption_transaction_id,
				 issuance_key, created_at)
			SELECT
				?, ?, ?, ?, 'available', ?,
				?, NULL, NULL, NULL, NULL,
				?, ?
			WHERE EXISTS (SELECT 1 FROM loyalty_transactions WHERE id = ?)
		`)
		.bind(
			rewardId,
			businessId,
			customerId,
			item.rewardDefinitionId,
			now,
			expiresAt,
			issuanceKey,
			now,
			txId,
		);

	const statementC = d1
		.prepare(`
			INSERT INTO points_redemptions
				(id, business_id, program_id, customer_id, catalogue_item_id, reward_definition_id,
				 catalogue_item_name, points_cost, ledger_transaction_id, customer_reward_id,
				 request_idempotency_key, created_at)
			SELECT
				?, ?, ?, ?, ?, ?,
				?, ?, ?, ?,
				?, ?
			WHERE EXISTS (SELECT 1 FROM loyalty_transactions WHERE id = ?)
		`)
		.bind(
			redemptionId,
			businessId,
			program.id,
			customerId,
			catalogueItemId,
			item.rewardDefinitionId,
			item.itemName,
			item.pointsCost,
			txId,
			rewardId,
			requestIdempotencyKey,
			now,
			txId,
		);

	try {
		await d1.batch([statementA, statementB, statementC]);
	} catch (error) {
		const replayResult = await replayRedemptionResult({
			db,
			businessId,
			customerId,
			programId: program.id,
			programName: program.name,
			requestIdempotencyKey,
		});
		if (replayResult) return replayResult;
		throw error;
	}

	const recorded = await db.query.pointsRedemptions.findFirst({
		where: and(
			eq(pointsRedemptions.businessId, businessId),
			eq(pointsRedemptions.customerId, customerId),
			eq(pointsRedemptions.requestIdempotencyKey, requestIdempotencyKey),
		),
	});
	if (!recorded) {
		throw new ApiError("conflict", "You do not have enough points for this reward.");
	}

	const summary = await pointsSummaryForCustomer(db, program.id, program.name, customerId);
	return {
		redeemed: true,
		summary,
		customerRewardId: recorded.customerRewardId,
		catalogueItemName: recorded.catalogueItemName,
		pointsCost: recorded.pointsCost,
	};
}

export async function reversePointsAward(params: {
	db: Db;
	businessId: string;
	awardId: string;
	actorProfileId: string;
	actorUserId: string;
	actorRole: Role;
	reason: string;
}): Promise<{ reversed: true }> {
	const { db, businessId, awardId, actorProfileId, actorUserId, actorRole, reason } = params;
	const cleanReason = reason.trim();
	if (cleanReason.length < 5) {
		throw new ApiError("validation_failed", "Reversal reason must be at least 5 characters.");
	}

	const award = await db.query.pointsAwards.findFirst({
		where: and(eq(pointsAwards.id, awardId), eq(pointsAwards.businessId, businessId)),
	});
	if (!award) {
		throw new ApiError("not_found", "Points award not found.");
	}
	if (award.reversedAt) {
		throw new ApiError("conflict", "This points award is already reversed.");
	}

	const sourceRows = await db
		.select({
			id: loyaltyTransactions.id,
			transactionType: loyaltyTransactions.transactionType,
		})
		.from(loyaltyTransactions)
		.where(
			and(
				eq(loyaltyTransactions.pointsAwardId, award.id),
				inArray(loyaltyTransactions.transactionType, ["earn", "bonus"]),
			),
		);
	const earnTx = sourceRows.find((row) => row.transactionType === "earn");
	const bonusTx = sourceRows.find((row) => row.transactionType === "bonus");
	if (!earnTx) {
		throw new ApiError("internal_error", "Could not find source earn transaction for award.");
	}

	const now = new Date();
	const reverseEarnId = newId();
	const reverseBonusId = newId();

	const batchOps: any[] = [
		db.insert(loyaltyTransactions).values({
			id: reverseEarnId,
			businessId,
			locationId: award.locationId,
			customerId: award.customerId,
			staffId: actorProfileId,
			programId: award.programId,
			transactionType: "reversal",
			quantity: -award.basePoints,
			reason: cleanReason,
			approvedBy: actorProfileId,
			idempotencyKey: `points-reversal-earn:${award.id}`,
			pointsAwardId: award.id,
			relatedTransactionId: earnTx.id,
		}),
		db
			.update(pointsAwards)
			.set({
				reversedAt: now,
				reversedBy: actorProfileId,
				reversalReason: cleanReason,
				releasedGuardKey: award.dedupeGuardKey,
				dedupeGuardKey: null,
			})
			.where(eq(pointsAwards.id, award.id)),
	];

	if (award.billEventId) {
		batchOps.push(
			db
				.update(billEvents)
				.set({
					reversedAt: now,
					reversedBy: actorProfileId,
					reversalReason: cleanReason,
					releasedGuardKey: billEvents.dedupeGuardKey,
					dedupeGuardKey: null,
					rewardsSettledAt: null,
				})
				.where(
					and(
						eq(billEvents.id, award.billEventId),
						isNull(billEvents.reversedAt),
					),
				),
		);
	}

	if (award.bonusPoints > 0) {
		batchOps.push(
			db.insert(loyaltyTransactions).values({
				id: reverseBonusId,
				businessId,
				locationId: award.locationId,
				customerId: award.customerId,
				staffId: actorProfileId,
				programId: award.programId,
				transactionType: "reversal",
				quantity: -award.bonusPoints,
				reason: cleanReason,
				approvedBy: actorProfileId,
				idempotencyKey: `points-reversal-bonus:${award.id}`,
				pointsAwardId: award.id,
				relatedTransactionId: bonusTx?.id ?? earnTx.id,
			}),
		);
	}

	await db.batch(batchOps as [typeof batchOps[number], ...typeof batchOps[number][]]);

	await db.insert(auditLogs).values({
		businessId,
		actorUserId,
		actorRole,
		action: "admin.points_award_reversed",
		entityType: "points_award",
		entityId: award.id,
		newValueJson: { reason: cleanReason },
	});

	return { reversed: true };
}

export async function createPointsAdjustment(params: {
	db: Db;
	businessId: string;
	customerId: string;
	locationId: string;
	actorProfileId: string;
	actorUserId: string;
	actorRole: Role;
	quantity: number;
	reason: string;
	idempotencyKey: string;
}): Promise<{ adjusted: true; summary: CustomerPointsSummary }> {
	const {
		db,
		businessId,
		customerId,
		locationId,
		actorProfileId,
		actorUserId,
		actorRole,
		quantity,
		reason,
		idempotencyKey,
	} = params;
	if (!Number.isInteger(quantity) || quantity === 0) {
		throw new ApiError("validation_failed", "Adjustment points must be a non-zero integer.");
	}
	if (reason.trim().length < 5) {
		throw new ApiError("validation_failed", "Adjustment reason must be at least 5 characters.");
	}

	const program = await readPointsProgramForAdmin(db, businessId);
	if (!program) {
		throw new ApiError("conflict", "Reward Points program is not configured.");
	}

	await db
		.insert(loyaltyTransactions)
		.values({
			businessId,
			locationId,
			customerId,
			staffId: actorProfileId,
			programId: program.id,
			transactionType: "adjustment",
			quantity,
			reason: reason.trim(),
			approvedBy: actorProfileId,
			idempotencyKey,
		})
		.onConflictDoNothing();

	await db.insert(auditLogs).values({
		businessId,
		actorUserId,
		actorRole,
		action: "admin.points_adjustment_created",
		entityType: "loyalty_transaction",
		newValueJson: { customerId, quantity, reason: reason.trim() },
	});

	const summary = await pointsSummaryForCustomer(db, program.id, program.name, customerId);
	return { adjusted: true, summary };
}

export async function listPointsAdminActivity(params: {
	db: Db;
	businessId: string;
}): Promise<{
	recentAwards: Array<{
		id: string;
		customerId: string;
		customerName: string;
		staffId: string | null;
		staffName: string | null;
		locationId: string;
		locationName: string;
		billReference: string;
		businessDay: string;
		basePoints: number;
		bonusPoints: number;
		totalPoints: number;
		duplicateOverride: boolean;
		reversedAt: string | null;
		createdAt: string;
	}>;
	outstandingPoints: number;
	customersInRecovery: Array<{
		customerId: string;
		customerName: string;
		rawBalance: number;
		recoveryPoints: number;
	}>;
}> {
	const { db, businessId } = params;
	const program = await readPointsProgramForAdmin(db, businessId);
	if (!program) {
		return {
			recentAwards: [],
			outstandingPoints: 0,
			customersInRecovery: [],
		};
	}

	const [awardRows, [outstandingRow], balanceRows] = await Promise.all([
		db
			.select({
				id: pointsAwards.id,
				customerId: pointsAwards.customerId,
				customerName: profiles.fullName,
				staffId: pointsAwards.staffId,
				locationId: pointsAwards.locationId,
				locationName: locations.name,
				billReference: pointsAwards.billReference,
				businessDay: pointsAwards.businessDay,
				basePoints: pointsAwards.basePoints,
				bonusPoints: pointsAwards.bonusPoints,
				totalPoints: pointsAwards.totalPoints,
				duplicateOverride: pointsAwards.duplicateOverride,
				reversedAt: pointsAwards.reversedAt,
				createdAt: pointsAwards.createdAt,
			})
			.from(pointsAwards)
			.innerJoin(profiles, eq(pointsAwards.customerId, profiles.id))
			.innerJoin(locations, eq(pointsAwards.locationId, locations.id))
			.where(eq(pointsAwards.businessId, businessId))
			.orderBy(desc(pointsAwards.createdAt))
			.limit(60),
		db
			.select({ total: sql<number>`coalesce(sum(${loyaltyTransactions.quantity}), 0)` })
			.from(loyaltyTransactions)
			.where(eq(loyaltyTransactions.programId, program.id)),
		db
			.select({
				customerId: loyaltyTransactions.customerId,
				customerName: profiles.fullName,
				rawBalance: sql<number>`coalesce(sum(${loyaltyTransactions.quantity}), 0)`,
			})
			.from(loyaltyTransactions)
			.innerJoin(profiles, eq(loyaltyTransactions.customerId, profiles.id))
			.where(eq(loyaltyTransactions.programId, program.id))
			.groupBy(loyaltyTransactions.customerId, profiles.fullName)
			.having(sql`coalesce(sum(${loyaltyTransactions.quantity}), 0) < 0`)
			.orderBy(asc(profiles.fullName)),
	]);

	const staffIds = awardRows
		.map((row) => row.staffId)
		.filter((id): id is string => Boolean(id));
	const staffRows =
		staffIds.length > 0
			? await db
				.select({ id: profiles.id, fullName: profiles.fullName })
				.from(profiles)
				.where(inArray(profiles.id, staffIds))
			: [];
	const staffNameById = new Map(staffRows.map((row) => [row.id, row.fullName]));

	return {
		recentAwards: awardRows.map((row) => ({
			id: row.id,
			customerId: row.customerId,
			customerName: row.customerName,
			staffId: row.staffId,
			staffName: row.staffId ? (staffNameById.get(row.staffId) ?? null) : null,
			locationId: row.locationId,
			locationName: row.locationName,
			billReference: row.billReference,
			businessDay: row.businessDay,
			basePoints: row.basePoints,
			bonusPoints: row.bonusPoints,
			totalPoints: row.totalPoints,
			duplicateOverride: row.duplicateOverride,
			reversedAt: row.reversedAt?.toISOString() ?? null,
			createdAt: row.createdAt.toISOString(),
		})),
		outstandingPoints: outstandingRow?.total ?? 0,
		customersInRecovery: balanceRows.map((row) => ({
			customerId: row.customerId,
			customerName: row.customerName,
			rawBalance: row.rawBalance,
			recoveryPoints: Math.max(0, -row.rawBalance),
		})),
	};
}

export async function listPointsReport(params: {
	db: Db;
	businessId: string;
}): Promise<{
	pointsIssued: number;
	pointsIssuedFromPromotions: number;
	pointsRedeemed: number;
	pointsReversed: number;
	pointsAdjusted: number;
	outstandingPoints: number;
	customersInRecovery: number;
}> {
	const { db, businessId } = params;
	const program = await readPointsProgramForAdmin(db, businessId);
	if (!program) {
		return {
			pointsIssued: 0,
			pointsIssuedFromPromotions: 0,
			pointsRedeemed: 0,
			pointsReversed: 0,
			pointsAdjusted: 0,
			outstandingPoints: 0,
			customersInRecovery: 0,
		};
	}

	const [rows, recoveryRows] = await Promise.all([
		db
			.select({
				pointsIssued: sql<number>`coalesce(sum(case when ${loyaltyTransactions.transactionType}='earn' then ${loyaltyTransactions.quantity} else 0 end), 0)`,
				pointsIssuedFromPromotions: sql<number>`coalesce(sum(case when ${loyaltyTransactions.transactionType}='bonus' then ${loyaltyTransactions.quantity} else 0 end), 0)`,
				pointsRedeemed: sql<number>`coalesce(sum(case when ${loyaltyTransactions.transactionType}='redeem' then abs(${loyaltyTransactions.quantity}) else 0 end), 0)`,
				pointsReversed: sql<number>`coalesce(sum(case when ${loyaltyTransactions.transactionType}='reversal' then abs(${loyaltyTransactions.quantity}) else 0 end), 0)`,
				pointsAdjusted: sql<number>`coalesce(sum(case when ${loyaltyTransactions.transactionType}='adjustment' then ${loyaltyTransactions.quantity} else 0 end), 0)`,
				outstandingPoints: sql<number>`coalesce(sum(${loyaltyTransactions.quantity}), 0)`,
			})
			.from(loyaltyTransactions)
			.where(eq(loyaltyTransactions.programId, program.id)),
		db
			.select({
				customerId: loyaltyTransactions.customerId,
				rawBalance: sql<number>`coalesce(sum(${loyaltyTransactions.quantity}), 0)`,
			})
			.from(loyaltyTransactions)
			.where(eq(loyaltyTransactions.programId, program.id))
			.groupBy(loyaltyTransactions.customerId)
			.having(sql`coalesce(sum(${loyaltyTransactions.quantity}), 0) < 0`),
	]);

	const totals = rows[0] ?? {
		pointsIssued: 0,
		pointsIssuedFromPromotions: 0,
		pointsRedeemed: 0,
		pointsReversed: 0,
		pointsAdjusted: 0,
		outstandingPoints: 0,
	};

	return {
		pointsIssued: totals.pointsIssued,
		pointsIssuedFromPromotions: totals.pointsIssuedFromPromotions,
		pointsRedeemed: totals.pointsRedeemed,
		pointsReversed: totals.pointsReversed,
		pointsAdjusted: totals.pointsAdjusted,
		outstandingPoints: totals.outstandingPoints,
		customersInRecovery: recoveryRows.length,
	};
}
