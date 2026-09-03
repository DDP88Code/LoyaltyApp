import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { LocationSummary, StaffContextPayload } from "@shared/api";
import { getDb } from "@worker/db/client";
import { locations } from "@worker/db/schema";
import { ok } from "@worker/lib/http";
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
	});
