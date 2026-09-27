import { Hono } from "hono";
import { z } from "zod";
import type {
	CustomerPointsPayload,
	CustomerPointsRedeemResultPayload,
} from "@shared/rewardPoints";
import { getDb } from "@worker/db/client";
import { ok } from "@worker/lib/http";
import {
	listCustomerPointsPayload,
	redeemPointsCatalogueItem,
} from "@worker/lib/points/service";
import { requireCustomer, requireSession } from "@worker/middleware/auth";
import { validate } from "@worker/middleware/validate";
import type { AppEnv } from "@worker/types";

const redeemSchema = z.object({
	requestIdempotencyKey: z.string().trim().min(8).max(128),
});

export const customerPoints = new Hono<AppEnv>()
	.use("*", requireSession, requireCustomer)
	.get("/", async (c) => {
		const profile = c.get("profile");
		const payload = await listCustomerPointsPayload({
			db: getDb(c.env),
			businessId: profile.businessId,
			customerId: profile.id,
		});
		return ok<CustomerPointsPayload | null>(c, payload);
	})
	.post(
		"/redeem/:catalogueItemId",
		validate("json", redeemSchema),
		async (c) => {
			const profile = c.get("profile");
			const payload = await redeemPointsCatalogueItem({
				db: getDb(c.env),
				d1: c.env.DB,
				businessId: profile.businessId,
				customerId: profile.id,
				catalogueItemId: c.req.param("catalogueItemId"),
				requestIdempotencyKey: c.req.valid("json").requestIdempotencyKey,
			});
			return ok<CustomerPointsRedeemResultPayload>(c, payload);
		},
	);
