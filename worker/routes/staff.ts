import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { LocationSummary, StaffContextPayload } from "@shared/api";
import type { StaffResolvedCustomerPayload } from "@shared/loyaltyCode";
import { resolveLoyaltyCodeSchema } from "@shared/loyaltyCode";
import { getDb } from "@worker/db/client";
import { locations, profiles } from "@worker/db/schema";
import { ApiError, ok } from "@worker/lib/http";
import { getCoffeeProgress, listCustomerRewards } from "@worker/lib/loyalty";
import { resolveLoyaltyCode } from "@worker/lib/loyaltyCode";
import { requireLocationInBusiness } from "@worker/lib/scope";
import { toSessionUser } from "@worker/lib/session";
import { requireSession, requireStaff } from "@worker/middleware/auth";
import { validate } from "@worker/middleware/validate";
import type { AppEnv } from "@worker/types";

const contextQuerySchema = z.object({
	locationId: z.string().min(1).max(64).optional(),
});

const toSummary = (row: typeof locations.$inferSelect): LocationSummary => ({
	id: row.id,
	name: row.name,
	address: row.address,
});

export const staff = new Hono<AppEnv>()
	.use("*", requireSession, requireStaff)

	.get("/context", validate("query", contextQuerySchema), async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const { locationId } = c.req.valid("query");

		const rows = await db
			.select()
			.from(locations)
			.where(
				and(
					eq(locations.businessId, profile.businessId),
					eq(locations.active, true),
				),
			)
			.orderBy(asc(locations.name));

		// A remembered location is re-checked against the business on every load,
		// so a stale or tampered id can never widen what this device can act on.
		const selected = locationId
			? await requireLocationInBusiness(db, profile.businessId, locationId)
			: null;

		return ok<StaffContextPayload>(c, {
			staff: toSessionUser(profile),
			locations: rows.map(toSummary),
			selectedLocation: selected ? toSummary(selected) : null,
		});
	})

	.post(
		"/loyalty-code/resolve",
		validate("json", resolveLoyaltyCodeSchema),
		async (c) => {
			const staffProfile = c.get("profile");
			const db = getDb(c.env);
			const input = c.req.valid("json");

			// A code that never matched and one that matched but is expired or
			// already used look identical to the caller — same message either way.
			const match = await resolveLoyaltyCode(
				db,
				c.env.BETTER_AUTH_SECRET,
				staffProfile.businessId,
				input,
			);
			if (!match) {
				throw new ApiError(
					"bad_request",
					"That code is invalid or has expired.",
				);
			}

			const customer = await db.query.profiles.findFirst({
				where: and(
					eq(profiles.id, match.customerId),
					eq(profiles.businessId, staffProfile.businessId),
				),
			});
			if (!customer || !customer.active) {
				throw new ApiError(
					"forbidden",
					"This customer's account has been deactivated.",
				);
			}

			const [coffee, rewards] = await Promise.all([
				getCoffeeProgress(db, staffProfile.businessId, customer.id),
				listCustomerRewards(db, staffProfile.businessId, customer.id),
			]);
			const available = rewards.filter((reward) => reward.status === "available");

			return ok<StaffResolvedCustomerPayload>(c, {
				customerId: customer.id,
				fullName: customer.fullName,
				coffee,
				availableFreeCoffees: available.filter(
					(reward) => reward.rewardType === "free_item",
				),
				availableVouchers: available.filter(
					(reward) => reward.rewardType === "voucher",
				),
			});
		},
	);
