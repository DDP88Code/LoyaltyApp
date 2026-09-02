import { Hono } from "hono";
import type { HealthPayload } from "@shared/api";
import type { AppEnv } from "@worker/types";
import { ok } from "@worker/lib/http";

export const health = new Hono<AppEnv>().get("/", (c) =>
	ok<HealthPayload>(c, {
		status: "ok",
		service: "fives-rewards-api",
		environment: c.env.APP_ENV,
		time: new Date().toISOString(),
	}),
);
