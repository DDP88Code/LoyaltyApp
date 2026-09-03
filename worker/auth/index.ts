import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { authSchemaOptions } from "@worker/auth/config";
import { getDb } from "@worker/db/client";
import * as schema from "@worker/db/schema";
import { issueWelcomeReward } from "@worker/lib/loyalty";

const DAY_SECONDS = 60 * 60 * 24;

function createAuth(env: Env, baseURL: string) {
	const db = getDb(env);

	return betterAuth({
		...authSchemaOptions,
		database: drizzleAdapter(db, { provider: "sqlite", schema }),
		secret: env.BETTER_AUTH_SECRET,
		basePath: "/api/auth",
		baseURL,
		trustedOrigins: [baseURL],
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 10,
			// No transactional email provider yet, so verification would lock everyone out.
			requireEmailVerification: false,
		},
		session: {
			expiresIn: 30 * DAY_SECONDS,
			updateAge: DAY_SECONDS,
		},
		advanced: {
			useSecureCookies: env.APP_ENV !== "development",
		},
		databaseHooks: {
			user: {
				create: {
					after: async (createdUser) => {
						const business = await db.query.businesses.findFirst({
							where: eq(schema.businesses.slug, env.BUSINESS_SLUG),
						});
						if (!business) {
							throw new APIError("INTERNAL_SERVER_ERROR", {
								message:
									"Registration is unavailable. Please try again shortly.",
							});
						}
						// Role is hard-coded, never taken from the request. Public
						// registration can only ever produce a customer.
						const [profile] = await db
							.insert(schema.profiles)
							.values({
								authUserId: createdUser.id,
								businessId: business.id,
								fullName: createdUser.name,
								email: createdUser.email,
								role: "customer",
							})
							.onConflictDoNothing()
							.returning();

						if (profile) {
							await issueWelcomeReward(db, business.id, profile.id);
						}
					},
				},
			},
			session: {
				create: {
					before: async (newSession) => {
						const profile = await db.query.profiles.findFirst({
							where: eq(schema.profiles.authUserId, newSession.userId),
						});
						if (profile && !profile.active) {
							throw new APIError("FORBIDDEN", {
								message:
									"This account has been deactivated. Please speak to a member of staff.",
							});
						}
						return { data: newSession };
					},
				},
			},
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;

// Better Auth builds a router on construction, so instances are cached per
// isolate. Keyed by origin because the same Worker serves localhost, the
// workers.dev domain and the custom domain, and cookies/callbacks depend on it.
const instances = new Map<string, Auth>();

export function getAuth(env: Env, baseURL: string): Auth {
	let instance = instances.get(baseURL);
	if (!instance) {
		instance = createAuth(env, baseURL);
		instances.set(baseURL, instance);
	}
	return instance;
}
