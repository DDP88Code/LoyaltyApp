import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { BRAND } from "@shared/branding";
import { COFFEE_CURRENCY_CODE, DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from "@shared/domain";
import type { Db } from "@worker/db/client";
import {
	appSettings,
	businesses,
	locations,
	loyaltyPrograms,
	rewardDefinitions,
} from "@worker/db/schema";

export const MVP_BUSINESS_NAME = BRAND.fullName;
export const MVP_LOCATION_NAME = "Fives Sports Bar - Pinehurst";
export const LEGACY_MVP_LOCATION_NAME = "Fives - Pinehurst";
export const LEGACY_HIDDEN_LOCATION_NAME = "Fives Main Branch";
export const MVP_LOCATION_ADDRESS = "Placeholder address - update in Admin.";

export const MVP_WELCOME_REWARD_NAME = BRAND.displayNames.welcomeReward;
export const MVP_FREE_COFFEE_REWARD_NAME = "Free Coffee";
export const MVP_COFFEE_PROGRAM_NAME = BRAND.displayNames.coffeeProgram;
export const MVP_BIRTHDAY_REWARD_NAME = "Birthday Treat";
export const MVP_BIRTHDAY_REWARD_DESCRIPTION =
	"Free small hot beverage of your choice.";
export const MVP_BIRTHDAY_REWARD_CUSTOMER_DESCRIPTION =
	"Enjoy a free small hot beverage of your choice for your birthday.";
export const MVP_BIRTHDAY_REWARD_TERMS =
	"One small hot beverage of your choice. One birthday reward per member per year.";
export const MVP_BIRTHDAY_REWARD_VALID_DAYS = 30;
export const MVP_BIRTHDAY_REWARD_ITEM_REFERENCE = "small_hot_beverage";
export const WELCOME_VOUCHER_MIN_BILL_CENTS = 50_000;

export const SETTINGS_WELCOME_REWARD_KEY = "welcome_reward_enabled";
export const SETTINGS_CODE_TTL_KEY = "loyalty_code_ttl_seconds";
export const SETTINGS_STAFF_VOUCHER_REDEMPTION_ENABLED =
	"staff_voucher_redemption_enabled";
export const SETTINGS_PROMOTION_CAROUSEL_SPEED_SECONDS_KEY =
	"promotion_carousel_speed_seconds";

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
	birthdayRewardId: string;
	coffeeProgramId: string;
}

export async function ensureBirthdayRewardDefinition(db: Db, businessId: string) {
	let rows = await db
		.select()
		.from(rewardDefinitions)
		.where(
			and(
				eq(rewardDefinitions.businessId, businessId),
				eq(rewardDefinitions.name, MVP_BIRTHDAY_REWARD_NAME),
			),
		)
		.orderBy(asc(rewardDefinitions.createdAt));

	if (rows.length === 0) {
		await db
			.insert(rewardDefinitions)
			.values({
				businessId,
				name: MVP_BIRTHDAY_REWARD_NAME,
				description: MVP_BIRTHDAY_REWARD_DESCRIPTION,
				rewardType: "free_item",
				itemReference: MVP_BIRTHDAY_REWARD_ITEM_REFERENCE,
				validDays: MVP_BIRTHDAY_REWARD_VALID_DAYS,
				active: true,
				terms: MVP_BIRTHDAY_REWARD_TERMS,
			})
			.onConflictDoNothing();

		rows = await db
			.select()
			.from(rewardDefinitions)
			.where(
				and(
					eq(rewardDefinitions.businessId, businessId),
					eq(rewardDefinitions.name, MVP_BIRTHDAY_REWARD_NAME),
				),
			)
			.orderBy(asc(rewardDefinitions.createdAt));
	}

	const activeRows = rows.filter((row) => row.active);
	if (activeRows.length > 1) {
		const keepId = activeRows[0]?.id;
		if (keepId) {
			await db
				.update(rewardDefinitions)
				.set({ active: false })
				.where(
					and(
						eq(rewardDefinitions.businessId, businessId),
						eq(rewardDefinitions.name, MVP_BIRTHDAY_REWARD_NAME),
						eq(rewardDefinitions.active, true),
						ne(rewardDefinitions.id, keepId),
					),
				);
			rows = rows.map((row) =>
				row.id === keepId
					? row
					: {
						...row,
						active: false,
					},
			);
		}
	}

	const birthdayReward = rows.find((row) => row.active) ?? rows[0];
	if (!birthdayReward) {
		throw new Error("Birthday reward definition could not be initialized.");
	}

	return birthdayReward;
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

	const locationCandidates = await db
		.select()
		.from(locations)
		.where(
			and(
				eq(locations.businessId, business.id),
				inArray(locations.name, [MVP_LOCATION_NAME, LEGACY_MVP_LOCATION_NAME]),
			),
		);

	let location =
		locationCandidates.find((row) => row.name === MVP_LOCATION_NAME) ??
		locationCandidates.find((row) => row.name === LEGACY_MVP_LOCATION_NAME) ??
		null;

	if (location?.name === LEGACY_MVP_LOCATION_NAME) {
		await db
			.update(locations)
			.set({ name: MVP_LOCATION_NAME })
			.where(
				and(
					eq(locations.id, location.id),
					eq(locations.businessId, business.id),
					eq(locations.name, LEGACY_MVP_LOCATION_NAME),
				),
			);
		location = {
			...location,
			name: MVP_LOCATION_NAME,
		};
	}

	if (!location) {
		location =
			(
				await db
			.insert(locations)
			.values({
				businessId: business.id,
				name: MVP_LOCATION_NAME,
				address: MVP_LOCATION_ADDRESS,
			})
			.onConflictDoNothing()
			.returning()
			)[0] ?? null;
	}
	if (!location) {
		location =
			(
				await db.query.locations.findFirst({
			where: and(
				eq(locations.businessId, business.id),
				eq(locations.name, MVP_LOCATION_NAME),
			),
			})
			) ?? null;
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
				description: "R50.00 off your bill when you spend R500.00 or more.",
				rewardType: "voucher",
				valueCents: 5000,
				validDays: 30,
				welcomeReward: true,
				active: true,
				terms: "One per member. Minimum spend R500. Valid for 30 days from issue.",
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
				description: `Free coffee reward earned through ${MVP_COFFEE_PROGRAM_NAME}.`,
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

	const birthdayReward = await ensureBirthdayRewardDefinition(db, business.id);

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
		ensureSettingIfMissing(
			db,
			business.id,
			SETTINGS_STAFF_VOUCHER_REDEMPTION_ENABLED,
			false,
		),
		ensureSettingIfMissing(
			db,
			business.id,
			SETTINGS_PROMOTION_CAROUSEL_SPEED_SECONDS_KEY,
			3,
		),
	]);

	return {
		businessId: business.id,
		locationId: location.id,
		welcomeRewardId: welcomeReward.id,
		freeCoffeeRewardId: freeCoffeeReward.id,
		birthdayRewardId: birthdayReward.id,
		coffeeProgramId: coffeeProgram.id,
	};
}