import { and, eq, gte, isNull, lte } from "drizzle-orm";
import type { Db } from "@worker/db/client";
import { profiles, promotions } from "@worker/db/schema";
import { createNotificationService } from "@worker/lib/notifications/service";

export interface PromotionBroadcastSummary {
	businessId: string;
	scannedPromotions: number;
	notificationsCreated: number;
	alreadyNotified: number;
	failed: number;
	markedSent: number;
}

function promotionMessage(input: {
	subtitle: string | null;
	description: string | null;
}): string {
	const subtitle = input.subtitle?.trim();
	if (subtitle) return subtitle;
	const description = input.description?.trim();
	if (description) return description;
	return "New promotion now available at Fives.";
}

export async function notifyActivePromotionsAwaitingBroadcast(
	db: Db,
	env: Env,
	businessId: string,
	now = new Date(),
): Promise<PromotionBroadcastSummary> {
	const duePromotions = await db
		.select({
			id: promotions.id,
			title: promotions.title,
			subtitle: promotions.subtitle,
			description: promotions.description,
			ctaUrl: promotions.ctaUrl,
		})
		.from(promotions)
		.where(
			and(
				eq(promotions.businessId, businessId),
				eq(promotions.active, true),
				eq(promotions.notifyCustomers, true),
				isNull(promotions.notificationSentAt),
				lte(promotions.startAt, now),
				gte(promotions.endAt, now),
			),
		)
		.orderBy(promotions.startAt);

	if (duePromotions.length === 0) {
		return {
			businessId,
			scannedPromotions: 0,
			notificationsCreated: 0,
			alreadyNotified: 0,
			failed: 0,
			markedSent: 0,
		};
	}

	const customers = await db
		.select({ id: profiles.id })
		.from(profiles)
		.where(
			and(
				eq(profiles.businessId, businessId),
				eq(profiles.role, "customer"),
				eq(profiles.active, true),
			),
		);

	const notificationService = createNotificationService(db, env);
	let notificationsCreated = 0;
	let alreadyNotified = 0;
	let failed = 0;
	let markedSent = 0;

	for (const promotion of duePromotions) {
		let promotionFailed = 0;

		for (const customer of customers) {
			const result = await notificationService.notifyPromotion({
				businessId,
				customerId: customer.id,
				promotionId: promotion.id,
				title: promotion.title,
				message: promotionMessage(promotion),
				actionUrl: promotion.ctaUrl ?? "/app/menu",
			});
			if (result.status === "created") {
				notificationsCreated += 1;
				continue;
			}
			if (result.status === "duplicate") {
				alreadyNotified += 1;
				continue;
			}
			failed += 1;
			promotionFailed += 1;
		}

		if (promotionFailed > 0) {
			console.warn("Promotion customer notify sweep will retry", {
				businessId,
				promotionId: promotion.id,
				promotionFailed,
				customersScanned: customers.length,
			});
			continue;
		}

		await db
			.update(promotions)
			.set({ notificationSentAt: now })
			.where(eq(promotions.id, promotion.id));
		markedSent += 1;
	}

	return {
		businessId,
		scannedPromotions: duePromotions.length,
		notificationsCreated,
		alreadyNotified,
		failed,
		markedSent,
	};
}
