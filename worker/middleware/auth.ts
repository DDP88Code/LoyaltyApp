import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { Role } from "@shared/roles";
import { getAuth } from "@worker/auth";
import { getDb } from "@worker/db/client";
import { profiles } from "@worker/db/schema";
import { ApiError } from "@worker/lib/http";
import { requestOrigin } from "@worker/lib/session";
import type { AppEnv } from "@worker/types";

/**
 * Establishes who is calling. Everything downstream reads identity, role and
 * business scope from the profile on the context, never from the request body.
 */
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
	const auth = getAuth(c.env, requestOrigin(c.req.url));
	const session = await auth.api.getSession({ headers: c.req.raw.headers });

	if (!session) {
		throw new ApiError("unauthenticated", "Please sign in to continue.");
	}

	const profile = await getDb(c.env).query.profiles.findFirst({
		where: eq(profiles.authUserId, session.user.id),
	});

	if (!profile) {
		throw new ApiError(
			"forbidden",
			"Your account is not set up yet. Please speak to a member of staff.",
		);
	}

	if (!profile.active) {
		throw new ApiError(
			"forbidden",
			"This account has been deactivated. Please speak to a member of staff.",
		);
	}

	c.set("profile", profile);
	await next();
});

/**
 * Must be chained after `requireSession`. The message is deliberately the same
 * for every role so a rejected response never reveals what the caller is missing.
 */
function requireRole(...allowed: readonly Role[]) {
	return createMiddleware<AppEnv>(async (c, next) => {
		if (!allowed.includes(c.get("profile").role)) {
			throw new ApiError(
				"forbidden",
				"You do not have permission to do that.",
			);
		}
		await next();
	});
}

export const requireCustomer = requireRole("customer");
/** Admins and owners can work the till, so they pass staff checks too. */
export const requireStaff = requireRole("staff", "admin", "owner");
export const requireAdmin = requireRole("admin");
export const requireOwner = requireRole("owner");
export const requireAdminOrOwner = requireRole("admin", "owner");
