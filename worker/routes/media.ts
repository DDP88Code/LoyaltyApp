import { Hono } from "hono";
import { z } from "zod";
import { ApiError } from "@worker/lib/http";
import { assertOwnedBusinessMediaKey } from "@worker/lib/media";
import { requireSession } from "@worker/middleware/auth";
import { validate } from "@worker/middleware/validate";
import type { AppEnv } from "@worker/types";

const objectQuerySchema = z.object({
	key: z.string().trim().min(1).max(300),
});

export const media = new Hono<AppEnv>()
	.use("*", requireSession)
	.get("/object", validate("query", objectQuerySchema), async (c) => {
		const profile = c.get("profile");
		const { key } = c.req.valid("query");

		assertOwnedBusinessMediaKey(profile.businessId, key);

		const object = await c.env.MEDIA.get(key);
		if (!object) {
			throw new ApiError("not_found", "That media object was not found.");
		}

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set("etag", object.httpEtag);
		headers.set("cache-control", "private, max-age=300");
		return new Response(object.body, { headers });
	});