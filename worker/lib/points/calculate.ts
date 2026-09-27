import { POINTS_MULTIPLIER_BASE_BP } from "@shared/points";
import type { pointsPromotions } from "@worker/db/schema";

export interface PointsRate {
	points: number;
	spendCents: number;
}

export interface EvaluatedPointsPromotion {
	id: string;
	name: string;
	type: "multiplier" | "fixed_bonus";
	multiplierBp: number | null;
	fixedBonusPoints: number | null;
}

export interface PointsQuote {
	eligibleSpendCents: number;
	ratePoints: number;
	rateSpendCents: number;
	basePoints: number;
	bonusPoints: number;
	totalPoints: number;
	multiplierPromotion: EvaluatedPointsPromotion | null;
	bonusPromotion: EvaluatedPointsPromotion | null;
	calculationJson: Record<string, unknown>;
}

interface PromotionRowLike {
	id: string;
	name: string;
	promotionType: typeof pointsPromotions.$inferSelect.promotionType;
	multiplierBp: number | null;
	fixedBonusPoints: number | null;
	minEligibleSpendCents: number | null;
}

function pointsFromRate(eligibleSpendCents: number, rate: PointsRate): number {
	return Math.floor((eligibleSpendCents * rate.points) / rate.spendCents);
}

function pickWinningPromotions(
	eligibleSpendCents: number,
	promotions: PromotionRowLike[],
): { multiplier: PromotionRowLike | null; fixedBonus: PromotionRowLike | null } {
	const applicable = promotions.filter((promotion) => {
		if (
			promotion.minEligibleSpendCents !== null &&
			eligibleSpendCents < promotion.minEligibleSpendCents
		) {
			return false;
		}
		return true;
	});

	let multiplier: PromotionRowLike | null = null;
	let fixedBonus: PromotionRowLike | null = null;

	for (const promotion of applicable) {
		if (promotion.promotionType === "multiplier") {
			if (promotion.multiplierBp == null) continue;
			if (!multiplier || promotion.multiplierBp > (multiplier.multiplierBp ?? 0)) {
				multiplier = promotion;
			}
			continue;
		}
		if (promotion.fixedBonusPoints == null) continue;
		if (!fixedBonus || promotion.fixedBonusPoints > (fixedBonus.fixedBonusPoints ?? 0)) {
			fixedBonus = promotion;
		}
	}

	return { multiplier, fixedBonus };
}

export function calculatePointsQuote(
	eligibleSpendCents: number,
	rate: PointsRate,
	promotions: PromotionRowLike[],
): PointsQuote {
	const basePoints = pointsFromRate(eligibleSpendCents, rate);
	const winners = pickWinningPromotions(eligibleSpendCents, promotions);

	const multiplierBonus = winners.multiplier?.multiplierBp
		? Math.floor(
				(basePoints * (winners.multiplier.multiplierBp - POINTS_MULTIPLIER_BASE_BP)) /
				POINTS_MULTIPLIER_BASE_BP,
			)
		: 0;

	const fixedBonus = winners.fixedBonus?.fixedBonusPoints ?? 0;
	const bonusPoints = multiplierBonus + fixedBonus;
	const totalPoints = basePoints + bonusPoints;

	return {
		eligibleSpendCents,
		ratePoints: rate.points,
		rateSpendCents: rate.spendCents,
		basePoints,
		bonusPoints,
		totalPoints,
		multiplierPromotion: winners.multiplier
			? {
				id: winners.multiplier.id,
				name: winners.multiplier.name,
				type: "multiplier",
				multiplierBp: winners.multiplier.multiplierBp,
				fixedBonusPoints: null,
			}
			: null,
		bonusPromotion: winners.fixedBonus
			? {
				id: winners.fixedBonus.id,
				name: winners.fixedBonus.name,
				type: "fixed_bonus",
				multiplierBp: null,
				fixedBonusPoints: winners.fixedBonus.fixedBonusPoints,
			}
			: null,
		calculationJson: {
			eligibleSpendCents,
			rate,
			basePoints,
			multiplierPromotionId: winners.multiplier?.id ?? null,
			multiplierBp: winners.multiplier?.multiplierBp ?? null,
			multiplierBonus,
			fixedBonusPromotionId: winners.fixedBonus?.id ?? null,
			fixedBonusPoints: fixedBonus,
			bonusPoints,
			totalPoints,
		},
	};
}
