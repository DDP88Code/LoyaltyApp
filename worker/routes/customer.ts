import { and, asc, count, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
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
import type {
	CustomerLatestUnreadNotificationPayload,
	CustomerMarkAllNotificationsReadPayload,
	CustomerMarkNotificationReadPayload,
	CustomerNotificationsPayload,
	CustomerPushConfigPayload,
	CustomerPushSubscriptionStatusPayload,
	CustomerUnreadNotificationsPayload,
} from "@shared/notifications";
import {
	pushSubscriptionDeleteSchema,
	pushSubscriptionUpsertSchema,
} from "@shared/notifications";
import {
	type AccountDeletionPayload,
	updateProfileSchema,
} from "@shared/profile";
import { getDb } from "@worker/db/client";
import {
	appSettings,
	auditLogs,
	customerRewards,
	loyaltyCodes,
	loyaltyTransactions,
	menuCategories,
	menuItems,
	menuItemVariants,
	notifications,
	profiles,
	promotions,
	pushSubscriptions,
	user as authUsers,
} from "@worker/db/schema";
import { ok } from "@worker/lib/http";
import { ApiError } from "@worker/lib/http";
import {
	getCoffeeProgress,
	isPointsProgramActive,
	listCustomerRewards,
	listCustomerTransactions,
} from "@worker/lib/loyalty";
import { reconcileBirthdayRewardForCustomer } from "@worker/lib/birthdayRewards";
import { issueLoyaltyCode } from "@worker/lib/loyaltyCode";
import { createNotificationService } from "@worker/lib/notifications/service";
import { SETTINGS_PROMOTION_CAROUSEL_SPEED_SECONDS_KEY } from "@worker/lib/defaults";
import { toSessionUser } from "@worker/lib/session";
import { requireCustomer, requireSession } from "@worker/middleware/auth";
import { validate } from "@worker/middleware/validate";
import type { AppEnv } from "@worker/types";

const transactionsQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(50).default(20),
	offset: z.coerce.number().int().min(0).default(0),
});

const notificationsQuerySchema = z.object({
	limit: z.coerce.number().int().min(1).max(50).default(20),
	offset: z.coerce.number().int().min(0).default(0),
});

const REWARD_PREVIEW_SIZE = 3;
const PROMOTION_CAROUSEL_SPEED_DEFAULT_SECONDS = 3;
const PROMOTION_CAROUSEL_SPEED_MIN_SECONDS = 2;
const PROMOTION_CAROUSEL_SPEED_MAX_SECONDS = 15;

function parsePromotionCarouselSpeedSeconds(valueJson: unknown): number {
	if (
		typeof valueJson === "number" &&
		Number.isInteger(valueJson) &&
		valueJson >= PROMOTION_CAROUSEL_SPEED_MIN_SECONDS &&
		valueJson <= PROMOTION_CAROUSEL_SPEED_MAX_SECONDS
	) {
		return valueJson;
	}

	return PROMOTION_CAROUSEL_SPEED_DEFAULT_SECONDS;
}

function toNotificationSummary(
	row: typeof notifications.$inferSelect,
): CustomerNotificationsPayload["notifications"][number] {
	return {
		id: row.id,
		type: row.type,
		title: row.title,
		message: row.message,
		actionUrl: row.actionUrl,
		createdAt: row.createdAt.toISOString(),
		readAt: row.readAt?.toISOString() ?? null,
		expiresAt: row.expiresAt?.toISOString() ?? null,
	};
}

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
		const db = getDb(c.env);
		const notificationService = createNotificationService(db, c.env);
		// The row is located by the session's profile id, so a customer can only
		// ever update themselves — there is no id in the request to tamper with.
		const [updated] = await db
			.update(profiles)
			.set(c.req.valid("json"))
			.where(eq(profiles.id, profile.id))
			.returning();

		const latest = updated ?? profile;
		await reconcileBirthdayRewardForCustomer(
			db,
			{
				id: latest.id,
				businessId: latest.businessId,
				role: latest.role,
				active: latest.active,
				birthday: latest.birthday,
			},
			async (issued) => {
				await notificationService.notifyBirthdayReward(issued);
			},
		);

		return ok<SessionPayload>(c, { user: toSessionUser(latest) });
	})

	.get(
		"/notifications",
		validate("query", notificationsQuerySchema),
		async (c) => {
			const profile = c.get("profile");
			const db = getDb(c.env);
			const { limit, offset } = c.req.valid("query");

			const where = and(
				eq(notifications.businessId, profile.businessId),
				eq(notifications.customerId, profile.id),
			);

			const [rows, [totals]] = await Promise.all([
				db
					.select()
					.from(notifications)
					.where(where)
					.orderBy(desc(notifications.createdAt))
					.limit(limit)
					.offset(offset),
				db.select({ value: count() }).from(notifications).where(where),
			]);

			return ok<CustomerNotificationsPayload>(c, {
				notifications: rows.map(toNotificationSummary),
				total: totals?.value ?? 0,
				limit,
				offset,
			});
		},
	)

	.get("/notifications/unread-count", async (c) => {
		const profile = c.get("profile");
		const [row] = await getDb(c.env)
			.select({ value: count() })
			.from(notifications)
			.where(
				and(
					eq(notifications.businessId, profile.businessId),
					eq(notifications.customerId, profile.id),
					isNull(notifications.readAt),
				),
			);

		return ok<CustomerUnreadNotificationsPayload>(c, {
			unread: row?.value ?? 0,
		});
	})

	.get("/notifications/latest-unread", async (c) => {
		const profile = c.get("profile");
		const row = await getDb(c.env).query.notifications.findFirst({
			where: and(
				eq(notifications.businessId, profile.businessId),
				eq(notifications.customerId, profile.id),
				isNull(notifications.readAt),
			),
			orderBy: (t, { desc }) => [desc(t.createdAt)],
		});

		return ok<CustomerLatestUnreadNotificationPayload>(c, {
			notification: row ? toNotificationSummary(row) : null,
		});
	})

	.post("/notifications/:notificationId/read", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const notificationId = c.req.param("notificationId");

		const existing = await db.query.notifications.findFirst({
			where: and(
				eq(notifications.id, notificationId),
				eq(notifications.businessId, profile.businessId),
				eq(notifications.customerId, profile.id),
			),
			columns: { id: true, readAt: true },
		});
		if (!existing) {
			throw new ApiError("not_found", "Notification not found.");
		}

		if (!existing.readAt) {
			await db
				.update(notifications)
				.set({ readAt: new Date() })
				.where(eq(notifications.id, existing.id));
		}

		return ok<CustomerMarkNotificationReadPayload>(c, { updated: true });
	})

	.post("/notifications/read-all", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);
		const now = new Date();

		const [unread] = await db
			.select({ value: count() })
			.from(notifications)
			.where(
				and(
					eq(notifications.businessId, profile.businessId),
					eq(notifications.customerId, profile.id),
					isNull(notifications.readAt),
				),
			);

		if ((unread?.value ?? 0) > 0) {
			await db
				.update(notifications)
				.set({ readAt: now })
				.where(
					and(
						eq(notifications.businessId, profile.businessId),
						eq(notifications.customerId, profile.id),
						isNull(notifications.readAt),
					),
				);
		}

		return ok<CustomerMarkAllNotificationsReadPayload>(c, {
			updatedCount: unread?.value ?? 0,
		});
	})

	.get("/push/config", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);

		const [subscribed] = await db
			.select({ value: count() })
			.from(pushSubscriptions)
			.where(
				and(
					eq(pushSubscriptions.businessId, profile.businessId),
					eq(pushSubscriptions.customerId, profile.id),
					eq(pushSubscriptions.active, true),
				),
			);

		const publicKey = c.env.WEB_PUSH_VAPID_PUBLIC_KEY ?? null;
		return ok<CustomerPushConfigPayload>(c, {
			configured: Boolean(publicKey && c.env.WEB_PUSH_VAPID_PRIVATE_KEY),
			publicKey,
			subscribed: (subscribed?.value ?? 0) > 0,
		});
	})

	.post(
		"/push/subscriptions",
		validate("json", pushSubscriptionUpsertSchema),
		async (c) => {
			const profile = c.get("profile");
			const db = getDb(c.env);
			const input = c.req.valid("json");

			const existing = await db.query.pushSubscriptions.findFirst({
				where: and(
					eq(pushSubscriptions.businessId, profile.businessId),
					eq(pushSubscriptions.endpoint, input.endpoint),
				),
			});

			if (existing && existing.customerId !== profile.id) {
				throw new ApiError(
					"conflict",
					"This push subscription is already linked to another account.",
				);
			}

			if (existing) {
				await db
					.update(pushSubscriptions)
					.set({
						p256dhKey: input.p256dhKey,
						authKey: input.authKey,
						deviceLabel: input.deviceLabel ?? null,
						active: true,
						lastSeenAt: new Date(),
					})
					.where(eq(pushSubscriptions.id, existing.id));
			} else {
				await db.insert(pushSubscriptions).values({
					businessId: profile.businessId,
					customerId: profile.id,
					endpoint: input.endpoint,
					p256dhKey: input.p256dhKey,
					authKey: input.authKey,
					deviceLabel: input.deviceLabel ?? null,
					active: true,
					lastSeenAt: new Date(),
				});
			}

			return ok<CustomerPushSubscriptionStatusPayload>(c, { subscribed: true });
		},
	)

	.post(
		"/push/subscriptions/delete",
		validate("json", pushSubscriptionDeleteSchema),
		async (c) => {
			const profile = c.get("profile");
			const db = getDb(c.env);
			const input = c.req.valid("json");

			await db
				.update(pushSubscriptions)
				.set({ active: false, lastSeenAt: new Date() })
				.where(
					and(
						eq(pushSubscriptions.businessId, profile.businessId),
						eq(pushSubscriptions.customerId, profile.id),
						eq(pushSubscriptions.endpoint, input.endpoint),
					),
				);

			return ok<CustomerPushSubscriptionStatusPayload>(c, { subscribed: false });
		},
	)

	.delete("/account", async (c) => {
		const profile = c.get("profile");
		const db = getDb(c.env);

		// D1 in this environment rejects explicit SQL BEGIN statements, so the
		// delete flow is executed in a strict order without db.transaction().
		await db
			.delete(customerRewards)
			.where(eq(customerRewards.customerId, profile.id));

		await db.delete(loyaltyCodes).where(eq(loyaltyCodes.customerId, profile.id));

		await db
			.delete(notifications)
			.where(eq(notifications.customerId, profile.id));

		await db
			.delete(pushSubscriptions)
			.where(eq(pushSubscriptions.customerId, profile.id));

		await db
			.delete(loyaltyTransactions)
			.where(
				or(
					eq(loyaltyTransactions.customerId, profile.id),
					eq(loyaltyTransactions.staffId, profile.id),
					eq(loyaltyTransactions.approvedBy, profile.id),
				),
			);

		await db.delete(profiles).where(eq(profiles.id, profile.id));
		await db.delete(authUsers).where(eq(authUsers.id, profile.authUserId));

		await db.insert(auditLogs).values({
			businessId: profile.businessId,
			actorUserId: profile.authUserId,
			actorRole: profile.role,
			action: "customer.account.deleted",
			entityType: "profile",
			entityId: profile.id,
			oldValueJson: {
				profileId: profile.id,
				authUserId: profile.authUserId,
				email: profile.email,
			},
		});

		return ok<AccountDeletionPayload>(c, { deleted: true });
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

		const [coffee, rewards, pointsEnabled, activePromotionRows, carouselSpeedSetting] =
			await Promise.all([
				getCoffeeProgress(db, profile.businessId, profile.id),
				listCustomerRewards(db, profile.businessId, profile.id),
				isPointsProgramActive(db, profile.businessId),
				db.query.promotions.findMany({
					where: and(
						eq(promotions.businessId, profile.businessId),
						eq(promotions.active, true),
						lte(promotions.startAt, now),
						gte(promotions.endAt, now),
					),
					orderBy: (row, { desc }) => [desc(row.startAt)],
				}),
				db.query.appSettings.findFirst({
					where: and(
						eq(appSettings.businessId, profile.businessId),
						eq(appSettings.key, SETTINGS_PROMOTION_CAROUSEL_SPEED_SECONDS_KEY),
					),
					columns: { valueJson: true },
				}),
			]);

		const availableRewards = rewards
			.filter((reward) => reward.status === "available")
			.slice(0, REWARD_PREVIEW_SIZE);
		const activePromotions = activePromotionRows.map(toPromotionSummary);

		return ok<CustomerHomePayload>(c, {
			user: toSessionUser(profile),
			coffee,
			availableRewards,
			activePromotion: activePromotions[0] ?? null,
			activePromotions,
			promotionCarouselSpeedSeconds: parsePromotionCarouselSpeedSeconds(
				carouselSpeedSetting?.valueJson,
			),
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
				.orderBy(asc(menuItems.sortOrder), asc(menuItems.name)),
		]);

		const variantRows =
			itemRows.length === 0
				? []
				: await db
					.select({
						id: menuItemVariants.id,
						menuItemId: menuItemVariants.menuItemId,
						name: menuItemVariants.name,
						priceCents: menuItemVariants.priceCents,
						sortOrder: menuItemVariants.sortOrder,
					})
					.from(menuItemVariants)
					.innerJoin(menuItems, eq(menuItems.id, menuItemVariants.menuItemId))
					.where(
						and(
							eq(menuItemVariants.active, true),
							eq(menuItems.businessId, profile.businessId),
							eq(menuItems.active, true),
						),
					)
					.orderBy(asc(menuItemVariants.sortOrder), asc(menuItemVariants.name));

		const variantsByItemId = new Map<
			string,
			{ id: string; name: string; priceCents: number }[]
		>();
		for (const variant of variantRows) {
			const list = variantsByItemId.get(variant.menuItemId) ?? [];
			list.push({
				id: variant.id,
				name: variant.name,
				priceCents: variant.priceCents,
			});
			variantsByItemId.set(variant.menuItemId, list);
		}

		const categories: MenuCategorySummary[] = categoryRows.map((category) => ({
			id: category.id,
			name: category.name,
			description: category.description,
			menuGroup: category.menuGroup,
			imageKey: category.imageKey,
			items: itemRows
				.filter((item) => item.categoryId === category.id)
				.map((item) => ({
					id: item.id,
					name: item.name,
					description: item.description,
					optionNotes: item.optionNotes,
					priceCents: item.priceCents,
					imageKey: item.imageKey,
					popular: item.popular,
					vegetarian: item.vegetarian,
					spicy: item.spicy,
					isNew: item.isNew,
					subjectToAvailability: item.subjectToAvailability,
					available: item.available,
					variants: variantsByItemId.get(item.id) ?? [],
				})),
		}));

		return ok<CustomerMenuPayload>(c, { categories });
	});
