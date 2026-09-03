import type { BetterAuthOptions } from "better-auth";

/**
 * The subset of Better Auth options that determines the generated database
 * schema. Shared with the CLI stub in `auth.ts` at the repository root so the
 * generated tables can never drift from the running configuration.
 */
export const authSchemaOptions = {
	emailAndPassword: { enabled: true },
} satisfies BetterAuthOptions;
