import { and, eq } from "drizzle-orm";
import { COFFEE_CURRENCY_CODE, DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from "@shared/domain";
import type { Db } from "@worker/db/client";
import {
	appSettings,
	businesses,
	locations,
	loyaltyPrograms,
	rewardDefinitions,
} from "@worker/db/schema";

export const MVP_BUSINESS_NAME = "Fives Pub & Grill";
export const MVP_LOCATION_NAME = "Fives Main Branch";
export const MVP_LOCATION_ADDRESS = "Placeholder address - update in Admin.";

export const MVP_WELCOME_REWARD_NAME = "Welcome to Fives";
export const MVP_FREE_COFFEE_REWARD_NAME = "Free Coffee";
export const MVP_COFFEE_PROGRAM_NAME = "Fives Coffee Rewards";

export const SETTINGS_WELCOME_REWARD_KEY = "welcome_reward_enabled";
export const SETTINGS_CODE_TTL_KEY = "loyalty_code_ttl_seconds";

async function ensureSettingIfMissing(
	db: Db,
	businessId: string,
	key: string,
	valueJson: unknown,
) {
	const existing = await db.query.appSettings.findFirst({
		where: and(eq(appSettings.businessId, businessId), eq(appSettings.key, key)),
		columns: { id: true },
	});
	if (existing) return;

	await db
		.insert(appSettings)
		.values({ businessId, key, valueJson })
		.onConflictDoNothing();
}

export interface MvpDefaultsResult {
	businessId: string;
	locationId: string;
	welcomeRewardId: string;
	freeCoffeeRewardId: string;
	coffeeProgramId: string;
}

/**
 * Idempotent defaults for MVP operations. It only creates missing records and
 * fills missing linkage values; it does not overwrite live operator changes.
 */
export async function ensureMvpDefaults(
	db: Db,
	businessSlug: string,
): Promise<MvpDefaultsResult> {
	let business = await db.query.businesses.findFirst({
		where: eq(businesses.slug, businessSlug),
	});
	if (!business) {
		[business] = await db
			.insert(businesses)
			.values({
				name: MVP_BUSINESS_NAME,
				slug: businessSlug,
				currency: DEFAULT_CURRENCY,
				timezone: DEFAULT_TIMEZONE,
			})
			.onConflictDoNothing()
			.returning();
	}
	if (!business) {
		business = await db.query.businesses.findFirst({
			where: eq(businesses.slug, businessSlug),
		});
	}
	if (!business) {
		throw new Error("Business row could not be initialized.");
	}

	let location = await db.query.locations.findFirst({
		where: and(
			eq(locations.businessId, business.id),
			eq(locations.name, MVP_LOCATION_NAME),
		),
	});
	if (!location) {
		[location] = await db
			.insert(locations)
			.values({
				businessId: business.id,
				name: MVP_LOCATION_NAME,
				address: MVP_LOCATION_ADDRESS,
			})
			.onConflictDoNothing()
			.returning();
	}
	if (!location) {
		location = await db.query.locations.findFirst({
			where: and(
				eq(locations.businessId, business.id),
				eq(locations.name, MVP_LOCATION_NAME),
			),
		});
	}
	if (!location) {
		throw new Error("Default location could not be initialized.");
	}

	let welcomeReward = await db.query.rewardDefinitions.findFirst({
		where: and(
			eq(rewardDefinitions.businessId, business.id),
			eq(rewardDefinitions.welcomeReward, true),
		),
	});
	if (!welcomeReward) {
		[welcomeReward] = await db
			.insert(rewardDefinitions)
			.values({
				businessId: business.id,
				name: MVP_WELCOME_REWARD_NAME,
				description: "R50.00 off your first visit as a Fives Rewards member.",
				rewardType: "voucher",
				valueCents: 5000,
				validDays: 30,
				welcomeReward: true,
				active: true,
				terms: "One per member. Valid for 30 days from issue.",
			})
			.onConflictDoNothing()
			.returning();
	}
	if (!welcomeReward) {
		welcomeReward = await db.query.rewardDefinitions.findFirst({
			where: and(
				eq(rewardDefinitions.businessId, business.id),
				eq(rewardDefinitions.welcomeReward, true),
			),
		});
	}
	if (!welcomeReward) {
		throw new Error("Welcome reward could not be initialized.");
	}

	let freeCoffeeReward = await db.query.rewardDefinitions.findFirst({
		where: and(
			eq(rewardDefinitions.businessId, business.id),
			eq(rewardDefinitions.name, MVP_FREE_COFFEE_REWARD_NAME),
		),
	});
	if (!freeCoffeeReward) {
		[freeCoffeeReward] = await db
			.insert(rewardDefinitions)
			.values({
				businessId: business.id,
				name: MVP_FREE_COFFEE_REWARD_NAME,
				description: "Free coffee reward earned through Fives Coffee Rewards.",
				rewardType: "free_item",
				itemReference: COFFEE_CURRENCY_CODE,
				validDays: 90,
				active: true,
			})
			.onConflictDoNothing()
			.returning();
	}
	if (!freeCoffeeReward) {
		freeCoffeeReward = await db.query.rewardDefinitions.findFirst({
			where: and(
				eq(rewardDefinitions.businessId, business.id),
				eq(rewardDefinitions.name, MVP_FREE_COFFEE_REWARD_NAME),
			),
		});
	}
	if (!freeCoffeeReward) {
		throw new Error("Free Coffee reward could not be initialized.");
	}

	let coffeeProgram = await db.query.loyaltyPrograms.findFirst({
		where: and(
			eq(loyaltyPrograms.businessId, business.id),
			eq(loyaltyPrograms.currencyCode, COFFEE_CURRENCY_CODE),
		),
	});
	if (!coffeeProgram) {
		[coffeeProgram] = await db
			.insert(loyaltyPrograms)
			.values({
				businessId: business.id,
				name: MVP_COFFEE_PROGRAM_NAME,
				description: "Collect stamps on qualifying coffees and earn a free one.",
				programType: "stamp",
				currencyCode: COFFEE_CURRENCY_CODE,
				qualifyingPurchasesRequired: 10,
				rewardDefinitionId: freeCoffeeReward.id,
				active: true,
				sortOrder: 0,
			})
			.onConflictDoNothing()
			.returning();
	}
	if (!coffeeProgram) {
		coffeeProgram = await db.query.loyaltyPrograms.findFirst({
			where: and(
				eq(loyaltyPrograms.businessId, business.id),
				eq(loyaltyPrograms.currencyCode, COFFEE_CURRENCY_CODE),
			),
		});
	}
	if (!coffeeProgram) {
		throw new Error("Coffee program could not be initialized.");
	}

	if (!coffeeProgram.rewardDefinitionId) {
		const [linked] = await db
			.update(loyaltyPrograms)
			.set({ rewardDefinitionId: freeCoffeeReward.id })
			.where(eq(loyaltyPrograms.id, coffeeProgram.id))
			.returning();
		if (linked) coffeeProgram = linked;
	}

	await Promise.all([
		ensureSettingIfMissing(
			db,
			business.id,
			SETTINGS_WELCOME_REWARD_KEY,
			true,
		),
		ensureSettingIfMissing(
			db,
			business.id,
			SETTINGS_CODE_TTL_KEY,
			600,
		),
	]);

	return {
		businessId: business.id,
		locationId: location.id,
		welcomeRewardId: welcomeReward.id,
		freeCoffeeRewardId: freeCoffeeReward.id,
		coffeeProgramId: coffeeProgram.id,
	};
}