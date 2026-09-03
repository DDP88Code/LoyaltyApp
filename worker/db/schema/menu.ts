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
		menuGroup: text("menu_group", { enum: ["food", "drinks"] })
			.notNull()
			.default("food"),
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
		index("menu_categories_business_group_sort_idx").on(
			t.businessId,
			t.menuGroup,
			t.sortOrder,
		),
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
		optionNotes: text("option_notes").notNull().default(""),
		priceCents: integer("price_cents").notNull(),
		imageKey: text("image_key"),
		active: flag("active").notNull().default(true),
		available: flag("available").notNull().default(true),
		popular: flag("popular").notNull().default(false),
		vegetarian: flag("vegetarian").notNull().default(false),
		spicy: flag("spicy").notNull().default(false),
		isNew: flag("is_new").notNull().default(false),
		subjectToAvailability: flag("subject_to_availability")
			.notNull()
			.default(false),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		index("menu_items_category_sort_idx").on(t.categoryId, t.sortOrder),
		index("menu_items_business_active_idx").on(t.businessId, t.active),
	],
);

export const menuItemVariants = sqliteTable(
	"menu_item_variants",
	{
		id: pk(),
		menuItemId: text("menu_item_id")
			.notNull()
			.references(() => menuItems.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		priceCents: integer("price_cents").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
		active: flag("active").notNull().default(true),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		index("menu_item_variants_item_sort_idx").on(t.menuItemId, t.sortOrder),
		uniqueIndex("menu_item_variants_item_name_unq").on(t.menuItemId, t.name),
	],
);
