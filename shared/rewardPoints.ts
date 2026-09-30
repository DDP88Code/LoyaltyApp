import type { RewardType, TransactionType } from "./domain";
import type { ItemCampaignStatus } from "./itemCampaigns";

export interface CustomerPointsSummary {
	enabled: boolean;
	programName: string;
	availableBalance: number;
	recoveryPoints: number;
	inRecovery: boolean;
}

export interface CustomerPointsCatalogueItem {
	id: string;
	rewardDefinitionId: string;
	name: string;
	description: string | null;
	rewardType: RewardType;
	valueCents: number | null;
	pointsCost: number;
	terms: string | null;
	validDays: number | null;
	imageKey: string | null;
	active: boolean;
	sortOrder: number;
	maxPerCustomerPerPeriod: number | null;
	limitPeriodDays: number | null;
}

export interface CustomerPointsHistoryEntry {
	id: string;
	transactionType: TransactionType;
	quantity: number;
	label: string;
	detail: string | null;
	createdAt: string;
}

export interface CustomerPointsPayload {
	summary: CustomerPointsSummary;
	catalogue: CustomerPointsCatalogueItem[];
	history: CustomerPointsHistoryEntry[];
	campaigns: CustomerItemCampaignProgress[];
}

export interface CustomerPointsRedeemResultPayload {
	redeemed: true;
	summary: CustomerPointsSummary;
	customerRewardId: string;
	catalogueItemName: string;
	pointsCost: number;
}

export interface StaffPointsQuotePayload {
	programName: string;
	eligibleSpendCents: number;
	basePoints: number;
	bonusPoints: number;
	totalPoints: number;
	multiplierPromotionName: string | null;
	appliedMultiplierBp: number | null;
	fixedBonusPromotionName: string | null;
	appliedFixedBonusPoints: number | null;
}

export interface StaffPointsAwardPayload {
	awardId: string;
	programName: string;
	basePoints: number;
	bonusPoints: number;
	totalPoints: number;
	summary: CustomerPointsSummary;
	duplicateOverride: boolean;
}

export interface StaffPointsPromotionContext {
	enabled: boolean;
	programName: string | null;
	availableBalance: number;
	recoveryPoints: number;
	inRecovery: boolean;
	activePromotionSummary: string | null;
	itemCampaigns: StaffItemCampaignContext[];
}

export interface CustomerItemCampaignProgress {
	campaignId: string;
	name: string;
	description: string | null;
	status: ItemCampaignStatus;
	itemReference: string;
	unitPriceCents: number;
	targetQuantity: number;
	rewardName: string;
	rewardType: RewardType;
	earnsRewardPoints: boolean;
	maxQuantityPerBill: number | null;
	windowStartAt: string | null;
	windowEndAt: string | null;
	netQuantity: number;
	consumedCycleCount: number;
	nextCycleIndex: number;
	progressInActiveCycle: number;
	remainingToNextReward: number;
	catchUpQuantity: number;
	inCatchUp: boolean;
	activeCycleKey: string;
	lastActivityAt: string | null;
}

export interface StaffItemCampaignContext {
	campaignId: string;
	name: string;
	description: string | null;
	status: ItemCampaignStatus;
	itemReference: string;
	unitPriceCents: number;
	targetQuantity: number;
	rewardName: string;
	earnsRewardPoints: boolean;
	maxQuantityPerBill: number | null;
	windowStartAt: string | null;
	windowEndAt: string | null;
	currentNetQuantity: number;
	consumedCycleCount: number;
	nextCycleIndex: number;
	progressInActiveCycle: number;
	remainingToNextReward: number;
	catchUpQuantity: number;
	inCatchUp: boolean;
}

export interface StaffCampaignBillLineInput {
	campaignId: string;
	quantity: number;
}

export interface StaffCampaignBillLineQuotePayload {
	campaignId: string;
	name: string;
	itemReference: string;
	quantity: number;
	unitPriceCents: number;
	campaignSpendCents: number;
	earnsRewardPoints: boolean;
	targetQuantity: number;
	rewardName: string;
	maxQuantityPerBill: number | null;
	beforeNetQuantity: number;
	afterNetQuantity: number;
	beforeProgressInCycle: number;
	afterProgressInCycle: number;
	cyclesCompletedBefore: number;
	cyclesCompletedAfter: number;
	rewardsUnlockedByLine: number;
	catchUpQuantityAfter: number;
}

export interface StaffCampaignBillQuotePayload {
	programName: string;
	billTotalCents: number;
	campaignSpendCents: number;
	excludedCampaignSpendCents: number;
	otherExcludedSpendCents: number;
	eligibleSpendCents: number;
	basePoints: number;
	bonusPoints: number;
	totalPoints: number;
	multiplierPromotionName: string | null;
	appliedMultiplierBp: number | null;
	fixedBonusPromotionName: string | null;
	appliedFixedBonusPoints: number | null;
	lines: StaffCampaignBillLineQuotePayload[];
	rewardsUnlockedTotal: number;
	warnings: string[];
}

export interface StaffCampaignBillCommitPayload extends StaffCampaignBillQuotePayload {
	billEventId: string;
	pointsAwardId: string | null;
	duplicateOverride: boolean;
	summary: CustomerPointsSummary;
}

export interface AdminPointsProgramPayload {
	id: string;
	name: string;
	active: boolean;
	earnRatePoints: number;
	earnRateSpendCents: number;
}

export interface AdminPointsPromotionPayload {
	id: string;
	name: string;
	description: string | null;
	promotionType: "multiplier" | "fixed_bonus";
	multiplierBp: number | null;
	fixedBonusPoints: number | null;
	minEligibleSpendCents: number | null;
	startAt: string;
	endAt: string;
	enabled: boolean;
	archivedAt: string | null;
}

export interface AdminPointsCatalogueItemPayload extends CustomerPointsCatalogueItem {
	archivedAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface AdminPointsEligibleRewardPayload {
	id: string;
	name: string;
	rewardType: "free_item" | "voucher";
	valueCents: number | null;
}

export interface AdminPointsCataloguePayload {
	items: AdminPointsCatalogueItemPayload[];
	eligibleRewards: AdminPointsEligibleRewardPayload[];
	staffVoucherRedemptionEnabled: boolean;
}

export interface AdminPointsAwardActivityRow {
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
}

export interface AdminPointsRecoveryRow {
	customerId: string;
	customerName: string;
	rawBalance: number;
	recoveryPoints: number;
}

export interface AdminPointsActivityPayload {
	recentAwards: AdminPointsAwardActivityRow[];
	outstandingPoints: number;
	customersInRecovery: AdminPointsRecoveryRow[];
}

export interface AdminPointsReportPayload {
	pointsIssued: number;
	pointsIssuedFromPromotions: number;
	pointsRedeemed: number;
	pointsReversed: number;
	pointsAdjusted: number;
	outstandingPoints: number;
	customersInRecovery: number;
}

export interface AdminItemCampaignPayload {
	id: string;
	name: string;
	description: string | null;
	status: ItemCampaignStatus;
	itemReference: string;
	unitPriceCents: number;
	targetQuantity: number;
	rewardDefinitionId: string;
	rewardName: string;
	rewardType: RewardType;
	earnsRewardPoints: boolean;
	maxQuantityPerBill: number | null;
	windowStartAt: string | null;
	windowEndAt: string | null;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

export interface AdminItemCampaignsPayload {
	campaigns: AdminItemCampaignPayload[];
	eligibleRewards: AdminPointsEligibleRewardPayload[];
}

export interface AdminItemCampaignActivityRow {
	id: string;
	campaignId: string;
	campaignName: string;
	customerId: string;
	customerName: string;
	billEventId: string;
	billReference: string | null;
	transactionType: "purchase" | "reversal" | "adjustment";
	quantity: number;
	campaignSpendCents: number;
	createdAt: string;
	staffId: string | null;
	staffName: string | null;
	locationId: string;
	locationName: string;
}

export interface AdminItemCampaignActivityPayload {
	rows: AdminItemCampaignActivityRow[];
	limit: number;
	offset: number;
	total: number;
}

export interface AdminItemCampaignReportRow {
	campaignId: string;
	campaignName: string;
	unitsPurchased: number;
	unitsReversed: number;
	netUnits: number;
	rewardsIssued: number;
	participants: number;
	revenueCents: number;
}

export interface AdminItemCampaignReportPayload {
	from: string;
	to: string;
	rows: AdminItemCampaignReportRow[];
}
