import { and, asc, eq, gte, lte } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { SessionPayload } from "@shared/api";
import type {
	CustomerHomePayload,
	CustomerMenuPayload,
	CustomerRewardsPayload,
	CustomerTransactionsPayload,
	MenuCategorySummary,
	PromotionSummary,
} from "@shared/loyalty";
import type { LoyaltyCodePayload } from "@shared/loyaltyCode";
import {
	type AccountDeletionRequestPayload,
	updateProfileSchema,
} from "@shared/profile";
import { getDb } from "@worker/db/client";
import { auditLogs, menuCategories, menuItems, profiles, promotions } from "@worker/db/schema";
import { ok } from "@worker/lib/http";
import {
	getCoffeeProgress,
	isPointsProgramActive,
	listCustomerRewards,
	listCustomerTransactions,
} from "@worker/lib/loyalty";
import { issueLoyaltyCode } from "@worker/lib/loyaltyCode";
import { toSessionUser } from "@worker/lib/session";
import { requireCustomer, requireSession } from "@worker/middleware/auth";
import { validate } from "@worker/middleware/validate";
import type { AppEnv } from "@worker/types";

const transactionsQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(50).default(20),
	offset: z.coerce.number().int().min(0).default(0),
});

const REWARD_PREVIEW_SIZE = 3;

function toPromotionSummary(
	row: typeof promotions.$inferSelect,
): PromotionSummary {
	return {
		id: row.id,
		title: row.title,
		subtitle: row.subtitle,
		description: row.description,
		imageKey: row.imageKey,
		ctaText: row.ctaText,
		ctaUrl: row.ctaUrl,
	};
}

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
	})

	.post("/account/deletion-request", async (c) => {
		const profile = c.get("profile");
		// Recorded for staff to action manually. Nothing is deleted here — see
		// section 34: no destructive deletion happens outside an authorised flow.
		await getDb(c.env).insert(auditLogs).values({
			businessId: profile.businessId,
			actorUserId: profile.authUserId,
			actorRole: profile.role,
			action: "customer.account_deletion_requested",
			entityType: "profile",
			entityId: profile.id,
		});
		return ok<AccountDeletionRequestPayload>(c, { requested: true });
	})

	.post("/loyalty-code", async (c) => {
		const profile = c.get("profile");
		const payload = await issueLoyaltyCode(
			getDb(c.env),
			c.env.BETTER_AUTH_SECRET,
			profile.businessId,
			profile.id,
		);
		return ok<LoyaltyCodePayload>(c, payload);
	})

	.get("/home", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const now = new Date();

		const [coffee, rewards, pointsEnabled, activePromotion] =
			await Promise.all([
				getCoffeeProgress(db, profile.businessId, profile.id),
				listCustomerRewards(db, profile.businessId, profile.id),
				isPointsProgramActive(db, profile.businessId),
				db.query.promotions.findFirst({
					where: and(
						eq(promotions.businessId, profile.businessId),
						eq(promotions.active, true),
						lte(promotions.startAt, now),
						gte(promotions.endAt, now),
					),
					orderBy: (row, { desc }) => desc(row.startAt),
				}),
			]);

		const availableRewards = rewards
			.filter((reward) => reward.status === "available")
			.slice(0, REWARD_PREVIEW_SIZE);

		return ok<CustomerHomePayload>(c, {
			user: toSessionUser(profile),
			coffee,
			availableRewards,
			activePromotion: activePromotion ? toPromotionSummary(activePromotion) : null,
			pointsEnabled,
		});
	})

	.get("/rewards", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);

		const [coffee, rewards, pointsEnabled] = await Promise.all([
			getCoffeeProgress(db, profile.businessId, profile.id),
			listCustomerRewards(db, profile.businessId, profile.id),
			isPointsProgramActive(db, profile.businessId),
		]);

		return ok<CustomerRewardsPayload>(c, {
			coffee,
			available: rewards.filter((reward) => reward.status === "available"),
			redeemed: rewards.filter((reward) => reward.status === "redeemed"),
			expired: rewards.filter(
				(reward) => reward.status === "expired" || reward.status === "cancelled",
			),
			pointsEnabled,
		});
	})

	.get(
		"/transactions",
		validate("query", transactionsQuerySchema),
		async (c) => {
			const profile = c.get("profile");
			const { limit, offset } = c.req.valid("query");
			const { rows, total } = await listCustomerTransactions(
				getDb(c.env),
				profile.businessId,
				profile.id,
				limit,
				offset,
			);

			return ok<CustomerTransactionsPayload>(c, {
				transactions: rows,
				total,
				limit,
				offset,
			});
		},
	)

	.get("/menu", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);

		const [categoryRows, itemRows] = await Promise.all([
			db
				.select()
				.from(menuCategories)
				.where(
					and(
						eq(menuCategories.businessId, profile.businessId),
						eq(menuCategories.active, true),
					),
				)
				.orderBy(asc(menuCategories.sortOrder)),
			db
				.select()
				.from(menuItems)
				.where(
					and(
						eq(menuItems.businessId, profile.businessId),
						eq(menuItems.active, true),
					),
				)
				.orderBy(asc(menuItems.sortOrder)),
		]);

		const categories: MenuCategorySummary[] = categoryRows.map((category) => ({
			id: category.id,
			name: category.name,
			description: category.description,
			imageKey: category.imageKey,
			items: itemRows
				.filter((item) => item.categoryId === category.id)
				.map((item) => ({
					id: item.id,
					name: item.name,
					description: item.description,
					priceCents: item.priceCents,
					imageKey: item.imageKey,
					popular: item.popular,
					vegetarian: item.vegetarian,
					spicy: item.spicy,
					available: item.available,
				})),
		}));

		return ok<CustomerMenuPayload>(c, { categories });
	});
