import { Hono } from "hono";
import { z } from "zod";
import type {
	StaffCampaignBillCommitPayload,
	StaffCampaignBillQuotePayload,
	StaffPointsAwardPayload,
	StaffPointsQuotePayload,
} from "@shared/rewardPoints";
import { getDb } from "@worker/db/client";
import {
	commitCampaignBill,
	quoteCampaignBill,
} from "@worker/lib/itemCampaigns/service";
import { requireLocationInBusiness } from "@worker/lib/scope";
import { ok } from "@worker/lib/http";
import { requireSession, requireStaff } from "@worker/middleware/auth";
import { validate } from "@worker/middleware/validate";
import type { AppEnv } from "@worker/types";

const moneySchema = z
	.string()
	.trim()
	.regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount with up to 2 decimal places.");

const quoteSchema = z.object({
	locationId: z.string().trim().min(1).max(64),
	eligibleSpendRand: moneySchema,
	billReference: z.string().trim().min(1).max(120),
});

const awardSchema = quoteSchema.extend({
	requestIdempotencyKey: z.string().trim().min(8).max(128),
	duplicateOverrideReason: z.string().trim().min(5).max(500).nullable().optional(),
});

const campaignLineSchema = z.object({
	campaignId: z.string().trim().min(1).max(64),
	quantity: z.coerce.number().int().min(1).max(500),
});

const billQuoteSchema = z.object({
	locationId: z.string().trim().min(1).max(64),
	billTotalRand: moneySchema,
	otherExcludedSpendRand: moneySchema.default("0"),
	campaignLines: z.array(campaignLineSchema).max(30).default([]),
});

const billCommitSchema = billQuoteSchema.extend({
	billReference: z.string().trim().min(1).max(120),
	requestIdempotencyKey: z.string().trim().min(8).max(128),
	duplicateOverrideReason: z.string().trim().min(5).max(500).nullable().optional(),
});

function randToCents(value: string): number {
	const [wholePart, decimalPart = ""] = value.split(".");
	const whole = Number(wholePart);
	const decimals = decimalPart.padEnd(2, "0").slice(0, 2);
	const cents = Number(decimals);
	return whole * 100 + cents;
}

export const staffPoints = new Hono<AppEnv>()
	.use("*", requireSession, requireStaff)
	.post(
		"/customers/:customerId/bill/quote",
		validate("json", billQuoteSchema),
		async (c) => {
			const profile = c.get("profile");
			const customerId = c.req.param("customerId");
			const input = c.req.valid("json");
			const db = getDb(c.env);
			await requireLocationInBusiness(db, profile.businessId, input.locationId);
			const payload = await quoteCampaignBill({
				db,
				businessId: profile.businessId,
				customerId,
				billTotalCents: randToCents(input.billTotalRand),
				otherExcludedSpendCents: randToCents(input.otherExcludedSpendRand),
				campaignLines: input.campaignLines,
			});
			return ok<StaffCampaignBillQuotePayload>(c, payload);
		},
	)
	.post(
		"/customers/:customerId/bill",
		validate("json", billCommitSchema),
		async (c) => {
			const profile = c.get("profile");
			const customerId = c.req.param("customerId");
			const input = c.req.valid("json");
			const db = getDb(c.env);
			await requireLocationInBusiness(db, profile.businessId, input.locationId);

			const payload = await commitCampaignBill({
				db,
				businessId: profile.businessId,
				customerId,
				locationId: input.locationId,
				staffId: profile.id,
				staffRole: profile.role,
				staffAuthUserId: profile.authUserId,
				billTotalCents: randToCents(input.billTotalRand),
				otherExcludedSpendCents: randToCents(input.otherExcludedSpendRand),
				billReference: input.billReference,
				requestIdempotencyKey: input.requestIdempotencyKey,
				duplicateOverrideReason: input.duplicateOverrideReason ?? null,
				campaignLines: input.campaignLines,
			});

			return ok<StaffCampaignBillCommitPayload>(c, payload);
		},
	)
	.post("/customers/:customerId/quote", validate("json", quoteSchema), async (c) => {
		const profile = c.get("profile");
		const customerId = c.req.param("customerId");
		const input = c.req.valid("json");
		const db = getDb(c.env);
		await requireLocationInBusiness(db, profile.businessId, input.locationId);
		const payload = await quoteCampaignBill({
			db,
			businessId: profile.businessId,
			customerId,
			billTotalCents: randToCents(input.eligibleSpendRand),
			otherExcludedSpendCents: 0,
			campaignLines: [],
		});
		return ok<StaffPointsQuotePayload>(c, {
			programName: payload.programName,
			eligibleSpendCents: payload.eligibleSpendCents,
			basePoints: payload.basePoints,
			bonusPoints: payload.bonusPoints,
			totalPoints: payload.totalPoints,
			multiplierPromotionName: payload.multiplierPromotionName,
			appliedMultiplierBp: payload.appliedMultiplierBp,
			fixedBonusPromotionName: payload.fixedBonusPromotionName,
			appliedFixedBonusPoints: payload.appliedFixedBonusPoints,
		});
	})
	.post("/customers/:customerId/award", validate("json", awardSchema), async (c) => {
		const profile = c.get("profile");
		const customerId = c.req.param("customerId");
		const input = c.req.valid("json");
		const db = getDb(c.env);
		await requireLocationInBusiness(db, profile.businessId, input.locationId);

		const payload = await commitCampaignBill({
			db,
			businessId: profile.businessId,
			customerId,
			locationId: input.locationId,
			staffId: profile.id,
			staffRole: profile.role,
			staffAuthUserId: profile.authUserId,
			billTotalCents: randToCents(input.eligibleSpendRand),
			otherExcludedSpendCents: 0,
			billReference: input.billReference,
			requestIdempotencyKey: input.requestIdempotencyKey,
			duplicateOverrideReason: input.duplicateOverrideReason ?? null,
			campaignLines: [],
		});
		return ok<StaffPointsAwardPayload>(c, {
			awardId: payload.pointsAwardId ?? payload.billEventId,
			programName: payload.programName,
			basePoints: payload.basePoints,
			bonusPoints: payload.bonusPoints,
			totalPoints: payload.totalPoints,
			summary: payload.summary,
			duplicateOverride: payload.duplicateOverride,
		});
	});
