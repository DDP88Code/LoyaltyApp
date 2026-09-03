import type { Hono } from "hono";
import type { profiles } from "@worker/db/schema";

export type Profile = typeof profiles.$inferSelect;

/** Hono generics for every router in this Worker. */
export interface AppEnv {
	Bindings: Env;
	Variables: {
		/** Set by `requireAuth`; absent on public routes. */
		profile: Profile;
	};
}

export type AppRouter = Hono<AppEnv>;
