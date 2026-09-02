import type { Hono } from "hono";

/** Hono generics for every router in this Worker. */
export interface AppEnv {
	Bindings: Env;
}

export type AppRouter = Hono<AppEnv>;
