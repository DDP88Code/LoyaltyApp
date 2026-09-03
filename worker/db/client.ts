import { drizzle } from "drizzle-orm/d1";
import * as schema from "@worker/db/schema";

/** Request-scoped Drizzle client. D1 bindings are cheap; build one per request. */
export function getDb(env: Env) {
	return drizzle(env.DB, { schema, logger: env.APP_ENV === "development" });
}

export type Db = ReturnType<typeof getDb>;
