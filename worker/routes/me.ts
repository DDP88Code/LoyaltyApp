import { Hono } from "hono";
import type { SessionPayload } from "@shared/api";
import { ok } from "@worker/lib/http";
import { toSessionUser } from "@worker/lib/session";
import { requireSession } from "@worker/middleware/auth";
import type { AppEnv } from "@worker/types";

export const me = new Hono<AppEnv>().get("/", requireSession, (c) =>
	ok<SessionPayload>(c, { user: toSessionUser(c.get("profile")) }),
);
