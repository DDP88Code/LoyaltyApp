import { sql } from "drizzle-orm";
import {
	index,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { NOTIFICATION_TYPES } from "../../../shared/domain";
import { businesses } from "./business";
import { createdAt, flag, pk, timestampMs, updatedAt } from "./_columns";
import { profiles } from "./profiles";

export const notifications = sqliteTable(
	"notifications",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		customerId: text("customer_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		type: text("type", { enum: NOTIFICATION_TYPES }).notNull(),
		title: text("title").notNull(),
		message: text("message").notNull(),
		actionUrl: text("action_url"),
		sourceType: text("source_type"),
		sourceId: text("source_id"),
		createdAt: createdAt(),
		readAt: timestampMs("read_at"),
		expiresAt: timestampMs("expires_at"),
		pushSentAt: timestampMs("push_sent_at"),
	},
	(t) => [
		index("notifications_customer_idx").on(t.customerId),
		index("notifications_created_at_idx").on(t.createdAt),
		index("notifications_read_at_idx").on(t.readAt),
		index("notifications_type_idx").on(t.type),
		index("notifications_customer_created_idx").on(t.customerId, t.createdAt),
		uniqueIndex("notifications_customer_type_source_unq")
			.on(t.customerId, t.type, t.sourceType, t.sourceId)
			.where(sql`source_type is not null and source_id is not null`),
	],
);

export const pushSubscriptions = sqliteTable(
	"push_subscriptions",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		customerId: text("customer_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		endpoint: text("endpoint").notNull(),
		p256dhKey: text("p256dh_key").notNull(),
		authKey: text("auth_key").notNull(),
		deviceLabel: text("device_label"),
		active: flag("active").notNull().default(true),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		lastSeenAt: timestampMs("last_seen_at"),
	},
	(t) => [
		uniqueIndex("push_subscriptions_business_endpoint_unq").on(
			t.businessId,
			t.endpoint,
		),
		index("push_subscriptions_customer_idx").on(t.customerId),
		index("push_subscriptions_customer_active_idx").on(t.customerId, t.active),
	],
);
