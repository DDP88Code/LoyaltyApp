import { and, count, desc, eq, like, or } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AdminCustomerListPayload } from "@shared/api";
import { getDb } from "@worker/db/client";
import { profiles } from "@worker/db/schema";
import { ok } from "@worker/lib/http";
import { requireAdminOrOwner, requireSession } from "@worker/middleware/auth";
import { validate } from "@worker/middleware/validate";
import type { AppEnv } from "@worker/types";

const listQuerySchema = z.object({
	search: z.string().trim().max(80).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(25),
	offset: z.coerce.number().int().min(0).default(0),
});

export const admin = new Hono<AppEnv>()
	.use("*", requireSession, requireAdminOrOwner)

	.get("/customers", validate("query", listQuerySchema), async (c) => {
		const { businessId } = c.get("profile");
		const { search, limit, offset } = c.req.valid("query");
		const db = getDb(c.env);

		// Business scope is part of the predicate, not a filter applied afterwards,
		// so no query path can return another business's customers.
		const where = and(
			eq(profiles.businessId, businessId),
			eq(profiles.role, "customer"),
			search
				? or(
						like(profiles.fullName, `%${search}%`),
						like(profiles.email, `%${search}%`),
						like(profiles.mobileNumber, `%${search}%`),
					)
				: undefined,
		);

		const [rows, [totals]] = await Promise.all([
			db
				.select({
					id: profiles.id,
					fullName: profiles.fullName,
					email: profiles.email,
					mobileNumber: profiles.mobileNumber,
					active: profiles.active,
					createdAt: profiles.createdAt,
				})
				.from(profiles)
				.where(where)
				.orderBy(desc(profiles.createdAt))
				.limit(limit)
				.offset(offset),
			db.select({ value: count() }).from(profiles).where(where),
		]);

		return ok<AdminCustomerListPayload>(c, {
			customers: rows.map((row) => ({
				...row,
				createdAt: row.createdAt.toISOString(),
			})),
			total: totals?.value ?? 0,
			limit,
			offset,
		});
	});
