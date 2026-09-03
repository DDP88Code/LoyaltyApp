import { and, eq } from "drizzle-orm";
import {
	COFFEE_CURRENCY_CODE,
	DEFAULT_CURRENCY,
	DEFAULT_TIMEZONE,
} from "@shared/domain";
import type { Db } from "@worker/db/client";
import {
	appSettings,
	businesses,
	locations,
	loyaltyPrograms,
	menuCategories,
	menuItems,
	promotions,
	rewardDefinitions,
} from "@worker/db/schema";

const DAY_MS = 86_400_000;
const PLACEHOLDER = "Placeholder menu item — replace before launch.";

interface SeedItem {
	name: string;
	priceCents: number;
	popular?: boolean;
	vegetarian?: boolean;
	spicy?: boolean;
}

const MENU: ReadonlyArray<{ name: string; items: readonly SeedItem[] }> = [
	{
		name: "Breakfast",
		items: [
			{ name: "Full English Breakfast", priceCents: 12900 },
			{ name: "Eggs Benedict", priceCents: 9900 },
		],
	},
	{
		name: "Burgers",
		items: [
			{ name: "Fives Signature Burger", priceCents: 14900, popular: true },
			{ name: "Veggie Burger", priceCents: 12900, vegetarian: true },
			{ name: "Peri-Peri Chicken Burger", priceCents: 13900, spicy: true },
		],
	},
	{
		name: "Pizza",
		items: [
			{ name: "Margherita", priceCents: 11900, vegetarian: true },
			{ name: "Meat Lovers", priceCents: 15900 },
		],
	},
	{
		name: "Grills",
		items: [
			{ name: "300g Rump Steak", priceCents: 19900, popular: true },
			{ name: "Lamb Chops", priceCents: 22900 },
		],
	},
	{
		name: "Light Meals",
		items: [
			{ name: "Chicken Caesar Salad", priceCents: 10900 },
			{ name: "Beef Nachos", priceCents: 9900, spicy: true },
		],
	},
	{
		name: "Coffee",
		items: [
			{ name: "Cappuccino", priceCents: 3900, popular: true },
			{ name: "Americano", priceCents: 3200 },
			{ name: "Flat White", priceCents: 4200 },
		],
	},
	{
		name: "Drinks",
		items: [
			{ name: "Craft Lager", priceCents: 4500 },
			{ name: "Fresh Orange Juice", priceCents: 3500 },
		],
	},
	{
		name: "Desserts",
		items: [
			{ name: "Malva Pudding", priceCents: 6500 },
			{ name: "Chocolate Brownie", priceCents: 6900 },
		],
	},
];

export interface SeedSummary {
	businessId: string;
	locationId: string;
	coffeeProgramId: string;
	created: Record<string, number>;
	unchanged: Record<string, number>;
}

class SeedCounter {
	readonly created: Record<string, number> = {};
	readonly unchanged: Record<string, number> = {};

	record(entity: string, created: boolean) {
		const bucket = created ? this.created : this.unchanged;
		bucket[entity] = (bucket[entity] ?? 0) + 1;
	}
}

/**
 * Re-runnable development seed. Every entity is looked up by a natural key
 * first, so running it twice never duplicates rows and never overwrites data an
 * operator has since edited.
 */
export async function seedDevelopmentData(
	db: Db,
	businessSlug: string,
): Promise<SeedSummary> {
	const count = new SeedCounter();

	let business = await db.query.businesses.findFirst({
		where: eq(businesses.slug, businessSlug),
	});
	if (!business) {
		[business] = await db
			.insert(businesses)
			.values({
				name: "Fives Pub & Grill",
				slug: businessSlug,
				currency: DEFAULT_CURRENCY,
				timezone: DEFAULT_TIMEZONE,
			})
			.returning();
		count.record("businesses", true);
	} else {
		count.record("businesses", false);
	}
	if (!business) throw new Error("Failed to seed the business row.");
	const businessId = business.id;

	let location = await db.query.locations.findFirst({
		where: and(
			eq(locations.businessId, businessId),
			eq(locations.name, "Fives Main Branch"),
		),
	});
	if (!location) {
		[location] = await db
			.insert(locations)
			.values({
				businessId,
				name: "Fives Main Branch",
				address: "Placeholder address — update in Admin.",
			})
			.returning();
		count.record("locations", true);
	} else {
		count.record("locations", false);
	}
	if (!location) throw new Error("Failed to seed the location row.");

	let freeCoffee = await db.query.rewardDefinitions.findFirst({
		where: and(
			eq(rewardDefinitions.businessId, businessId),
			eq(rewardDefinitions.name, "Free Coffee"),
		),
	});
	if (!freeCoffee) {
		[freeCoffee] = await db
			.insert(rewardDefinitions)
			.values({
				businessId,
				name: "Free Coffee",
				description: "One free coffee of your choice.",
				rewardType: "free_item",
				itemReference: COFFEE_CURRENCY_CODE,
				validDays: 90,
				terms: "Valid at participating Fives locations. Not exchangeable for cash.",
			})
			.returning();
		count.record("reward_definitions", true);
	} else {
		count.record("reward_definitions", false);
	}
	if (!freeCoffee) throw new Error("Failed to seed the Free Coffee reward.");

	const welcome = await db.query.rewardDefinitions.findFirst({
		where: and(
			eq(rewardDefinitions.businessId, businessId),
			eq(rewardDefinitions.welcomeReward, true),
		),
	});
	if (!welcome) {
		await db.insert(rewardDefinitions).values({
			businessId,
			name: "Welcome to Fives",
			description: "R50.00 off your first visit as a Fives Rewards member.",
			rewardType: "voucher",
			valueCents: 5000,
			validDays: 30,
			welcomeReward: true,
			terms: "One per member. Valid for 30 days from issue.",
		});
		count.record("reward_definitions", true);
	} else {
		count.record("reward_definitions", false);
	}

	let program = await db.query.loyaltyPrograms.findFirst({
		where: and(
			eq(loyaltyPrograms.businessId, businessId),
			eq(loyaltyPrograms.currencyCode, COFFEE_CURRENCY_CODE),
		),
	});
	if (!program) {
		[program] = await db
			.insert(loyaltyPrograms)
			.values({
				businessId,
				name: "Fives Coffee Rewards",
				description: "Collect stamps on qualifying coffees and earn a free one.",
				programType: "stamp",
				currencyCode: COFFEE_CURRENCY_CODE,
				// Starting value only — Admin owns the threshold from here on.
				qualifyingPurchasesRequired: 10,
				rewardDefinitionId: freeCoffee.id,
			})
			.returning();
		count.record("loyalty_programs", true);
	} else {
		count.record("loyalty_programs", false);
	}
	if (!program) throw new Error("Failed to seed the coffee loyalty program.");

	for (const [index, category] of MENU.entries()) {
		let row = await db.query.menuCategories.findFirst({
			where: and(
				eq(menuCategories.businessId, businessId),
				eq(menuCategories.name, category.name),
			),
		});
		if (!row) {
			[row] = await db
				.insert(menuCategories)
				.values({ businessId, name: category.name, sortOrder: index })
				.returning();
			count.record("menu_categories", true);
		} else {
			count.record("menu_categories", false);
		}
		if (!row) throw new Error(`Failed to seed menu category ${category.name}.`);

		for (const [itemIndex, item] of category.items.entries()) {
			const existing = await db.query.menuItems.findFirst({
				where: and(
					eq(menuItems.categoryId, row.id),
					eq(menuItems.name, item.name),
				),
			});
			if (existing) {
				count.record("menu_items", false);
				continue;
			}
			await db.insert(menuItems).values({
				businessId,
				categoryId: row.id,
				name: item.name,
				description: PLACEHOLDER,
				priceCents: item.priceCents,
				popular: item.popular ?? false,
				vegetarian: item.vegetarian ?? false,
				spicy: item.spicy ?? false,
				sortOrder: itemIndex,
			});
			count.record("menu_items", true);
		}
	}

	const promotionTitle = "Wednesday Burger Special";
	const existingPromotion = await db.query.promotions.findFirst({
		where: and(
			eq(promotions.businessId, businessId),
			eq(promotions.title, promotionTitle),
		),
	});
	if (!existingPromotion) {
		const now = Date.now();
		await db.insert(promotions).values({
			businessId,
			title: promotionTitle,
			subtitle: "Every Wednesday, all day",
			description:
				"Any signature burger with a side for R99. Placeholder promotion — replace before launch.",
			startAt: new Date(now),
			endAt: new Date(now + 90 * DAY_MS),
			ctaText: "See the menu",
			ctaUrl: "/app/menu",
		});
		count.record("promotions", true);
	} else {
		count.record("promotions", false);
	}

	const settings: ReadonlyArray<{ key: string; valueJson: unknown }> = [
		{ key: "welcome_reward_enabled", valueJson: true },
		{ key: "loyalty_code_ttl_seconds", valueJson: 600 },
	];
	for (const setting of settings) {
		const existing = await db.query.appSettings.findFirst({
			where: and(
				eq(appSettings.businessId, businessId),
				eq(appSettings.key, setting.key),
			),
		});
		if (existing) {
			count.record("app_settings", false);
			continue;
		}
		await db.insert(appSettings).values({ businessId, ...setting });
		count.record("app_settings", true);
	}

	return {
		businessId,
		locationId: location.id,
		coffeeProgramId: program.id,
		created: count.created,
		unchanged: count.unchanged,
	};
}
