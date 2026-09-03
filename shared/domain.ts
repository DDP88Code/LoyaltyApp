/** Domain vocabularies shared by the Worker schema, the API and the React client. */

export const PROGRAM_TYPES = ["stamp", "points"] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number];

/**
 * Ledger entry kinds. Progress and balances are always derived from these;
 * no table ever stores a running total as the source of truth.
 */
export const TRANSACTION_TYPES = [
	"earn",
	"bonus",
	"redeem",
	"adjustment",
	"reversal",
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const REWARD_TYPES = [
	"free_item",
	"voucher",
	"discount",
	"points_reward",
] as const;
export type RewardType = (typeof REWARD_TYPES)[number];

export const CUSTOMER_REWARD_STATUSES = [
	"available",
	"redeemed",
	"expired",
	"cancelled",
] as const;
export type CustomerRewardStatus = (typeof CUSTOMER_REWARD_STATUSES)[number];

export const DEFAULT_CURRENCY = "ZAR";
export const DEFAULT_TIMEZONE = "Africa/Johannesburg";

/** `currency_code` of the coffee stamp program. Stamp programs count units, not money. */
export const COFFEE_CURRENCY_CODE = "COFFEE";
