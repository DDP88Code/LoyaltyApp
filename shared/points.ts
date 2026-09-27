export const POINTS_AWARD_SOURCES = ["staff_manual", "pos"] as const;
export type PointsAwardSource = (typeof POINTS_AWARD_SOURCES)[number];

export const POINTS_PROMOTION_TYPES = ["multiplier", "fixed_bonus"] as const;
export type PointsPromotionType = (typeof POINTS_PROMOTION_TYPES)[number];

export const POINTS_CURRENCY_CODE = "REWARD_POINTS";
export const POINTS_MULTIPLIER_BASE_BP = 10_000;
export const DEFAULT_POINTS_PROGRAM_NAME = "Reward Points";
export const POINTS_CATALOGUE_REWARD_TYPES = ["free_item", "voucher"] as const;
