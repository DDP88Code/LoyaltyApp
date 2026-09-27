import { Hono } from "hono";
import { z } from "zod";
import type {
	StaffPointsAwardPayload,
	StaffPointsQuotePayload,
} from "@shared/rewardPoints";
import { getDb } from "@worker/db/client";
import { requireLocationInBusiness } from "@worker/lib/scope";
import { ok } from "@worker/lib/http";
import {
	awardPointsForBill,
	quotePointsAward,
} from "@worker/lib/points/service";
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

function randToCents(value: string): number {
	const [wholePart, decimalPart = ""] = value.split(".");
	const whole = Number(wholePart);
	const decimals = decimalPart.padEnd(2, "0").slice(0, 2);
	const cents = Number(decimals);
	return whole * 100 + cents;
}

export const staffPoints = new Hono<AppEnv>()
	.use("*", requireSession, requireStaff)
	.post("/customers/:customerId/quote", validate("json", quoteSchema), async (c) => {
		const profile = c.get("profile");
		const input = c.req.valid("json");
		const eligibleSpendCents = randToCents(input.eligibleSpendRand);
		await requireLocationInBusiness(getDb(c.env), profile.businessId, input.locationId);
		const payload = await quotePointsAward({
			db: getDb(c.env),
			businessId: profile.businessId,
			eligibleSpendCents,
		});
		return ok<StaffPointsQuotePayload>(c, payload);
	})
	.post("/customers/:customerId/award", validate("json", awardSchema), async (c) => {
		const profile = c.get("profile");
		const customerId = c.req.param("customerId");
		const input = c.req.valid("json");
		const eligibleSpendCents = randToCents(input.eligibleSpendRand);
		await requireLocationInBusiness(getDb(c.env), profile.businessId, input.locationId);

		const payload = await awardPointsForBill({
			db: getDb(c.env),
			businessId: profile.businessId,
			customerId,
			locationId: input.locationId,
			staffId: profile.id,
			staffRole: profile.role,
			staffAuthUserId: profile.authUserId,
			eligibleSpendCents,
			billReference: input.billReference,
			requestIdempotencyKey: input.requestIdempotencyKey,
			duplicateOverrideReason: input.duplicateOverrideReason ?? null,
		});
		return ok<StaffPointsAwardPayload>(c, payload);
	});
