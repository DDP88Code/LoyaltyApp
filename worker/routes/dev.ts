import { Hono } from "hono";
import { z } from "zod";
import { getDb } from "@worker/db/client";
import { seedDevelopmentData } from "@worker/db/seed";
import { issueBirthdayRewardsForBusiness } from "@worker/lib/birthdayRewards";
import { ensureMvpDefaults } from "@worker/lib/defaults";
import { fail, ok } from "@worker/lib/http";
import { validate } from "@worker/middleware/validate";
import type { AppEnv } from "@worker/types";

const runBirthdayIssuanceSchema = z.object({
	businessId: z.string().trim().max(64).optional(),
	atIso: z.string().datetime({ offset: true }).optional(),
});

/**
 * Development-only utilities. Outside development these routes answer 404 like
 * any other unknown path, so a deployed Worker never admits they exist.
 */
export const dev = new Hono<AppEnv>();

dev.use("*", async (c, next) => {
	if (c.env.APP_ENV !== "development") {
		return fail(
			c,
			"not_found",
			`No API route for ${c.req.method} ${c.req.path}`,
		);
	}
	await next();
});

dev.post("/seed", async (c) => {
	const summary = await seedDevelopmentData(getDb(c.env), c.env.BUSINESS_SLUG);
	return ok(c, summary);
});

dev.post(
	"/birthday/reconcile",
	validate("json", runBirthdayIssuanceSchema),
	async (c) => {
		const db = getDb(c.env);
		const { businessId, atIso } = c.req.valid("json");
		const now = atIso ? new Date(atIso) : new Date();
		const defaults = await ensureMvpDefaults(db, c.env.BUSINESS_SLUG);
		const summary = await issueBirthdayRewardsForBusiness(
			db,
			businessId ?? defaults.businessId,
			now,
		);
		return ok(c, summary);
	},
);
