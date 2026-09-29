import type { RewardType, TransactionType } from "./domain";

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
