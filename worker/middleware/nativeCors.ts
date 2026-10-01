import { createMiddleware } from "hono/factory";
import { getNativeOriginFromRequest } from "@worker/lib/nativeAuth";
import type { AppEnv } from "@worker/types";

const ALLOWED_METHODS = ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] as const;
const ALLOWED_HEADERS = [
	"Content-Type",
	"Authorization",
	"cf-turnstile-response",
	"Accept",
] as const;
const EXPOSED_HEADERS = ["set-auth-token"] as const;

function appendVary(headers: Headers, value: string) {
	const existing = headers.get("vary");
	if (!existing) {
		headers.set("vary", value);
		return;
	}
	const parts = existing
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
	if (!parts.some((entry) => entry.toLowerCase() === value.toLowerCase())) {
		parts.push(value);
		headers.set("vary", parts.join(", "));
	}
}

function setCorsHeaders(headers: Headers, origin: string) {
	headers.set("Access-Control-Allow-Origin", origin);
	headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS.join(", "));
	headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS.join(", "));
	headers.set("Access-Control-Expose-Headers", EXPOSED_HEADERS.join(", "));
	headers.set("Access-Control-Max-Age", "86400");
	appendVary(headers, "Origin");
}

export const nativeApiCors = createMiddleware<AppEnv>(async (c, next) => {
	const requestOrigin = c.req.header("Origin") ?? null;
	const approvedNativeOrigin = getNativeOriginFromRequest(c.env, requestOrigin);

	if (c.req.method === "OPTIONS") {
		if (!requestOrigin || !approvedNativeOrigin) {
			return c.json(
				{ error: { code: "cors_origin_not_allowed", message: "Origin is not allowed." } },
				403,
			);
		}

		setCorsHeaders(c.res.headers, approvedNativeOrigin);
		return c.body(null, 204);
	}

	await next();
	if (approvedNativeOrigin) {
		setCorsHeaders(c.res.headers, approvedNativeOrigin);
	}
});
