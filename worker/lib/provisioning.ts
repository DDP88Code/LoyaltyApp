import { eq } from "drizzle-orm";
import type { Db } from "@worker/db/client";
import { profiles, user } from "@worker/db/schema";
import { ensureMvpDefaults } from "@worker/lib/defaults";
import { issueWelcomeReward } from "@worker/lib/loyalty";

interface AuthIdentity {
	id: string;
	name: string;
	email: string;
}

export async function ensureAuthUserProfile(
	db: Db,
	env: Env,
	identity: AuthIdentity,
) {
	const defaults = await ensureMvpDefaults(db, env.BUSINESS_SLUG);

	const displayName = identity.name.trim() || identity.email;

	const [createdProfile] = await db
		.insert(profiles)
		.values({
			authUserId: identity.id,
			businessId: defaults.businessId,
			fullName: displayName,
			email: identity.email,
			role: "customer",
		})
		.onConflictDoNothing()
		.returning();

	const profile =
		createdProfile ??
		(await db.query.profiles.findFirst({
			where: eq(profiles.authUserId, identity.id),
		}));

	if (!profile) {
		throw new Error("Profile row could not be initialized.");
	}

	await issueWelcomeReward(db, defaults.businessId, profile.id);

	return profile;
}

export async function ensureAuthUserProfileById(
	db: Db,
	env: Env,
	authUserId: string,
) {
	const authUser = await db.query.user.findFirst({
		where: eq(user.id, authUserId),
	});

	if (!authUser) {
		throw new Error(`Auth user ${authUserId} was not found.`);
	}

	return ensureAuthUserProfile(db, env, {
		id: authUser.id,
		name: authUser.name,
		email: authUser.email,
	});
}