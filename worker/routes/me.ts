import { Hono } from "hono";
import type { SessionPayload } from "@shared/api";
import { ok } from "@worker/lib/http";
import { requireAuth, toSessionUser } from "@worker/lib/session";
import type { AppEnv } from "@worker/types";

export const me = new Hono<AppEnv>().get("/", requireAuth, (c) =>
	ok<SessionPayload>(c, { user: toSessionUser(c.get("profile")) }),
);
