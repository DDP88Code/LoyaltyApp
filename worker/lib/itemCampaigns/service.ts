import {
	and,
	asc,
	desc,
	eq,
	gt,
	gte,
	inArray,
	isNotNull,
	isNull,
	lte,
	ne,
	or,
	sql,
} from "drizzle-orm";
import type {
	AdminItemCampaignActivityPayload,
	AdminItemCampaignPayload,
	AdminItemCampaignReportPayload,
	CustomerItemCampaignProgress,
	CustomerPointsSummary,
	StaffCampaignBillCommitPayload,
	StaffCampaignBillLineInput,
	StaffCampaignBillLineQuotePayload,
	StaffCampaignBillQuotePayload,
	StaffItemCampaignContext,
} from "@shared/rewardPoints";
import type { Role } from "@shared/roles";
import { DEFAULT_TIMEZONE } from "@shared/domain";
import { normalizeItemReference } from "@shared/itemCampaigns";
import type { Db } from "@worker/db/client";
import { newId } from "@worker/db/ids";
import {
	auditLogs,
	billEvents,
	businesses,
	customerRewards,
	itemCampaignRewardIssuances,
	itemCampaignTransactions,
	itemCampaigns,
	locations,
	loyaltyTransactions,
	pointsAwards,
	pointsPromotions,
	profiles,
	rewardDefinitions,
} from "@worker/db/schema";
import { ApiError } from "@worker/lib/http";
import { calculatePointsQuote } from "@worker/lib/points/calculate";
import { readPointsProgramForAdmin, requirePointsProgram } from "@worker/lib/points/config";
import { normalizeBillReference } from "@worker/lib/points/service";

const DAY_MS = 86_400_000;

interface CampaignLineRow {
	campaignId: string;
	name: string;
	itemReference: string;
	unitPriceCents: number;
	targetQuantity: number;
	rewardName: string;
	earnsRewardPoints: boolean;
	maxQuantityPerBill: number | null;
	quantity: number;
	status: "active" | "disabled" | "archived";
	startAt: Date | null;
	endAt: Date | null;
}

interface CampaignProgressSnapshot {
	netQuantity: number;
	consumedCycleCount: number;
	lastActivityAt: number | null;
}

interface CampaignLineQuoteShape {
	line: CampaignLineRow;
	before: CampaignProgressSnapshot;
	after: CampaignProgressSnapshot;
	rewardsUnlockedByLine: number;
	campaignSpendCents: number;
}

interface BillQuoteCalculation {
	payload: StaffCampaignBillQuotePayload;
	linesByCampaignId: Map<string, CampaignLineQuoteShape>;
	multiplierPromotionId: string | null;
	bonusPromotionId: string | null;
}

interface StoredBillCalculationJson {
	quotePayload: StaffCampaignBillQuotePayload;
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

function buildDedupeGuardKey(params: {
	businessId: string;
	locationId: string;
	businessDay: string;
	billReferenceKey: string;
}): string {
	return `bill:${params.businessId}:${params.locationId}:${params.businessDay}:${params.billReferenceKey}`;
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

async function getRawBalance(db: Db, customerId: string, programId: string): Promise<number> {
	const [row] = await db
		.select({ total: sql<number>`coalesce(sum(${loyaltyTransactions.quantity}), 0)` })
		.from(loyaltyTransactions)
		.where(
			and(
				eq(loyaltyTransactions.customerId, customerId),
				eq(loyaltyTransactions.programId, programId),
			),
		);
	return row?.total ?? 0;
}

async function pointsSummaryForCustomer(
	db: Db,
	businessId: string,
	customerId: string,
): Promise<CustomerPointsSummary> {
	const program = await readPointsProgramForAdmin(db, businessId);
	if (!program || !program.active) {
		return {
			enabled: false,
			programName: program?.name ?? "Reward Points",
			availableBalance: 0,
			recoveryPoints: 0,
			inRecovery: false,
		};
	}
	const rawBalance = await getRawBalance(db, customerId, program.id);
	return toSummary(program.name, rawBalance);
}

function computeCampaignSnapshot(params: {
	netQuantity: number;
	targetQuantity: number;
	consumedCycleCount: number;
}): {
	progressInActiveCycle: number;
	remainingToNextReward: number;
	catchUpQuantity: number;
	inCatchUp: boolean;
	nextCycleIndex: number;
} {
	const baseNet = Math.max(0, params.netQuantity);
	const catchUpQuantity = Math.max(
		0,
		params.consumedCycleCount * params.targetQuantity - baseNet,
	);
	const inCatchUp = catchUpQuantity > 0;
	const progressInActiveCycle = inCatchUp ? 0 : baseNet % params.targetQuantity;
	const remainingToNextReward = inCatchUp
		? catchUpQuantity
		: progressInActiveCycle === 0
			? params.targetQuantity
			: params.targetQuantity - progressInActiveCycle;

	return {
		progressInActiveCycle,
		remainingToNextReward,
		catchUpQuantity,
		inCatchUp,
		nextCycleIndex: params.consumedCycleCount + 1,
	};
}

async function getBusinessTimezone(db: Db, businessId: string): Promise<string> {
	const business = await db.query.businesses.findFirst({
		where: eq(businesses.id, businessId),
		columns: { timezone: true },
	});
	return business?.timezone || DEFAULT_TIMEZONE;
}

function windowsOverlap(
	aStart: Date | null,
	aEnd: Date | null,
	bStart: Date | null,
	bEnd: Date | null,
): boolean {
	const aMin = aStart?.getTime() ?? Number.NEGATIVE_INFINITY;
	const aMax = aEnd?.getTime() ?? Number.POSITIVE_INFINITY;
	const bMin = bStart?.getTime() ?? Number.NEGATIVE_INFINITY;
	const bMax = bEnd?.getTime() ?? Number.POSITIVE_INFINITY;
	return aMin < bMax && bMin < aMax;
}

async function listActivePointsPromotions(db: Db, businessId: string, at: Date) {
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

async function campaignProgressMap(
	db: Db,
	businessId: string,
	customerId: string,
	campaignIds: string[],
): Promise<Map<string, CampaignProgressSnapshot>> {
	if (campaignIds.length === 0) return new Map();

	const [txRows, issuanceRows] = await Promise.all([
		db
			.select({
				campaignId: itemCampaignTransactions.campaignId,
				netQuantity: sql<number>`coalesce(sum(${itemCampaignTransactions.quantity}), 0)`,
				lastActivityAt: sql<number | null>`max(${itemCampaignTransactions.createdAt})`,
			})
			.from(itemCampaignTransactions)
			.where(
				and(
					eq(itemCampaignTransactions.businessId, businessId),
					eq(itemCampaignTransactions.customerId, customerId),
					inArray(itemCampaignTransactions.campaignId, campaignIds),
				),
			)
			.groupBy(itemCampaignTransactions.campaignId),
		db
			.select({
				campaignId: itemCampaignRewardIssuances.campaignId,
				maxCycle: sql<number>`coalesce(max(${itemCampaignRewardIssuances.cycleIndex}), 0)`,
			})
			.from(itemCampaignRewardIssuances)
			.where(
				and(
					eq(itemCampaignRewardIssuances.businessId, businessId),
					eq(itemCampaignRewardIssuances.customerId, customerId),
					inArray(itemCampaignRewardIssuances.campaignId, campaignIds),
					isNotNull(itemCampaignRewardIssuances.activeCycleKey),
					isNull(itemCampaignRewardIssuances.cancelledAt),
				),
			)
			.groupBy(itemCampaignRewardIssuances.campaignId),
	]);

	const txByCampaign = new Map(txRows.map((row) => [row.campaignId, row]));
	const issuanceByCampaign = new Map(issuanceRows.map((row) => [row.campaignId, row]));
	const map = new Map<string, CampaignProgressSnapshot>();

	for (const campaignId of campaignIds) {
		const tx = txByCampaign.get(campaignId);
		const issuance = issuanceByCampaign.get(campaignId);
		map.set(campaignId, {
			netQuantity: tx?.netQuantity ?? 0,
			consumedCycleCount: issuance?.maxCycle ?? 0,
			lastActivityAt: tx?.lastActivityAt ?? null,
		});
	}

	return map;
}

function parseStoredQuote(
	calculationJson: unknown,
): StaffCampaignBillQuotePayload | null {
	if (!calculationJson || typeof calculationJson !== "object") return null;
	const candidate = (calculationJson as StoredBillCalculationJson).quotePayload;
	if (!candidate || typeof candidate !== "object") return null;
	return candidate;
}

async function calculateBillQuote(params: {
	db: Db;
	businessId: string;
	customerId: string;
	billTotalCents: number;
	otherExcludedSpendCents: number;
	campaignLines: StaffCampaignBillLineInput[];
	now: Date;
}): Promise<BillQuoteCalculation> {
	const {
		db,
		businessId,
		customerId,
		billTotalCents,
		otherExcludedSpendCents,
		campaignLines,
		now,
	} = params;

	if (!Number.isInteger(billTotalCents) || billTotalCents <= 0) {
		throw new ApiError("validation_failed", "Bill total must be a whole number of cents greater than zero.");
	}
	if (!Number.isInteger(otherExcludedSpendCents) || otherExcludedSpendCents < 0) {
		throw new ApiError("validation_failed", "Excluded spend must be zero or a positive whole number of cents.");
	}

	const aggregated = new Map<string, number>();
	for (const line of campaignLines) {
		if (!line.campaignId.trim()) {
			throw new ApiError("validation_failed", "Campaign id is required for each line.");
		}
		if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
			throw new ApiError("validation_failed", "Campaign quantities must be positive whole numbers.");
		}
		aggregated.set(line.campaignId, (aggregated.get(line.campaignId) ?? 0) + line.quantity);
	}

	const campaignIds = [...aggregated.keys()];
	const campaignRows = campaignIds.length
		? await db
				.select({
					campaignId: itemCampaigns.id,
					name: itemCampaigns.name,
					itemReference: itemCampaigns.itemReference,
					unitPriceCents: itemCampaigns.unitPriceCents,
					targetQuantity: itemCampaigns.targetQuantity,
					rewardName: rewardDefinitions.name,
					earnsRewardPoints: itemCampaigns.earnsRewardPoints,
					maxQuantityPerBill: itemCampaigns.maxQuantityPerBill,
					status: itemCampaigns.status,
					startAt: itemCampaigns.startAt,
					endAt: itemCampaigns.endAt,
				})
				.from(itemCampaigns)
				.innerJoin(
					rewardDefinitions,
					eq(itemCampaigns.rewardDefinitionId, rewardDefinitions.id),
				)
				.where(
					and(
						eq(itemCampaigns.businessId, businessId),
						inArray(itemCampaigns.id, campaignIds),
						ne(itemCampaigns.status, "archived"),
					),
				)
		: [];

	if (campaignRows.length !== campaignIds.length) {
		throw new ApiError("not_found", "One or more campaign lines reference an unknown campaign.");
	}

	for (const row of campaignRows) {
		if (row.status !== "active") {
			throw new ApiError("conflict", `Campaign ${row.name} is not active.`);
		}
		if (row.startAt && row.startAt.getTime() > now.getTime()) {
			throw new ApiError("conflict", `Campaign ${row.name} has not started yet.`);
		}
		if (row.endAt && row.endAt.getTime() <= now.getTime()) {
			throw new ApiError("conflict", `Campaign ${row.name} has ended.`);
		}
	}

	const progress = await campaignProgressMap(db, businessId, customerId, campaignIds);

	let campaignSpendCents = 0;
	let excludedCampaignSpendCents = 0;
	let rewardsUnlockedTotal = 0;

	const linePayloads: StaffCampaignBillLineQuotePayload[] = [];
	const linesByCampaignId = new Map<string, CampaignLineQuoteShape>();

	for (const row of campaignRows) {
		const quantity = aggregated.get(row.campaignId) ?? 0;
		if (row.maxQuantityPerBill && quantity > row.maxQuantityPerBill) {
			throw new ApiError(
				"validation_failed",
				`Campaign ${row.name} allows a maximum of ${row.maxQuantityPerBill} units per bill.`,
			);
		}

		const before = progress.get(row.campaignId) ?? {
			netQuantity: 0,
			consumedCycleCount: 0,
			lastActivityAt: null,
		};
		const after = {
			netQuantity: before.netQuantity + quantity,
			consumedCycleCount: before.consumedCycleCount,
			lastActivityAt: before.lastActivityAt,
		};

		const campaignSpend = quantity * row.unitPriceCents;
		campaignSpendCents += campaignSpend;
		if (!row.earnsRewardPoints) {
			excludedCampaignSpendCents += campaignSpend;
		}

		const beforeMetrics = computeCampaignSnapshot({
			netQuantity: before.netQuantity,
			targetQuantity: row.targetQuantity,
			consumedCycleCount: before.consumedCycleCount,
		});
		const afterMetrics = computeCampaignSnapshot({
			netQuantity: after.netQuantity,
			targetQuantity: row.targetQuantity,
			consumedCycleCount: before.consumedCycleCount,
		});
		const eligibleCyclesAfter = Math.floor(Math.max(0, after.netQuantity) / row.targetQuantity);
		const rewardsUnlockedByLine = Math.max(
			0,
			eligibleCyclesAfter - before.consumedCycleCount,
		);
		rewardsUnlockedTotal += rewardsUnlockedByLine;

		const payload: StaffCampaignBillLineQuotePayload = {
			campaignId: row.campaignId,
			name: row.name,
			itemReference: row.itemReference,
			quantity,
			unitPriceCents: row.unitPriceCents,
			campaignSpendCents: campaignSpend,
			earnsRewardPoints: row.earnsRewardPoints,
			targetQuantity: row.targetQuantity,
			rewardName: row.rewardName,
			maxQuantityPerBill: row.maxQuantityPerBill,
			beforeNetQuantity: before.netQuantity,
			afterNetQuantity: after.netQuantity,
			beforeProgressInCycle: beforeMetrics.progressInActiveCycle,
			afterProgressInCycle: afterMetrics.progressInActiveCycle,
			cyclesCompletedBefore: before.consumedCycleCount,
			cyclesCompletedAfter: Math.max(before.consumedCycleCount, eligibleCyclesAfter),
			rewardsUnlockedByLine,
			catchUpQuantityAfter: afterMetrics.catchUpQuantity,
		};

		linePayloads.push(payload);
		linesByCampaignId.set(row.campaignId, {
			line: {
				...row,
				quantity,
			},
			before,
			after,
			rewardsUnlockedByLine,
			campaignSpendCents: campaignSpend,
		});
	}

	const nonCampaignSpend = billTotalCents - campaignSpendCents;
	if (nonCampaignSpend < 0) {
		throw new ApiError(
			"validation_failed",
			"Campaign line spend exceeds bill total.",
		);
	}

	const eligibleSpendCents = billTotalCents - otherExcludedSpendCents - excludedCampaignSpendCents;
	if (eligibleSpendCents < 0) {
		throw new ApiError(
			"validation_failed",
			"Excluded spend exceeds bill total.",
		);
	}

	let programName = "Reward Points";
	let basePoints = 0;
	let bonusPoints = 0;
	let totalPoints = 0;
	let multiplierPromotionName: string | null = null;
	let appliedMultiplierBp: number | null = null;
	let fixedBonusPromotionName: string | null = null;
	let appliedFixedBonusPoints: number | null = null;
	let multiplierPromotionId: string | null = null;
	let bonusPromotionId: string | null = null;

	if (eligibleSpendCents > 0) {
		const program = await requirePointsProgram(db, businessId);
		programName = program.name;
		const promotions = await listActivePointsPromotions(db, businessId, now);
		const quote = calculatePointsQuote(
			eligibleSpendCents,
			{ points: program.earnRatePoints, spendCents: program.earnRateSpendCents },
			promotions,
		);
		basePoints = quote.basePoints;
		bonusPoints = quote.bonusPoints;
		totalPoints = quote.totalPoints;
		multiplierPromotionId = quote.multiplierPromotion?.id ?? null;
		multiplierPromotionName = quote.multiplierPromotion?.name ?? null;
		appliedMultiplierBp = quote.multiplierPromotion?.multiplierBp ?? null;
		bonusPromotionId = quote.bonusPromotion?.id ?? null;
		fixedBonusPromotionName = quote.bonusPromotion?.name ?? null;
		appliedFixedBonusPoints = quote.bonusPromotion?.fixedBonusPoints ?? null;
	}

	const warnings: string[] = [];
	if (nonCampaignSpend < otherExcludedSpendCents) {
		warnings.push("Other excluded spend exceeds non-campaign remainder.");
	}

	return {
		payload: {
			programName,
			billTotalCents,
			campaignSpendCents,
			excludedCampaignSpendCents,
			otherExcludedSpendCents,
			eligibleSpendCents,
			basePoints,
			bonusPoints,
			totalPoints,
			multiplierPromotionName,
			appliedMultiplierBp,
			fixedBonusPromotionName,
			appliedFixedBonusPoints,
			lines: linePayloads.sort((a, b) => a.name.localeCompare(b.name)),
			rewardsUnlockedTotal,
			warnings,
		},
		linesByCampaignId,
		multiplierPromotionId,
		bonusPromotionId,
	};
}

async function settleCampaignForCustomer(params: {
	db: Db;
	businessId: string;
	campaignId: string;
	customerId: string;
	locationId: string;
	staffId: string | null;
	billEventId: string;
}): Promise<void> {
	const { db, businessId, campaignId, customerId, locationId, staffId, billEventId } = params;
	const campaign = await db
		.select({
			id: itemCampaigns.id,
			rewardDefinitionId: itemCampaigns.rewardDefinitionId,
			targetQuantity: itemCampaigns.targetQuantity,
			rewardName: rewardDefinitions.name,
			validDays: rewardDefinitions.validDays,
		})
		.from(itemCampaigns)
		.innerJoin(rewardDefinitions, eq(itemCampaigns.rewardDefinitionId, rewardDefinitions.id))
		.where(
			and(
				eq(itemCampaigns.id, campaignId),
				eq(itemCampaigns.businessId, businessId),
			),
		)
		.then((rows) => rows[0] ?? null);
	if (!campaign) return;

	const [netRow] = await db
		.select({
			netQuantity: sql<number>`coalesce(sum(${itemCampaignTransactions.quantity}), 0)`,
		})
		.from(itemCampaignTransactions)
		.where(
			and(
				eq(itemCampaignTransactions.businessId, businessId),
				eq(itemCampaignTransactions.campaignId, campaignId),
				eq(itemCampaignTransactions.customerId, customerId),
			),
		);
	const netQuantity = netRow?.netQuantity ?? 0;
	const eligibleCycles = Math.floor(Math.max(0, netQuantity) / campaign.targetQuantity);

	const activeIssuances = await db
		.select({
			id: itemCampaignRewardIssuances.id,
			cycleIndex: itemCampaignRewardIssuances.cycleIndex,
			activeCycleKey: itemCampaignRewardIssuances.activeCycleKey,
			customerRewardId: itemCampaignRewardIssuances.customerRewardId,
			rewardStatus: customerRewards.status,
		})
		.from(itemCampaignRewardIssuances)
		.innerJoin(
			customerRewards,
			eq(itemCampaignRewardIssuances.customerRewardId, customerRewards.id),
		)
		.where(
			and(
				eq(itemCampaignRewardIssuances.businessId, businessId),
				eq(itemCampaignRewardIssuances.campaignId, campaignId),
				eq(itemCampaignRewardIssuances.customerId, customerId),
				isNotNull(itemCampaignRewardIssuances.activeCycleKey),
				isNull(itemCampaignRewardIssuances.cancelledAt),
			),
		)
		.orderBy(desc(itemCampaignRewardIssuances.cycleIndex));

	let consumedCycleCount = activeIssuances[0]?.cycleIndex ?? 0;
	if (consumedCycleCount > eligibleCycles) {
		let remainingToRelease = consumedCycleCount - eligibleCycles;
		const now = new Date();
		for (const issuance of activeIssuances) {
			if (remainingToRelease <= 0) break;
			if (issuance.rewardStatus !== "available") continue;
			await db.batch([
				db
					.update(customerRewards)
					.set({
						status: "cancelled",
						issuanceKey: null,
					})
					.where(
						and(
							eq(customerRewards.id, issuance.customerRewardId),
							eq(customerRewards.status, "available"),
						),
					),
				db
					.update(itemCampaignRewardIssuances)
					.set({
						activeCycleKey: null,
						releasedCycleKey: issuance.activeCycleKey,
						cancelledAt: now,
					})
					.where(eq(itemCampaignRewardIssuances.id, issuance.id)),
			]);
			remainingToRelease -= 1;
		}

		const [recountRow] = await db
			.select({
				maxCycle: sql<number>`coalesce(max(${itemCampaignRewardIssuances.cycleIndex}), 0)`,
			})
			.from(itemCampaignRewardIssuances)
			.where(
				and(
					eq(itemCampaignRewardIssuances.businessId, businessId),
					eq(itemCampaignRewardIssuances.campaignId, campaignId),
					eq(itemCampaignRewardIssuances.customerId, customerId),
					isNotNull(itemCampaignRewardIssuances.activeCycleKey),
					isNull(itemCampaignRewardIssuances.cancelledAt),
				),
			);
		consumedCycleCount = recountRow?.maxCycle ?? 0;
	}

	if (eligibleCycles <= consumedCycleCount) {
		return;
	}

	for (let cycleIndex = consumedCycleCount + 1; cycleIndex <= eligibleCycles; cycleIndex++) {
		const cycleKey = `${campaign.id}:${customerId}:${cycleIndex}`;
		const rewardId = newId();
		const issuanceId = newId();
		const now = new Date();
		const expiresAt = campaign.validDays ? new Date(now.getTime() + campaign.validDays * DAY_MS) : null;

		const insertedReward = await db
			.insert(customerRewards)
			.values({
				id: rewardId,
				businessId,
				customerId,
				rewardDefinitionId: campaign.rewardDefinitionId,
				expiresAt,
				locationId,
				issuanceKey: `item-campaign:${cycleKey}`,
			})
			.onConflictDoNothing()
			.returning({ id: customerRewards.id });

		const effectiveRewardId = insertedReward[0]?.id;
		if (!effectiveRewardId) {
			continue;
		}

		await db
			.insert(itemCampaignRewardIssuances)
			.values({
				id: issuanceId,
				businessId,
				campaignId,
				customerId,
				cycleIndex,
				activeCycleKey: cycleKey,
				releasedCycleKey: null,
				customerRewardId: effectiveRewardId,
				billEventId,
				issuedAt: now,
				cancelledAt: null,
			})
			.onConflictDoNothing();

		if (staffId) {
			await db.insert(auditLogs).values({
				businessId,
				actorUserId: staffId,
				actorRole: "staff",
				action: "item_campaign_reward_issued",
				entityType: "item_campaign",
				entityId: campaignId,
				newValueJson: {
					cycleIndex,
					customerId,
					rewardId: effectiveRewardId,
				},
			});
		}
	}
}

export async function settleCampaignRewardsForBillEvent(params: {
	db: Db;
	billEventId: string;
}): Promise<void> {
	const { db, billEventId } = params;
	const bill = await db.query.billEvents.findFirst({
		where: eq(billEvents.id, billEventId),
	});
	if (!bill) return;
	if (bill.reversedAt) return;
	if (bill.rewardsSettledAt) return;

	const purchaseRows = await db
		.select({ campaignId: itemCampaignTransactions.campaignId })
		.from(itemCampaignTransactions)
		.where(
			and(
				eq(itemCampaignTransactions.billEventId, billEventId),
				eq(itemCampaignTransactions.transactionType, "purchase"),
			),
		);
	const campaignIds = [...new Set(purchaseRows.map((row) => row.campaignId))];

	for (const campaignId of campaignIds) {
		await settleCampaignForCustomer({
			db,
			businessId: bill.businessId,
			campaignId,
			customerId: bill.customerId,
			locationId: bill.locationId,
			staffId: bill.staffId,
			billEventId,
		});
	}

	await db
		.update(billEvents)
		.set({ rewardsSettledAt: new Date() })
		.where(eq(billEvents.id, billEventId));
}

async function replayCommittedBill(params: {
	db: Db;
	businessId: string;
	customerId: string;
	requestIdempotencyKey: string;
}): Promise<StaffCampaignBillCommitPayload | null> {
	const { db, businessId, customerId, requestIdempotencyKey } = params;
	const bill = await db.query.billEvents.findFirst({
		where: and(
			eq(billEvents.businessId, businessId),
			eq(billEvents.requestIdempotencyKey, requestIdempotencyKey),
		),
	});
	if (!bill) return null;

	const pointsAward = await db.query.pointsAwards.findFirst({
		where: eq(pointsAwards.billEventId, bill.id),
		columns: { id: true },
	});
	const summary = await pointsSummaryForCustomer(db, businessId, customerId);
	const storedQuote = parseStoredQuote(bill.calculationJson);
	if (!storedQuote) {
		throw new ApiError("internal_error", "Stored bill quote could not be replayed.");
	}

	return {
		...storedQuote,
		billEventId: bill.id,
		pointsAwardId: pointsAward?.id ?? null,
		duplicateOverride: bill.duplicateOverride,
		summary,
	};
}

export async function quoteCampaignBill(params: {
	db: Db;
	businessId: string;
	customerId: string;
	billTotalCents: number;
	otherExcludedSpendCents: number;
	campaignLines: StaffCampaignBillLineInput[];
}): Promise<StaffCampaignBillQuotePayload> {
	const quote = await calculateBillQuote({
		db: params.db,
		businessId: params.businessId,
		customerId: params.customerId,
		billTotalCents: params.billTotalCents,
		otherExcludedSpendCents: params.otherExcludedSpendCents,
		campaignLines: params.campaignLines,
		now: new Date(),
	});
	return quote.payload;
}

export async function commitCampaignBill(params: {
	db: Db;
	businessId: string;
	customerId: string;
	locationId: string;
	staffId: string;
	staffRole: Role;
	staffAuthUserId: string;
	billTotalCents: number;
	otherExcludedSpendCents: number;
	billReference: string;
	requestIdempotencyKey: string;
	duplicateOverrideReason: string | null;
	campaignLines: StaffCampaignBillLineInput[];
}): Promise<StaffCampaignBillCommitPayload> {
	const {
		db,
		businessId,
		customerId,
		locationId,
		staffId,
		staffRole,
		staffAuthUserId,
		billTotalCents,
		otherExcludedSpendCents,
		billReference,
		requestIdempotencyKey,
		duplicateOverrideReason,
		campaignLines,
	} = params;

	const replay = await replayCommittedBill({
		db,
		businessId,
		customerId,
		requestIdempotencyKey,
	});
	if (replay) return replay;

	const now = new Date();
	const quote = await calculateBillQuote({
		db,
		businessId,
		customerId,
		billTotalCents,
		otherExcludedSpendCents,
		campaignLines,
		now,
	});

	const normalizedReference = normalizeBillReference(billReference);
	if (!normalizedReference) {
		throw new ApiError("validation_failed", "Bill reference is required.");
	}

	const timezone = await getBusinessTimezone(db, businessId);
	const businessDay = businessDayKey(now, timezone);
	const dedupeGuardKey = buildDedupeGuardKey({
		businessId,
		locationId,
		businessDay,
		billReferenceKey: normalizedReference,
	});
	const duplicateOverride = Boolean(duplicateOverrideReason?.trim());

	let collidingBillEventId: string | null = null;
	if (duplicateOverride) {
		if (!(staffRole === "admin" || staffRole === "owner")) {
			throw new ApiError("forbidden", "Only admin or owner can override a duplicate receipt.");
		}
		if ((duplicateOverrideReason?.trim().length ?? 0) < 5) {
			throw new ApiError("validation_failed", "Duplicate override reason must be at least 5 characters.");
		}
		const colliding = await db.query.billEvents.findFirst({
			where: and(
				eq(billEvents.dedupeGuardKey, dedupeGuardKey),
				isNull(billEvents.reversedAt),
			),
			columns: { id: true },
		});
		if (!colliding) {
			throw new ApiError("conflict", "No duplicate bill exists for this reference to override.");
		}
		collidingBillEventId = colliding.id;
	} else {
		const colliding = await db.query.billEvents.findFirst({
			where: and(
				eq(billEvents.dedupeGuardKey, dedupeGuardKey),
				isNull(billEvents.reversedAt),
			),
			columns: { id: true, createdAt: true },
		});
		if (colliding) {
			throw new ApiError("conflict", "This bill reference was already captured.", {
				existingBillEventId: colliding.id,
				createdAt: colliding.createdAt.toISOString(),
			});
		}
	}

	const billEventId = newId();
	let pointsAwardId: string | null = null;

	const batchOps: any[] = [];
	batchOps.push(
		db.insert(billEvents).values({
			id: billEventId,
			businessId,
			locationId,
			customerId,
			staffId,
			source: "staff_manual",
			billTotalCents,
			campaignSpendCents: quote.payload.campaignSpendCents,
			excludedCampaignSpendCents: quote.payload.excludedCampaignSpendCents,
			otherExcludedSpendCents,
			eligibleSpendCents: quote.payload.eligibleSpendCents,
			totalPoints: quote.payload.totalPoints,
			billReference,
			billReferenceKey: normalizedReference,
			businessDay,
			dedupeGuardKey: duplicateOverride ? null : dedupeGuardKey,
			releasedGuardKey: null,
			duplicateOverride,
			duplicateOverrideReason: duplicateOverride ? (duplicateOverrideReason?.trim() ?? null) : null,
			duplicateOverrideBy: duplicateOverride ? staffId : null,
			requestIdempotencyKey,
			calculationJson: { quotePayload: quote.payload },
		}),
	);

	if (quote.payload.totalPoints > 0) {
		const program = await requirePointsProgram(db, businessId);
		pointsAwardId = newId();
		const earnTxId = newId();
		const bonusTxId = newId();
		batchOps.push(
			db.insert(pointsAwards).values({
				id: pointsAwardId,
				businessId,
				programId: program.id,
				customerId,
				billEventId,
				locationId,
				staffId,
				source: "staff_manual",
				eligibleSpendCents: quote.payload.eligibleSpendCents,
				ratePoints: program.earnRatePoints,
				rateSpendCents: program.earnRateSpendCents,
				basePoints: quote.payload.basePoints,
				bonusPoints: quote.payload.bonusPoints,
				totalPoints: quote.payload.totalPoints,
				multiplierPromotionId: quote.multiplierPromotionId,
				multiplierPromotionName: quote.payload.multiplierPromotionName,
				appliedMultiplierBp: quote.payload.appliedMultiplierBp,
				bonusPromotionId: quote.bonusPromotionId,
				bonusPromotionName: quote.payload.fixedBonusPromotionName,
				appliedFixedBonusPoints: quote.payload.appliedFixedBonusPoints,
				billReference,
				billReferenceKey: normalizedReference,
				businessDay,
				dedupeGuardKey: duplicateOverride ? null : dedupeGuardKey,
				releasedGuardKey: null,
				duplicateOverride,
				duplicateOverrideReason: duplicateOverride ? (duplicateOverrideReason?.trim() ?? null) : null,
				duplicateOverrideBy: duplicateOverride ? staffId : null,
				requestIdempotencyKey: `points:${requestIdempotencyKey}`,
				calculationJson: { quotePayload: quote.payload },
			}),
			db.insert(loyaltyTransactions).values({
				id: earnTxId,
				businessId,
				locationId,
				customerId,
				staffId,
				programId: program.id,
				transactionType: "earn",
				quantity: quote.payload.basePoints,
				spendAmountCents: quote.payload.eligibleSpendCents,
				billReference,
				notes: `${program.name} bill points`,
				idempotencyKey: `points-earn:${pointsAwardId}`,
				pointsAwardId,
				relatedTransactionId: null,
			}),
		);

		if (quote.payload.bonusPoints > 0) {
			batchOps.push(
				db.insert(loyaltyTransactions).values({
					id: bonusTxId,
					businessId,
					locationId,
					customerId,
					staffId,
					programId: program.id,
					transactionType: "bonus",
					quantity: quote.payload.bonusPoints,
					spendAmountCents: null,
					billReference,
					notes: quote.payload.fixedBonusPromotionName
						? `${quote.payload.fixedBonusPromotionName} bonus`
						: "Points promotion bonus",
					idempotencyKey: `points-bonus:${pointsAwardId}`,
					pointsAwardId,
					relatedTransactionId: earnTxId,
				}),
			);
		}
	}

	for (const line of quote.payload.lines) {
		if (line.quantity <= 0) continue;
		batchOps.push(
			db.insert(itemCampaignTransactions).values({
				id: newId(),
				businessId,
				campaignId: line.campaignId,
				customerId,
				locationId,
				staffId,
				billEventId,
				transactionType: "purchase",
				quantity: line.quantity,
				unitPriceCents: line.unitPriceCents,
				campaignSpendCents: line.campaignSpendCents,
				earnsRewardPoints: line.earnsRewardPoints,
				campaignNameSnapshot: line.name,
				itemReferenceSnapshot: line.itemReference,
				billReference,
				reason: null,
				approvedBy: null,
				idempotencyKey: `campaign:${billEventId}:${line.campaignId}:purchase`,
				relatedTransactionId: null,
			}),
		);
	}

	try {
		await db.batch(batchOps as [typeof batchOps[number], ...typeof batchOps[number][]]);
	} catch (error) {
		const replayAfterError = await replayCommittedBill({
			db,
			businessId,
			customerId,
			requestIdempotencyKey,
		});
		if (replayAfterError) {
			return replayAfterError;
		}
		throw error;
	}

	if (duplicateOverride && collidingBillEventId) {
		await db.insert(auditLogs).values({
			businessId,
			actorUserId: staffAuthUserId,
			actorRole: staffRole,
			action: "admin.bill_duplicate_override",
			entityType: "bill_event",
			entityId: billEventId,
			newValueJson: {
				dedupeGuardKey,
				collidingBillEventId,
				reason: duplicateOverrideReason,
			},
		});
	}

	await settleCampaignRewardsForBillEvent({ db, billEventId });

	const summary = await pointsSummaryForCustomer(db, businessId, customerId);
	return {
		...quote.payload,
		billEventId,
		pointsAwardId,
		duplicateOverride,
		summary,
	};
}

export async function listCustomerItemCampaignProgress(params: {
	db: Db;
	businessId: string;
	customerId: string;
	includeInactive?: boolean;
}): Promise<CustomerItemCampaignProgress[]> {
	const { db, businessId, customerId, includeInactive = false } = params;
	const now = new Date();
	const rows = await db
		.select({
			campaignId: itemCampaigns.id,
			name: itemCampaigns.name,
			description: itemCampaigns.description,
			status: itemCampaigns.status,
			itemReference: itemCampaigns.itemReference,
			unitPriceCents: itemCampaigns.unitPriceCents,
			targetQuantity: itemCampaigns.targetQuantity,
			rewardName: rewardDefinitions.name,
			rewardType: rewardDefinitions.rewardType,
			earnsRewardPoints: itemCampaigns.earnsRewardPoints,
			maxQuantityPerBill: itemCampaigns.maxQuantityPerBill,
			windowStartAt: itemCampaigns.startAt,
			windowEndAt: itemCampaigns.endAt,
		})
		.from(itemCampaigns)
		.innerJoin(rewardDefinitions, eq(itemCampaigns.rewardDefinitionId, rewardDefinitions.id))
		.where(
			and(
				eq(itemCampaigns.businessId, businessId),
				includeInactive
					? ne(itemCampaigns.status, "archived")
					: and(
						eq(itemCampaigns.status, "active"),
						or(isNull(itemCampaigns.startAt), lte(itemCampaigns.startAt, now)),
						or(isNull(itemCampaigns.endAt), gt(itemCampaigns.endAt, now)),
					),
			),
		)
		.orderBy(asc(itemCampaigns.sortOrder), asc(itemCampaigns.name));

	const progress = await campaignProgressMap(
		db,
		businessId,
		customerId,
		rows.map((row) => row.campaignId),
	);

	return rows.map((row) => {
		const snapshot = progress.get(row.campaignId) ?? {
			netQuantity: 0,
			consumedCycleCount: 0,
			lastActivityAt: null,
		};
		const lastActivityAtIso =
			snapshot.lastActivityAt == null
				? null
				: new Date(snapshot.lastActivityAt).toISOString();
		const metrics = computeCampaignSnapshot({
			netQuantity: snapshot.netQuantity,
			targetQuantity: row.targetQuantity,
			consumedCycleCount: snapshot.consumedCycleCount,
		});
		return {
			campaignId: row.campaignId,
			name: row.name,
			description: row.description,
			status: row.status,
			itemReference: row.itemReference,
			unitPriceCents: row.unitPriceCents,
			targetQuantity: row.targetQuantity,
			rewardName: row.rewardName,
			rewardType: row.rewardType,
			earnsRewardPoints: row.earnsRewardPoints,
			maxQuantityPerBill: row.maxQuantityPerBill,
			windowStartAt: row.windowStartAt?.toISOString() ?? null,
			windowEndAt: row.windowEndAt?.toISOString() ?? null,
			netQuantity: snapshot.netQuantity,
			consumedCycleCount: snapshot.consumedCycleCount,
			nextCycleIndex: metrics.nextCycleIndex,
			progressInActiveCycle: metrics.progressInActiveCycle,
			remainingToNextReward: metrics.remainingToNextReward,
			catchUpQuantity: metrics.catchUpQuantity,
			inCatchUp: metrics.inCatchUp,
			activeCycleKey: `${row.campaignId}:${customerId}:${metrics.nextCycleIndex}`,
			lastActivityAt: lastActivityAtIso,
		};
	});
}

export async function listStaffItemCampaignContext(params: {
	db: Db;
	businessId: string;
	customerId: string;
}): Promise<StaffItemCampaignContext[]> {
	const rows = await listCustomerItemCampaignProgress({
		db: params.db,
		businessId: params.businessId,
		customerId: params.customerId,
		includeInactive: false,
	});
	return rows.map((row) => ({
		campaignId: row.campaignId,
		name: row.name,
		description: row.description,
		status: row.status,
		itemReference: row.itemReference,
		unitPriceCents: row.unitPriceCents,
		targetQuantity: row.targetQuantity,
		rewardName: row.rewardName,
		earnsRewardPoints: row.earnsRewardPoints,
		maxQuantityPerBill: row.maxQuantityPerBill,
		windowStartAt: row.windowStartAt,
		windowEndAt: row.windowEndAt,
		currentNetQuantity: row.netQuantity,
		consumedCycleCount: row.consumedCycleCount,
		nextCycleIndex: row.nextCycleIndex,
		progressInActiveCycle: row.progressInActiveCycle,
		remainingToNextReward: row.remainingToNextReward,
		catchUpQuantity: row.catchUpQuantity,
		inCatchUp: row.inCatchUp,
	}));
}

export async function listAdminItemCampaigns(params: {
	db: Db;
	businessId: string;
}): Promise<AdminItemCampaignPayload[]> {
	const rows = await params.db
		.select({
			id: itemCampaigns.id,
			name: itemCampaigns.name,
			description: itemCampaigns.description,
			status: itemCampaigns.status,
			itemReference: itemCampaigns.itemReference,
			unitPriceCents: itemCampaigns.unitPriceCents,
			targetQuantity: itemCampaigns.targetQuantity,
			rewardDefinitionId: itemCampaigns.rewardDefinitionId,
			rewardName: rewardDefinitions.name,
			rewardType: rewardDefinitions.rewardType,
			earnsRewardPoints: itemCampaigns.earnsRewardPoints,
			maxQuantityPerBill: itemCampaigns.maxQuantityPerBill,
			windowStartAt: itemCampaigns.startAt,
			windowEndAt: itemCampaigns.endAt,
			sortOrder: itemCampaigns.sortOrder,
			createdAt: itemCampaigns.createdAt,
			updatedAt: itemCampaigns.updatedAt,
		})
		.from(itemCampaigns)
		.innerJoin(rewardDefinitions, eq(itemCampaigns.rewardDefinitionId, rewardDefinitions.id))
		.where(eq(itemCampaigns.businessId, params.businessId))
		.orderBy(asc(itemCampaigns.sortOrder), asc(itemCampaigns.name));

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		description: row.description,
		status: row.status,
		itemReference: row.itemReference,
		unitPriceCents: row.unitPriceCents,
		targetQuantity: row.targetQuantity,
		rewardDefinitionId: row.rewardDefinitionId,
		rewardName: row.rewardName,
		rewardType: row.rewardType,
		earnsRewardPoints: row.earnsRewardPoints,
		maxQuantityPerBill: row.maxQuantityPerBill,
		windowStartAt: row.windowStartAt?.toISOString() ?? null,
		windowEndAt: row.windowEndAt?.toISOString() ?? null,
		sortOrder: row.sortOrder,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	}));
}

export async function createAdminItemCampaign(params: {
	db: Db;
	businessId: string;
	actorUserId: string;
	actorRole: Role;
	input: {
		name: string;
		description: string | null;
		itemReference: string;
		unitPriceCents: number;
		targetQuantity: number;
		rewardDefinitionId: string;
		earnsRewardPoints: boolean;
		status: "active" | "disabled" | "archived";
		startAt: Date | null;
		endAt: Date | null;
		maxQuantityPerBill: number | null;
		sortOrder: number;
	};
}): Promise<AdminItemCampaignPayload> {
	const { db, businessId, actorUserId, actorRole, input } = params;
	const reward = await db.query.rewardDefinitions.findFirst({
		where: and(
			eq(rewardDefinitions.id, input.rewardDefinitionId),
			eq(rewardDefinitions.businessId, businessId),
			eq(rewardDefinitions.active, true),
		),
		columns: {
			id: true,
			name: true,
			rewardType: true,
		},
	});
	if (!reward) {
		throw new ApiError("validation_failed", "Reward definition must be active and belong to this business.");
	}
	if (!(reward.rewardType === "free_item" || reward.rewardType === "voucher")) {
		throw new ApiError("validation_failed", "Campaign rewards must be free item or voucher rewards.");
	}

	const itemReferenceKey = normalizeItemReference(input.itemReference);
	if (!itemReferenceKey) {
		throw new ApiError("validation_failed", "Item reference is required.");
	}
	if (input.status !== "archived") {
		const collisions = await db.query.itemCampaigns.findMany({
			where: and(
				eq(itemCampaigns.businessId, businessId),
				eq(itemCampaigns.activeItemKey, itemReferenceKey),
				ne(itemCampaigns.status, "archived"),
			),
			columns: {
				id: true,
				name: true,
				startAt: true,
				endAt: true,
			},
		});
		for (const collision of collisions) {
			if (windowsOverlap(collision.startAt, collision.endAt, input.startAt, input.endAt)) {
				throw new ApiError("conflict", `Campaign ${collision.name} already overlaps this item and time window.`);
			}
		}
	}

	const [created] = await db
		.insert(itemCampaigns)
		.values({
			businessId,
			name: input.name,
			description: input.description,
			itemReference: input.itemReference,
			itemReferenceKey,
			activeItemKey: input.status === "archived" ? null : itemReferenceKey,
			unitPriceCents: input.unitPriceCents,
			targetQuantity: input.targetQuantity,
			rewardDefinitionId: input.rewardDefinitionId,
			earnsRewardPoints: input.earnsRewardPoints,
			status: input.status,
			startAt: input.startAt,
			endAt: input.endAt,
			maxQuantityPerBill: input.maxQuantityPerBill,
			sortOrder: input.sortOrder,
			archivedAt: input.status === "archived" ? new Date() : null,
		})
		.returning();
	if (!created) {
		throw new ApiError("internal_error", "Failed to create campaign.");
	}

	await db.insert(auditLogs).values({
		businessId,
		actorUserId,
		actorRole,
		action: "admin.item_campaign_created",
		entityType: "item_campaign",
		entityId: created.id,
		newValueJson: {
			name: created.name,
			itemReference: created.itemReference,
			rewardDefinitionId: created.rewardDefinitionId,
		},
	});

	return {
		id: created.id,
		name: created.name,
		description: created.description,
		status: created.status,
		itemReference: created.itemReference,
		unitPriceCents: created.unitPriceCents,
		targetQuantity: created.targetQuantity,
		rewardDefinitionId: created.rewardDefinitionId,
		rewardName: reward.name,
		rewardType: reward.rewardType,
		earnsRewardPoints: created.earnsRewardPoints,
		maxQuantityPerBill: created.maxQuantityPerBill,
		windowStartAt: created.startAt?.toISOString() ?? null,
		windowEndAt: created.endAt?.toISOString() ?? null,
		sortOrder: created.sortOrder,
		createdAt: created.createdAt.toISOString(),
		updatedAt: created.updatedAt.toISOString(),
	};
}

export async function updateAdminItemCampaign(params: {
	db: Db;
	businessId: string;
	campaignId: string;
	actorUserId: string;
	actorRole: Role;
	input: {
		name?: string;
		description?: string | null;
		itemReference?: string;
		unitPriceCents?: number;
		targetQuantity?: number;
		rewardDefinitionId?: string;
		earnsRewardPoints?: boolean;
		status?: "active" | "disabled" | "archived";
		startAt?: Date | null;
		endAt?: Date | null;
		maxQuantityPerBill?: number | null;
		sortOrder?: number;
	};
}): Promise<AdminItemCampaignPayload> {
	const { db, businessId, campaignId, actorRole, actorUserId, input } = params;
	const existing = await db.query.itemCampaigns.findFirst({
		where: and(eq(itemCampaigns.id, campaignId), eq(itemCampaigns.businessId, businessId)),
	});
	if (!existing) {
		throw new ApiError("not_found", "Campaign not found.");
	}

	const nextRewardDefinitionId = input.rewardDefinitionId ?? existing.rewardDefinitionId;
	const reward = await db.query.rewardDefinitions.findFirst({
		where: and(
			eq(rewardDefinitions.id, nextRewardDefinitionId),
			eq(rewardDefinitions.businessId, businessId),
			eq(rewardDefinitions.active, true),
		),
		columns: { id: true, name: true, rewardType: true },
	});
	if (!reward) {
		throw new ApiError("validation_failed", "Reward definition must be active and belong to this business.");
	}
	if (!(reward.rewardType === "free_item" || reward.rewardType === "voucher")) {
		throw new ApiError("validation_failed", "Campaign rewards must be free item or voucher rewards.");
	}

	const status = input.status ?? existing.status;
	const itemReference = input.itemReference ?? existing.itemReference;
	const itemReferenceKey = normalizeItemReference(itemReference);
	const startAt = input.startAt === undefined ? existing.startAt : input.startAt;
	const endAt = input.endAt === undefined ? existing.endAt : input.endAt;
	if (status !== "archived") {
		const collisions = await db.query.itemCampaigns.findMany({
			where: and(
				eq(itemCampaigns.businessId, businessId),
				eq(itemCampaigns.activeItemKey, itemReferenceKey),
				ne(itemCampaigns.status, "archived"),
				ne(itemCampaigns.id, campaignId),
			),
			columns: { id: true, name: true, startAt: true, endAt: true },
		});
		for (const collision of collisions) {
			if (windowsOverlap(collision.startAt, collision.endAt, startAt, endAt)) {
				throw new ApiError("conflict", `Campaign ${collision.name} already overlaps this item and time window.`);
			}
		}
	}

	const [updated] = await db
		.update(itemCampaigns)
		.set({
			name: input.name ?? existing.name,
			description: input.description === undefined ? existing.description : input.description,
			itemReference,
			itemReferenceKey,
			activeItemKey: status === "archived" ? null : itemReferenceKey,
			unitPriceCents: input.unitPriceCents ?? existing.unitPriceCents,
			targetQuantity: input.targetQuantity ?? existing.targetQuantity,
			rewardDefinitionId: nextRewardDefinitionId,
			earnsRewardPoints: input.earnsRewardPoints ?? existing.earnsRewardPoints,
			status,
			startAt,
			endAt,
			maxQuantityPerBill:
				input.maxQuantityPerBill === undefined
					? existing.maxQuantityPerBill
					: input.maxQuantityPerBill,
			sortOrder: input.sortOrder ?? existing.sortOrder,
			archivedAt: status === "archived" ? (existing.archivedAt ?? new Date()) : null,
		})
		.where(eq(itemCampaigns.id, campaignId))
		.returning();
	if (!updated) {
		throw new ApiError("internal_error", "Failed to update campaign.");
	}

	await db.insert(auditLogs).values({
		businessId,
		actorUserId,
		actorRole,
		action: "admin.item_campaign_updated",
		entityType: "item_campaign",
		entityId: campaignId,
		oldValueJson: {
			name: existing.name,
			status: existing.status,
			itemReference: existing.itemReference,
			rewardDefinitionId: existing.rewardDefinitionId,
		},
		newValueJson: {
			name: updated.name,
			status: updated.status,
			itemReference: updated.itemReference,
			rewardDefinitionId: updated.rewardDefinitionId,
		},
	});

	return {
		id: updated.id,
		name: updated.name,
		description: updated.description,
		status: updated.status,
		itemReference: updated.itemReference,
		unitPriceCents: updated.unitPriceCents,
		targetQuantity: updated.targetQuantity,
		rewardDefinitionId: updated.rewardDefinitionId,
		rewardName: reward.name,
		rewardType: reward.rewardType,
		earnsRewardPoints: updated.earnsRewardPoints,
		maxQuantityPerBill: updated.maxQuantityPerBill,
		windowStartAt: updated.startAt?.toISOString() ?? null,
		windowEndAt: updated.endAt?.toISOString() ?? null,
		sortOrder: updated.sortOrder,
		createdAt: updated.createdAt.toISOString(),
		updatedAt: updated.updatedAt.toISOString(),
	};
}

export async function reverseBillEventWithCampaigns(params: {
	db: Db;
	businessId: string;
	billEventId: string;
	actorProfileId: string;
	actorUserId: string;
	actorRole: Role;
	reason: string;
}): Promise<{ reversed: true; pointsAwardId: string | null }> {
	const { db, businessId, billEventId, actorProfileId, actorRole, actorUserId, reason } = params;
	const cleanReason = reason.trim();
	if (cleanReason.length < 5) {
		throw new ApiError("validation_failed", "Reversal reason must be at least 5 characters.");
	}

	const bill = await db.query.billEvents.findFirst({
		where: and(eq(billEvents.id, billEventId), eq(billEvents.businessId, businessId)),
	});
	if (!bill) {
		throw new ApiError("not_found", "Bill event not found.");
	}
	if (bill.reversedAt) {
		throw new ApiError("conflict", "This bill has already been reversed.");
	}

	const now = new Date();
	const purchaseRows = await db.query.itemCampaignTransactions.findMany({
		where: and(
			eq(itemCampaignTransactions.billEventId, billEventId),
			eq(itemCampaignTransactions.transactionType, "purchase"),
		),
	});

	for (const row of purchaseRows) {
		await db
			.insert(itemCampaignTransactions)
			.values({
				id: newId(),
				businessId,
				campaignId: row.campaignId,
				customerId: row.customerId,
				locationId: row.locationId,
				staffId: actorProfileId,
				billEventId,
				transactionType: "reversal",
				quantity: -Math.abs(row.quantity),
				unitPriceCents: row.unitPriceCents,
				campaignSpendCents: -Math.abs(row.campaignSpendCents),
				earnsRewardPoints: row.earnsRewardPoints,
				campaignNameSnapshot: row.campaignNameSnapshot,
				itemReferenceSnapshot: row.itemReferenceSnapshot,
				billReference: bill.billReference,
				reason: cleanReason,
				approvedBy: actorProfileId,
				idempotencyKey: `campaign-reversal:${row.id}`,
				relatedTransactionId: row.id,
			})
			.onConflictDoNothing();
	}

	await db
		.update(billEvents)
		.set({
			reversedAt: now,
			reversedBy: actorProfileId,
			reversalReason: cleanReason,
			releasedGuardKey: bill.dedupeGuardKey,
			dedupeGuardKey: null,
			rewardsSettledAt: null,
		})
		.where(eq(billEvents.id, billEventId));

	for (const campaignId of [...new Set(purchaseRows.map((row) => row.campaignId))]) {
		await settleCampaignForCustomer({
			db,
			businessId,
			campaignId,
			customerId: bill.customerId,
			locationId: bill.locationId,
			staffId: actorProfileId,
			billEventId,
		});
	}

	const pointsAward = await db.query.pointsAwards.findFirst({
		where: eq(pointsAwards.billEventId, billEventId),
		columns: { id: true },
	});

	await db.insert(auditLogs).values({
		businessId,
		actorUserId,
		actorRole,
		action: "admin.bill_event_reversed",
		entityType: "bill_event",
		entityId: billEventId,
		newValueJson: { reason: cleanReason },
	});

	return { reversed: true, pointsAwardId: pointsAward?.id ?? null };
}

export async function listAdminItemCampaignActivity(params: {
	db: Db;
	businessId: string;
	from?: Date;
	to?: Date;
	campaignId?: string;
	limit: number;
	offset: number;
}): Promise<AdminItemCampaignActivityPayload> {
	const where = and(
		eq(itemCampaignTransactions.businessId, params.businessId),
		params.campaignId ? eq(itemCampaignTransactions.campaignId, params.campaignId) : undefined,
		params.from ? gte(itemCampaignTransactions.createdAt, params.from) : undefined,
		params.to ? lte(itemCampaignTransactions.createdAt, params.to) : undefined,
	);

	const [rows, [countRow]] = await Promise.all([
		params.db
			.select({
				id: itemCampaignTransactions.id,
				campaignId: itemCampaignTransactions.campaignId,
				campaignName: itemCampaignTransactions.campaignNameSnapshot,
				customerId: itemCampaignTransactions.customerId,
				customerName: profiles.fullName,
				billEventId: itemCampaignTransactions.billEventId,
				billReference: itemCampaignTransactions.billReference,
				transactionType: itemCampaignTransactions.transactionType,
				quantity: itemCampaignTransactions.quantity,
				campaignSpendCents: itemCampaignTransactions.campaignSpendCents,
				createdAt: itemCampaignTransactions.createdAt,
				staffId: itemCampaignTransactions.staffId,
				locationId: itemCampaignTransactions.locationId,
				locationName: locations.name,
			})
			.from(itemCampaignTransactions)
			.innerJoin(profiles, eq(itemCampaignTransactions.customerId, profiles.id))
			.innerJoin(locations, eq(itemCampaignTransactions.locationId, locations.id))
			.where(where)
			.orderBy(desc(itemCampaignTransactions.createdAt))
			.limit(params.limit)
			.offset(params.offset),
		params.db
			.select({ total: sql<number>`count(*)` })
			.from(itemCampaignTransactions)
			.where(where),
	]);

	const staffIds = rows
		.map((row) => row.staffId)
		.filter((value): value is string => Boolean(value));
	const staffRows =
		staffIds.length > 0
			? await params.db
				.select({ id: profiles.id, fullName: profiles.fullName })
				.from(profiles)
				.where(inArray(profiles.id, staffIds))
			: [];
	const staffNameById = new Map(staffRows.map((row) => [row.id, row.fullName]));

	return {
		rows: rows.map((row) => ({
			id: row.id,
			campaignId: row.campaignId,
			campaignName: row.campaignName,
			customerId: row.customerId,
			customerName: row.customerName,
			billEventId: row.billEventId,
			billReference: row.billReference,
			transactionType: row.transactionType,
			quantity: row.quantity,
			campaignSpendCents: row.campaignSpendCents,
			createdAt: row.createdAt.toISOString(),
			staffId: row.staffId,
			staffName: row.staffId ? (staffNameById.get(row.staffId) ?? null) : null,
			locationId: row.locationId,
			locationName: row.locationName,
		})),
		limit: params.limit,
		offset: params.offset,
		total: countRow?.total ?? 0,
	};
}

export async function listAdminItemCampaignReport(params: {
	db: Db;
	businessId: string;
	from?: Date;
	to?: Date;
}): Promise<AdminItemCampaignReportPayload> {
	const from = params.from ?? new Date(Date.now() - 30 * DAY_MS);
	const to = params.to ?? new Date();
	const rows = await params.db
		.select({
			campaignId: itemCampaignTransactions.campaignId,
			campaignName: itemCampaignTransactions.campaignNameSnapshot,
			unitsPurchased: sql<number>`coalesce(sum(case when ${itemCampaignTransactions.transactionType}='purchase' then ${itemCampaignTransactions.quantity} else 0 end), 0)`,
			unitsReversed: sql<number>`coalesce(sum(case when ${itemCampaignTransactions.transactionType}='reversal' then abs(${itemCampaignTransactions.quantity}) else 0 end), 0)`,
			netUnits: sql<number>`coalesce(sum(${itemCampaignTransactions.quantity}), 0)`,
			revenueCents: sql<number>`coalesce(sum(case when ${itemCampaignTransactions.transactionType}='purchase' then ${itemCampaignTransactions.campaignSpendCents} else 0 end), 0)`,
			participants: sql<number>`count(distinct ${itemCampaignTransactions.customerId})`,
			rewardsIssued: sql<number>`coalesce(count(distinct ${itemCampaignRewardIssuances.id}), 0)`,
		})
		.from(itemCampaignTransactions)
		.leftJoin(
			itemCampaignRewardIssuances,
			and(
				eq(itemCampaignRewardIssuances.campaignId, itemCampaignTransactions.campaignId),
				eq(itemCampaignRewardIssuances.customerId, itemCampaignTransactions.customerId),
				gte(itemCampaignRewardIssuances.createdAt, from),
				lte(itemCampaignRewardIssuances.createdAt, to),
			),
		)
		.where(
			and(
				eq(itemCampaignTransactions.businessId, params.businessId),
				gte(itemCampaignTransactions.createdAt, from),
				lte(itemCampaignTransactions.createdAt, to),
			),
		)
		.groupBy(
			itemCampaignTransactions.campaignId,
			itemCampaignTransactions.campaignNameSnapshot,
		)
		.orderBy(asc(itemCampaignTransactions.campaignNameSnapshot));

	return {
		from: from.toISOString(),
		to: to.toISOString(),
		rows: rows.map((row) => ({
			campaignId: row.campaignId,
			campaignName: row.campaignName,
			unitsPurchased: row.unitsPurchased,
			unitsReversed: row.unitsReversed,
			netUnits: row.netUnits,
			rewardsIssued: row.rewardsIssued,
			participants: row.participants,
			revenueCents: row.revenueCents,
		})),
	};
}

export async function settleOutstandingCampaignBillRewards(params: {
	db: Db;
	businessId: string;
	limit?: number;
}): Promise<{ settled: number }> {
	const limit = params.limit ?? 100;
	const rows = await params.db
		.select({ id: billEvents.id })
		.from(billEvents)
		.where(
			and(
				eq(billEvents.businessId, params.businessId),
				isNull(billEvents.reversedAt),
				isNull(billEvents.rewardsSettledAt),
			),
		)
		.orderBy(asc(billEvents.createdAt))
		.limit(limit);

	for (const row of rows) {
		await settleCampaignRewardsForBillEvent({ db: params.db, billEventId: row.id });
	}

	return { settled: rows.length };
}
