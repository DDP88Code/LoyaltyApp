import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { authSchemaOptions } from "./worker/auth/config";

/**
 * Stub used only by `npm run auth:generate`, which reads these options to emit
 * the Drizzle schema. The database handle is never queried during generation.
 * The Worker builds its real auth instance in worker/auth/index.ts.
 */
export const auth = betterAuth({
	...authSchemaOptions,
	database: drizzleAdapter({} as never, { provider: "sqlite" }),
});
