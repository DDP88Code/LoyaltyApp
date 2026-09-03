import type { SessionUser } from "./api";
import type { CustomerRewardStatus, RewardType, TransactionType } from "./domain";

/** Derived from the ledger on every read — never stored as a running total. */
export interface CoffeeProgress {
	programId: string;
	programName: string;
	currencyCode: string;
	current: number;
	/** Admin-configurable. `null` means the program has no configured threshold. */
	threshold: number | null;
	cyclesCompleted: number;
}

export interface RewardSummary {
	id: string;
	name: string;
	rewardType: RewardType;
	status: CustomerRewardStatus;
	valueCents: number | null;
	issuedAt: string;
	expiresAt: string | null;
	redeemedAt: string | null;
}

export interface TransactionSummary {
	id: string;
	transactionType: TransactionType;
	quantity: number;
	/** `null` when the transaction isn't tied to a stamp/points program (e.g. a voucher redemption). */
	programName: string | null;
	billReference: string | null;
	notes: string | null;
	createdAt: string;
}

export interface PromotionSummary {
	id: string;
	title: string;
	subtitle: string | null;
	description: string | null;
	imageKey: string | null;
	ctaText: string | null;
	ctaUrl: string | null;
}

export interface MenuItemSummary {
	id: string;
	name: string;
	description: string;
	priceCents: number;
	imageKey: string | null;
	popular: boolean;
	vegetarian: boolean;
	spicy: boolean;
	available: boolean;
}

export interface MenuCategorySummary {
	id: string;
	name: string;
	description: string | null;
	imageKey: string | null;
	items: MenuItemSummary[];
}

export interface CustomerHomePayload {
	user: SessionUser;
	coffee: CoffeeProgress | null;
	availableRewards: RewardSummary[];
	activePromotion: PromotionSummary | null;
	pointsEnabled: boolean;
}

export interface CustomerRewardsPayload {
	coffee: CoffeeProgress | null;
	available: RewardSummary[];
	redeemed: RewardSummary[];
	expired: RewardSummary[];
	pointsEnabled: boolean;
}

export interface CustomerTransactionsPayload {
	transactions: TransactionSummary[];
	total: number;
	limit: number;
	offset: number;
}

export interface CustomerMenuPayload {
	categories: MenuCategorySummary[];
}
