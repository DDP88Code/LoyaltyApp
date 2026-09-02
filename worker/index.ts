import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { ApiError, fail } from "@worker/lib/http";
import { health } from "@worker/routes/health";
import type { AppEnv } from "@worker/types";

const api = new Hono<AppEnv>()
	.route("/health", health)
	// Any unmatched /api path is an API error, never an SPA document.
	.all("*", (c) =>
		fail(c, "not_found", `No API route for ${c.req.method} ${c.req.path}`),
	);

const app = new Hono<AppEnv>();

app.use("*", secureHeaders());

app.route("/api", api);

app.onError((err, c) => {
	if (err instanceof ApiError) {
		return fail(c, err.code, err.message, err.details);
	}
	console.error("Unhandled Worker error", err);
	return fail(c, "internal_error", "Something went wrong. Please try again.");
});

// Everything that is not /api is the React SPA.
// The asset response is re-wrapped because its headers are immutable and
// downstream middleware (secureHeaders) needs to write to them.
app.all("*", async (c) => {
	const asset = await c.env.ASSETS.fetch(c.req.raw);
	return new Response(asset.body, asset);
});

export default app;
