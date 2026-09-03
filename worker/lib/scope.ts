import { and, eq } from "drizzle-orm";
import type { Db } from "@worker/db/client";
import { locations } from "@worker/db/schema";
import { ApiError } from "@worker/lib/http";

/**
 * Resolves a location the caller asked for, but only within their own business.
 * A location belonging to another business is reported as not found rather than
 * forbidden, so the response cannot be used to probe for valid ids.
 */
export async function requireLocationInBusiness(
	db: Db,
	businessId: string,
	locationId: string,
) {
	const location = await db.query.locations.findFirst({
		where: and(
			eq(locations.id, locationId),
			eq(locations.businessId, businessId),
		),
	});

	if (!location) {
		throw new ApiError("not_found", "That location was not found.");
	}

	if (!location.active) {
		throw new ApiError("bad_request", "That location is not currently open.");
	}

	return location;
}
