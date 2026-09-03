import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createdAt, flag, pk, updatedAt } from "./_columns";
import { businesses } from "./business";

export const menuCategories = sqliteTable(
	"menu_categories",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description"),
		// R2 object key, never a public URL.
		imageKey: text("image_key"),
		sortOrder: integer("sort_order").notNull().default(0),
		active: flag("active").notNull().default(true),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		uniqueIndex("menu_categories_business_name_unq").on(t.businessId, t.name),
		index("menu_categories_business_sort_idx").on(t.businessId, t.sortOrder),
	],
);

export const menuItems = sqliteTable(
	"menu_items",
	{
		id: pk(),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		categoryId: text("category_id")
			.notNull()
			.references(() => menuCategories.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description").notNull().default(""),
		priceCents: integer("price_cents").notNull(),
		imageKey: text("image_key"),
		active: flag("active").notNull().default(true),
		available: flag("available").notNull().default(true),
		popular: flag("popular").notNull().default(false),
		vegetarian: flag("vegetarian").notNull().default(false),
		spicy: flag("spicy").notNull().default(false),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		index("menu_items_category_sort_idx").on(t.categoryId, t.sortOrder),
		index("menu_items_business_active_idx").on(t.businessId, t.active),
	],
);
