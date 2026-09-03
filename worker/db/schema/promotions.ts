import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";
import {
	createdAt,
	flag,
	pk,
	timestampMs,
	updatedAt,
} from "./_columns";
import { businesses } from "./business";

export const promotions = sqliteTable(
	"promotions",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		subtitle: text("subtitle"),
		description: text("description"),
		imageKey: text("image_key"),
		startAt: timestampMs("start_at").notNull(),
		endAt: timestampMs("end_at").notNull(),
		active: flag("active").notNull().default(true),
		ctaText: text("cta_text"),
		ctaUrl: text("cta_url"),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		index("promotions_business_window_idx").on(
			t.businessId,
			t.active,
			t.startAt,
			t.endAt,
		),
	],
);
