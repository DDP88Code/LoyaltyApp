import { z } from "zod";
import type { NotificationType } from "./domain";

export interface CustomerNotificationItem {
	id: string;
	type: NotificationType;
	title: string;
	message: string;
	actionUrl: string | null;
	createdAt: string;
	readAt: string | null;
	expiresAt: string | null;
}

export interface CustomerNotificationsPayload {
	notifications: CustomerNotificationItem[];
	total: number;
	limit: number;
	offset: number;
}

export interface CustomerUnreadNotificationsPayload {
	unread: number;
}

export interface CustomerLatestUnreadNotificationPayload {
	notification: CustomerNotificationItem | null;
}

export interface CustomerMarkNotificationReadPayload {
	updated: true;
}

export interface CustomerMarkAllNotificationsReadPayload {
	updatedCount: number;
}

export interface CustomerPushConfigPayload {
	configured: boolean;
	publicKey: string | null;
	subscribed: boolean;
}

export interface CustomerPushSubscriptionStatusPayload {
	subscribed: boolean;
}

export const pushSubscriptionUpsertSchema = z.object({
	endpoint: z.string().url().max(2000),
	p256dhKey: z.string().min(10).max(400),
	authKey: z.string().min(10).max(400),
	deviceLabel: z.string().trim().max(120).nullable().optional(),
});

export const pushSubscriptionDeleteSchema = z.object({
	endpoint: z.string().url().max(2000),
});

export type PushSubscriptionUpsertInput = z.infer<
	typeof pushSubscriptionUpsertSchema
>;

export type PushSubscriptionDeleteInput = z.infer<
	typeof pushSubscriptionDeleteSchema
>;
