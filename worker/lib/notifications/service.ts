import { and, eq } from "drizzle-orm";
import { BRAND } from "@shared/branding";
import type { NotificationType } from "@shared/domain";
import type { Db } from "@worker/db/client";
import { notifications, profiles, pushSubscriptions } from "@worker/db/schema";
import {
	createPushProvider,
	isWebPushConfigured,
	type PushProvider,
} from "@worker/lib/notifications/pushProvider";

export type PushAudience = "account" | "marketing" | "none";

export interface CreateNotificationInput {
	businessId: string;
	customerId: string;
	type: NotificationType;
	title: string;
	message: string;
	actionUrl?: string | null;
	sourceType?: string | null;
	sourceId?: string | null;
	expiresAt?: Date | null;
	pushAudience?: PushAudience;
}

export interface NotificationCreateResult {
	status: "created" | "duplicate" | "failed";
	notificationId: string | null;
}

export interface NotificationService {
	createNotification(
		input: CreateNotificationInput,
	): Promise<NotificationCreateResult>;
	notifyRewardEarned(input: {
		businessId: string;
		customerId: string;
		rewardName: string;
		rewardId: string;
	}): Promise<NotificationCreateResult>;
	notifyRewardExpiring(input: {
		businessId: string;
		customerId: string;
		customerRewardId: string;
		rewardName: string;
		daysRemaining: number;
	}): Promise<NotificationCreateResult>;
	notifyBirthdayReward(input: {
		businessId: string;
		customerId: string;
		customerRewardId: string;
	}): Promise<NotificationCreateResult>;
	notifyPromotion(input: {
		businessId: string;
		customerId: string;
		promotionId: string;
		title: string;
		message: string;
		actionUrl?: string | null;
	}): Promise<NotificationCreateResult>;
	notifyRedemption(input: {
		businessId: string;
		customerId: string;
		rewardId: string;
		rewardName: string;
		locationName: string;
		billReference?: string | null;
	}): Promise<NotificationCreateResult>;
	notifyWelcomeReward(input: {
		businessId: string;
		customerId: string;
		customerRewardId: string;
	}): Promise<NotificationCreateResult>;
}

function expiryMessage(rewardName: string, daysRemaining: number): string {
	if (rewardName.toLowerCase().includes("welcome") || rewardName.includes("R50")) {
		return `Your R50 ${BRAND.notifications.rewardExpiryVoucherLabel} expires in ${daysRemaining} days.`;
	}
	return `Your ${rewardName} reward expires in ${daysRemaining} days.`;
}

function canSendPush(
	preference: { notificationOptIn: boolean; marketingOptIn: boolean },
	audience: PushAudience,
): boolean {
	if (audience === "none") return false;
	if (audience === "marketing") return preference.marketingOptIn;
	return preference.notificationOptIn;
}

async function deliverPushIfEligible(
	db: Db,
	env: Env,
	pushProvider: PushProvider,
	notificationId: string,
	input: CreateNotificationInput,
): Promise<void> {
	if ((input.pushAudience ?? "account") === "none") return;
	if (!isWebPushConfigured(env)) return;

	const profile = await db.query.profiles.findFirst({
		where: and(
			eq(profiles.id, input.customerId),
			eq(profiles.businessId, input.businessId),
			eq(profiles.role, "customer"),
			eq(profiles.active, true),
		),
		columns: {
			notificationOptIn: true,
			marketingOptIn: true,
		},
	});
	if (!profile) return;

	if (!canSendPush(profile, input.pushAudience ?? "account")) return;

	const subscriptions = await db
		.select({
			id: pushSubscriptions.id,
			endpoint: pushSubscriptions.endpoint,
			p256dhKey: pushSubscriptions.p256dhKey,
			authKey: pushSubscriptions.authKey,
			deviceLabel: pushSubscriptions.deviceLabel,
		})
		.from(pushSubscriptions)
		.where(
			and(
				eq(pushSubscriptions.businessId, input.businessId),
				eq(pushSubscriptions.customerId, input.customerId),
				eq(pushSubscriptions.active, true),
			),
		);

	if (subscriptions.length === 0) return;

	let delivered = false;
	for (const subscription of subscriptions) {
		try {
			const result = await pushProvider.send(subscription, {
				notificationId,
				type: input.type,
				title: input.title,
				message: input.message,
				actionUrl: input.actionUrl ?? null,
			});
			if (result.ok) {
				delivered = true;
				continue;
			}
			if (result.gone) {
				await db
					.update(pushSubscriptions)
					.set({ active: false })
					.where(eq(pushSubscriptions.id, subscription.id));
			}
		} catch (error) {
			console.warn("Push delivery failed", {
				customerId: input.customerId,
				subscriptionId: subscription.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	if (!delivered) return;
	await db
		.update(notifications)
		.set({ pushSentAt: new Date() })
		.where(eq(notifications.id, notificationId));
}

export function createNotificationService(db: Db, env: Env): NotificationService {
	const pushProvider = createPushProvider(env);

	async function createNotification(
		input: CreateNotificationInput,
	): Promise<NotificationCreateResult> {
		let createdId: string | null = null;
		try {
			const [inserted] = await db
				.insert(notifications)
				.values({
					businessId: input.businessId,
					customerId: input.customerId,
					type: input.type,
					title: input.title,
					message: input.message,
					actionUrl: input.actionUrl ?? null,
					sourceType: input.sourceType ?? null,
					sourceId: input.sourceId ?? null,
					expiresAt: input.expiresAt ?? null,
				})
				.onConflictDoNothing()
				.returning({ id: notifications.id });

			if (!inserted?.id) {
				let duplicateNotificationId: string | null = null;
				if (input.sourceType && input.sourceId) {
					const existing = await db.query.notifications.findFirst({
						where: and(
							eq(notifications.businessId, input.businessId),
							eq(notifications.customerId, input.customerId),
							eq(notifications.type, input.type),
							eq(notifications.sourceType, input.sourceType),
							eq(notifications.sourceId, input.sourceId),
						),
						columns: {
							id: true,
							pushSentAt: true,
						},
					});

					if (existing) {
						duplicateNotificationId = existing.id;
						if (!existing.pushSentAt) {
							try {
								await deliverPushIfEligible(
									db,
									env,
									pushProvider,
									existing.id,
									input,
								);
							} catch (error) {
								console.error("Push retry phase failed for duplicate notification", {
									notificationId: existing.id,
									error: error instanceof Error ? error.message : String(error),
								});
							}
						}
					}
				}

				return { status: "duplicate", notificationId: duplicateNotificationId };
			}
			createdId = inserted.id;
		} catch (error) {
			console.error("Creating in-app notification failed", {
				customerId: input.customerId,
				type: input.type,
				error: error instanceof Error ? error.message : String(error),
			});
			return { status: "failed", notificationId: null };
		}

		if (!createdId) return { status: "failed", notificationId: null };

		try {
			await deliverPushIfEligible(db, env, pushProvider, createdId, input);
		} catch (error) {
			console.error("Push phase failed for notification", {
				notificationId: createdId,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		return { status: "created", notificationId: createdId };
	}

	return {
		createNotification,
		async notifyRewardEarned(input) {
			return createNotification({
				businessId: input.businessId,
				customerId: input.customerId,
				type: "reward_earned",
				title: "Free Coffee Unlocked ☕",
				message: "Your next coffee is on us.",
				actionUrl: "/app/rewards",
				sourceType: "reward_issue",
				sourceId: input.rewardId,
				pushAudience: "account",
			});
		},
		async notifyRewardExpiring(input) {
			return createNotification({
				businessId: input.businessId,
				customerId: input.customerId,
				type: "reward_expiring",
				title: "Reward expiring soon",
				message: expiryMessage(input.rewardName, input.daysRemaining),
				actionUrl: "/app/rewards",
				sourceType: "reward_expiry_warning",
				sourceId: `${input.customerRewardId}:${input.daysRemaining}days`,
				pushAudience: "account",
			});
		},
		async notifyBirthdayReward(input) {
			return createNotification({
				businessId: input.businessId,
				customerId: input.customerId,
				type: "birthday_reward",
				title: "Happy Birthday! 🎂",
				message:
					"Your free small hot beverage is waiting for you. Valid for 30 days.",
				actionUrl: "/app/rewards",
				sourceType: "reward_issue",
				sourceId: input.customerRewardId,
				pushAudience: "account",
			});
		},
		async notifyPromotion(input) {
			return createNotification({
				businessId: input.businessId,
				customerId: input.customerId,
				type: "promotion",
				title: input.title,
				message: input.message,
				actionUrl: input.actionUrl ?? "/app/menu",
				sourceType: "promotion",
				sourceId: input.promotionId,
				pushAudience: "account",
			});
		},
		async notifyRedemption(input) {
			const reference = input.billReference?.trim();
			const referenceSegment = reference ? ` Ref ${reference}.` : "";
			return createNotification({
				businessId: input.businessId,
				customerId: input.customerId,
				type: "redemption_receipt",
				title: "Reward redeemed",
				message: `${input.rewardName} redeemed${referenceSegment}`,
				actionUrl: "/app/rewards",
				sourceType: "redemption",
				sourceId: input.rewardId,
				pushAudience: "account",
			});
		},
		async notifyWelcomeReward(input) {
			return createNotification({
				businessId: input.businessId,
				customerId: input.customerId,
				type: "system",
				title: BRAND.displayNames.welcomeReward,
				message: BRAND.notifications.welcomeVoucherMessage,
				actionUrl: "/app/rewards",
				sourceType: "reward_issue",
				sourceId: input.customerRewardId,
				pushAudience: "account",
			});
		},
	};
}
