import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { secureHeaders } from "hono/secure-headers";
import { getAuth } from "@worker/auth";
import { getDb } from "@worker/db/client";
import { businesses } from "@worker/db/schema";
import { issueBirthdayRewardsForBusiness } from "@worker/lib/birthdayRewards";
import { ensureMvpDefaults } from "@worker/lib/defaults";
import { ApiError, fail } from "@worker/lib/http";
import { requestOrigin } from "@worker/lib/session";
import { admin } from "@worker/routes/admin";
import { customer } from "@worker/routes/customer";
import { dev } from "@worker/routes/dev";
import { health } from "@worker/routes/health";
import { media } from "@worker/routes/media";
import { me } from "@worker/routes/me";
import { staff } from "@worker/routes/staff";
import type { AppEnv } from "@worker/types";

const api = new Hono<AppEnv>()
	// Better Auth owns every method under /api/auth and returns its own responses,
	// so it is mounted before the envelope-shaped routes.
	.all("/auth/*", (c) =>
		getAuth(c.env, requestOrigin(c.req.url)).handler(c.req.raw),
	)
	.route("/health", health)
	.route("/me", me)
	.route("/customer", customer)
	.route("/staff", staff)
	.route("/admin", admin)
	.route("/media", media)
	.route("/dev", dev)
	// Any unmatched /api path is an API error, never an SPA document.
	.all("*", (c) =>
		fail(c, "not_found", `No API route for ${c.req.method} ${c.req.path}`),
	);

const app = new Hono<AppEnv>();

app.use("*", secureHeaders());

app.route("/api", api);

app.onError((err, c) => {
	if (err instanceof ApiError) {
		return fail(c, err.code, err.message, err.details);
	}
	console.error("Unhandled Worker error", err);
	return fail(c, "internal_error", "Something went wrong. Please try again.");
});

// Everything that is not /api is the React SPA.
// The asset response is re-wrapped because its headers are immutable and
// downstream middleware (secureHeaders) needs to write to them.
app.all("*", async (c) => {
	const requestUrl = new URL(c.req.url);
	const asset = await c.env.ASSETS.fetch(c.req.raw);
	const response = new Response(asset.body, asset);
	const contentType = response.headers.get("content-type") ?? "";
	const isHtml = contentType.includes("text/html");
	const isAppShellAsset =
		requestUrl.pathname === "/sw.js" ||
		requestUrl.pathname === "/registerSW.js" ||
		requestUrl.pathname === "/manifest.webmanifest";

	if (isHtml || isAppShellAsset) {
		response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
	}

	return response;
});

async function handleScheduled(_event: ScheduledEvent, env: Env) {
	try {
		const db = getDb(env);
		await ensureMvpDefaults(db, env.BUSINESS_SLUG);
		const activeBusinesses = await db
			.select({ id: businesses.id })
			.from(businesses)
			.where(eq(businesses.active, true));

		for (const business of activeBusinesses) {
			const summary = await issueBirthdayRewardsForBusiness(db, business.id);
			console.log("Birthday reward cron summary", {
				businessId: business.id,
				...summary,
			});
		}
	} catch (error) {
		console.error("Birthday reward cron failed", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export default {
	fetch: app.fetch,
	scheduled: handleScheduled,
};
