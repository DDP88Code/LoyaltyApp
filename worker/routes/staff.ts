import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { LocationSummary, StaffContextPayload } from "@shared/api";
import type {
	CoffeeEarnResultPayload,
	StaffResolvedCustomerPayload,
} from "@shared/loyaltyCode";
import { resolveLoyaltyCodeSchema } from "@shared/loyaltyCode";
import type { Db } from "@worker/db/client";
import { getDb } from "@worker/db/client";
import { locations, profiles } from "@worker/db/schema";
import { ApiError, ok } from "@worker/lib/http";
import {
	getCoffeeProgress,
	listCustomerRewards,
	recordCoffeeEarn,
	redeemCustomerReward,
} from "@worker/lib/loyalty";
import { resolveLoyaltyCode } from "@worker/lib/loyaltyCode";
import { requireLocationInBusiness } from "@worker/lib/scope";
import { toSessionUser } from "@worker/lib/session";
import { requireSession, requireStaff } from "@worker/middleware/auth";
import { validate } from "@worker/middleware/validate";
import type { AppEnv } from "@worker/types";

const contextQuerySchema = z.object({
	locationId: z.string().min(1).max(64).optional(),
});

const addCoffeeSchema = z.object({
	locationId: z.string().min(1).max(64),
	quantity: z.coerce.number().int().min(1).max(20).default(1),
	// The client sends null (not just omits the field) for "no bill reference".
	billReference: z.string().trim().max(120).nullable().optional(),
	// Client-generated per button-press, so a retried tap or flaky network never earns twice.
	idempotencyKey: z.string().trim().min(8).max(128),
});

const redeemRewardSchema = z.object({
	locationId: z.string().min(1).max(64),
	billReference: z.string().trim().max(120).nullable().optional(),
});

const toSummary = (row: typeof locations.$inferSelect): LocationSummary => ({
	id: row.id,
	name: row.name,
	address: row.address,
});

/** The minimum a staff member needs to see, freshly computed after any action. */
async function resolveCustomerView(
	db: Db,
	businessId: string,
	customerId: string,
): Promise<StaffResolvedCustomerPayload> {
	const customer = await db.query.profiles.findFirst({
		where: and(eq(profiles.id, customerId), eq(profiles.businessId, businessId)),
	});
	if (!customer || !customer.active) {
		throw new ApiError(
			"forbidden",
			"This customer's account has been deactivated.",
		);
	}

	const [coffee, rewards] = await Promise.all([
		getCoffeeProgress(db, businessId, customer.id),
		listCustomerRewards(db, businessId, customer.id),
	]);
	const available = rewards.filter((reward) => reward.status === "available");

	return {
		customerId: customer.id,
		fullName: customer.fullName,
		coffee,
		availableFreeCoffees: available.filter(
			(reward) => reward.rewardType === "free_item",
		),
		availableVouchers: available.filter(
			(reward) => reward.rewardType === "voucher",
		),
	};
}

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

			const payload = await resolveCustomerView(
				db,
				staffProfile.businessId,
				match.customerId,
			);
			return ok<StaffResolvedCustomerPayload>(c, payload);
		},
	)

	.post(
		"/customers/:customerId/coffee",
		validate("json", addCoffeeSchema),
		async (c) => {
			const staffProfile = c.get("profile");
			const db = getDb(c.env);
			const customerId = c.req.param("customerId");
			const input = c.req.valid("json");

			await requireLocationInBusiness(db, staffProfile.businessId, input.locationId);

			const { issuedRewardIds } = await recordCoffeeEarn(db, {
				businessId: staffProfile.businessId,
				locationId: input.locationId,
				customerId,
				staffId: staffProfile.id,
				quantity: input.quantity,
				billReference: input.billReference ?? null,
				idempotencyKey: input.idempotencyKey,
			});

			const payload = await resolveCustomerView(db, staffProfile.businessId, customerId);
			return ok<CoffeeEarnResultPayload>(c, {
				...payload,
				newlyIssuedCount: issuedRewardIds.length,
			});
		},
	)

	.post(
		"/customers/:customerId/rewards/:rewardId/redeem",
		validate("json", redeemRewardSchema),
		async (c) => {
			const staffProfile = c.get("profile");
			const db = getDb(c.env);
			const customerId = c.req.param("customerId");
			const rewardId = c.req.param("rewardId");
			const input = c.req.valid("json");

			await requireLocationInBusiness(db, staffProfile.businessId, input.locationId);

			await redeemCustomerReward(db, {
				businessId: staffProfile.businessId,
				customerId,
				rewardId,
				staffId: staffProfile.id,
				locationId: input.locationId,
				billReference: input.billReference ?? null,
			});

			const payload = await resolveCustomerView(db, staffProfile.businessId, customerId);
			return ok<StaffResolvedCustomerPayload>(c, payload);
		},
	);
