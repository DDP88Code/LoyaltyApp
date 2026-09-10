import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { secureHeaders } from "hono/secure-headers";
import { getAuth } from "@worker/auth";
import { getDb } from "@worker/db/client";
import { businesses } from "@worker/db/schema";
import { issueBirthdayRewardsForBusiness } from "@worker/lib/birthdayRewards";
import { ensureMvpDefaults } from "@worker/lib/defaults";
import { ApiError, fail } from "@worker/lib/http";
import {
	backfillWelcomeClaimMarkersForBusiness,
	getWelcomeClaimHashSecret,
} from "@worker/lib/welcomeRewardClaims";
import { notifyActivePromotionsAwaitingBroadcast } from "@worker/lib/notifications/promotionBroadcast";
import { notifyRewardsExpiringInDays } from "@worker/lib/notifications/rewardExpiry";
import { createNotificationService } from "@worker/lib/notifications/service";
import { requestOrigin } from "@worker/lib/session";
import { verifyTurnstileForAuthRequest } from "@worker/lib/turnstile";
import { admin } from "@worker/routes/admin";
import { customer } from "@worker/routes/customer";
import { dev } from "@worker/routes/dev";
import { health } from "@worker/routes/health";
import { media } from "@worker/routes/media";
import { me } from "@worker/routes/me";
import { staff } from "@worker/routes/staff";
import type { AppEnv } from "@worker/types";

const DAILY_MAINTENANCE_CRON = "10 22 * * *";
const PROMOTION_NOTIFY_CRON = "*/5 * * * *";

const api = new Hono<AppEnv>()
	// Better Auth owns every method under /api/auth and returns its own responses,
	// so it is mounted before the envelope-shaped routes.
	.all("/auth/*", async (c) => {
		const turnstile = await verifyTurnstileForAuthRequest(c.req.raw, c.env);
		if (!turnstile.ok) {
			return c.json(
				{ error: { code: "turnstile_verification_failed", message: turnstile.message } },
				turnstile.status,
			);
		}

		return getAuth(c.env, requestOrigin(c.req.url)).handler(c.req.raw);
	})
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
		let welcomeClaimHashSecret: string | null = null;
		try {
			welcomeClaimHashSecret = getWelcomeClaimHashSecret(env);
		} catch (error) {
			console.error("Welcome claim backfill unavailable", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
		const now = new Date();
		const cron = _event.cron;
		const runDailyMaintenance = !cron || cron === DAILY_MAINTENANCE_CRON;
		const runPromotionSweep = !cron || cron === PROMOTION_NOTIFY_CRON;

		if (!runDailyMaintenance && !runPromotionSweep) {
			console.log("Scheduled event skipped", { cron });
			return;
		}

		const activeBusinesses = await db
			.select({ id: businesses.id })
			.from(businesses)
			.where(eq(businesses.active, true));

		for (const business of activeBusinesses) {
			if (runDailyMaintenance) {
				if (welcomeClaimHashSecret) {
					const backfill = await backfillWelcomeClaimMarkersForBusiness(
						db,
						welcomeClaimHashSecret,
						business.id,
					);
					if (backfill.insertedMarkers > 0) {
						console.log("Welcome claim backfill summary", {
							businessId: business.id,
							scannedRewards: backfill.scannedRewards,
							insertedMarkers: backfill.insertedMarkers,
						});
					}
				}

				const notificationService = createNotificationService(db, env);

				const birthdaySummary = await issueBirthdayRewardsForBusiness(
					db,
					business.id,
					async (issued) => {
						await notificationService.notifyBirthdayReward(issued);
					},
					now,
				);

				const expirySummary = await notifyRewardsExpiringInDays(
					db,
					business.id,
					3,
					now,
					async (candidate) => {
						const result = await notificationService.notifyRewardExpiring({
							businessId: candidate.businessId,
							customerId: candidate.customerId,
							customerRewardId: candidate.customerRewardId,
							rewardName: candidate.rewardName,
							daysRemaining: 3,
						});
						if (result.status === "created") return "created";
						if (result.status === "duplicate") return "duplicate";
						return "skipped";
					},
				);

				console.log("Daily notification maintenance summary", {
					businessId: business.id,
					birthdaySummary,
					expirySummary,
				});
			}

			if (runPromotionSweep) {
				const promotionSummary = await notifyActivePromotionsAwaitingBroadcast(
					db,
					env,
					business.id,
					now,
				);
				if (promotionSummary.scannedPromotions > 0 || promotionSummary.failed > 0) {
					console.log("Promotion notify sweep summary", promotionSummary);
				}
			}
		}
	} catch (error) {
		console.error("Scheduled maintenance failed", {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export default {
	fetch: app.fetch,
	scheduled: handleScheduled,
};
