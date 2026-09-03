import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { SessionPayload } from "@shared/api";
import { updateProfileSchema } from "@shared/profile";
import { getDb } from "@worker/db/client";
import { profiles } from "@worker/db/schema";
import { ok } from "@worker/lib/http";
import { toSessionUser } from "@worker/lib/session";
import { requireCustomer, requireSession } from "@worker/middleware/auth";
import { validate } from "@worker/middleware/validate";
import type { AppEnv } from "@worker/types";

export const customer = new Hono<AppEnv>()
	.use("*", requireSession, requireCustomer)

	.get("/profile", (c) =>
		ok<SessionPayload>(c, { user: toSessionUser(c.get("profile")) }),
	)

	.patch("/profile", validate("json", updateProfileSchema), async (c) => {
		const profile = c.get("profile");
		// The row is located by the session's profile id, so a customer can only
		// ever update themselves — there is no id in the request to tamper with.
		const [updated] = await getDb(c.env)
			.update(profiles)
			.set(c.req.valid("json"))
			.where(eq(profiles.id, profile.id))
			.returning();

		return ok<SessionPayload>(c, { user: toSessionUser(updated ?? profile) });
	});
