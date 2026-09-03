import { Hono } from "hono";
import { getDb } from "@worker/db/client";
import { seedDevelopmentData } from "@worker/db/seed";
import { fail, ok } from "@worker/lib/http";
import type { AppEnv } from "@worker/types";

/**
 * Development-only utilities. Outside development these routes answer 404 like
 * any other unknown path, so a deployed Worker never admits they exist.
 */
export const dev = new Hono<AppEnv>()
	.use("*", async (c, next) => {
		if (c.env.APP_ENV !== "development") {
			return fail(
				c,
				"not_found",
				`No API route for ${c.req.method} ${c.req.path}`,
			);
		}
		await next();
	})
	.post("/seed", async (c) => {
		const summary = await seedDevelopmentData(
			getDb(c.env),
			c.env.BUSINESS_SLUG,
		);
		return ok(c, summary);
	});
