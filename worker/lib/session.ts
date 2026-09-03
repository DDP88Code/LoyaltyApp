import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { SessionUser } from "@shared/api";
import { getAuth } from "@worker/auth";
import { getDb } from "@worker/db/client";
import { profiles } from "@worker/db/schema";
import { ApiError } from "@worker/lib/http";
import type { AppEnv, Profile } from "@worker/types";

/** Better Auth needs the origin it is actually being served from. */
export function requestOrigin(url: string): string {
	return new URL(url).origin;
}

/**
 * Rejects anything without a valid session and an active profile, then puts the
 * profile on the context. Routes read business scope and role from there rather
 * than from anything the client sent.
 */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
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

/** Maps a profile row to the reduced shape the browser is allowed to see. */
export function toSessionUser(profile: Profile): SessionUser {
	return {
		id: profile.id,
		businessId: profile.businessId,
		fullName: profile.fullName,
		email: profile.email,
		mobileNumber: profile.mobileNumber,
		role: profile.role,
		birthday: profile.birthday,
		avatarUrl: profile.avatarUrl,
		marketingOptIn: profile.marketingOptIn,
		notificationOptIn: profile.notificationOptIn,
	};
}
