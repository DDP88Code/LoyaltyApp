import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { authSchemaOptions } from "@worker/auth/config";
import { getDb } from "@worker/db/client";
import * as schema from "@worker/db/schema";
import {
	ensureAuthUserProfile,
	ensureAuthUserProfileById,
} from "@worker/lib/provisioning";

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
						try {
							await ensureAuthUserProfile(db, env, {
								id: createdUser.id,
								name: createdUser.name,
								email: createdUser.email,
							});
						} catch (error) {
							console.error("Auth sign-up provisioning failed", {
								userId: createdUser.id,
								email: createdUser.email,
								error:
									error instanceof Error ? error.message : String(error),
							});
							throw new APIError("INTERNAL_SERVER_ERROR", {
								message:
									"Registration is unavailable. Please try again shortly.",
							});
						}
					},
				},
			},
			session: {
				create: {
					before: async (newSession) => {
						let profile;
						try {
							profile = await ensureAuthUserProfileById(
								db,
								env,
								newSession.userId,
							);
						} catch (error) {
							console.error("Auth session provisioning failed", {
								userId: newSession.userId,
								error:
									error instanceof Error ? error.message : String(error),
							});
							throw new APIError("INTERNAL_SERVER_ERROR", {
								message:
									"Sign-in is unavailable. Please try again shortly.",
							});
						}
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
