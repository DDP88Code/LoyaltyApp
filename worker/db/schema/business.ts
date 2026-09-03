import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from "../../../shared/domain";
import { createdAt, flag, json, pk, updatedAt } from "./_columns";

export const businesses = sqliteTable(
	"businesses",
	{
		id: pk(),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		currency: text("currency").notNull().default(DEFAULT_CURRENCY),
		timezone: text("timezone").notNull().default(DEFAULT_TIMEZONE),
		active: flag("active").notNull().default(true),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [uniqueIndex("businesses_slug_unq").on(t.slug)],
);

export const locations = sqliteTable(
	"locations",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		address: text("address"),
		active: flag("active").notNull().default(true),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		index("locations_business_idx").on(t.businessId),
		uniqueIndex("locations_business_name_unq").on(t.businessId, t.name),
	],
);

export const appSettings = sqliteTable(
	"app_settings",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		key: text("key").notNull(),
		valueJson: json("value_json").notNull(),
		updatedAt: updatedAt(),
	},
	(t) => [uniqueIndex("app_settings_business_key_unq").on(t.businessId, t.key)],
);
