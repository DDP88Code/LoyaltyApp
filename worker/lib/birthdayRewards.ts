import { and, eq } from "drizzle-orm";
import type { Db } from "@worker/db/client";
import { customerRewards, profiles } from "@worker/db/schema";
import {
	MVP_BIRTHDAY_REWARD_NAME,
	MVP_BIRTHDAY_REWARD_VALID_DAYS,
	ensureBirthdayRewardDefinition,
} from "@worker/lib/defaults";

const DAY_MS = 86_400_000;
const JOHANNESBURG_TIME_ZONE = "Africa/Johannesburg";

interface JohannesburgDateParts {
	year: number;
	month: number;
	day: number;
}

interface BirthdayCandidate {
	id: string;
	businessId: string;
	role: string;
	active: boolean;
	birthday: string | null;
}

export interface BirthdayRewardIssued {
	businessId: string;
	customerId: string;
	customerRewardId: string;
}

export interface BirthdayIssuanceSummary {
	date: string;
	timeZone: string;
	rewardName: string;
	scannedCustomers: number;
	matchedBirthdays: number;
	issued: number;
	alreadyIssued: number;
	skippedNoBirthday: number;
	skippedInvalidBirthday: number;
	skippedInactiveRewardDefinition: boolean;
}

function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
	if (month === 2) return isLeapYear(year) ? 29 : 28;
	if ([4, 6, 9, 11].includes(month)) return 30;
	return 31;
}

function parseDateOnly(value: string): JohannesburgDateParts | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return null;

	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
		return null;
	}
	if (month < 1 || month > 12) return null;
	if (day < 1 || day > daysInMonth(year, month)) return null;

	return { year, month, day };
}

function toDateParts(value: Date): JohannesburgDateParts {
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: JOHANNESBURG_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});

	const map = new Map<string, string>();
	for (const part of formatter.formatToParts(value)) {
		if (part.type === "year" || part.type === "month" || part.type === "day") {
			map.set(part.type, part.value);
		}
	}

	const year = Number(map.get("year"));
	const month = Number(map.get("month"));
	const day = Number(map.get("day"));
	if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
		throw new Error("Failed to resolve Africa/Johannesburg date parts.");
	}

	return { year, month, day };
}

function dateOnlyKey(parts: JohannesburgDateParts): string {
	const month = String(parts.month).padStart(2, "0");
	const day = String(parts.day).padStart(2, "0");
	return `${parts.year}-${month}-${day}`;
}

function isBirthdayDueToday(
	birthdayIso: string,
	today: JohannesburgDateParts,
): "due" | "not_due" | "invalid" {
	const birthday = parseDateOnly(birthdayIso);
	if (!birthday) return "invalid";

	if (birthday.month === 2 && birthday.day === 29) {
		if (isLeapYear(today.year)) {
			return today.month === 2 && today.day === 29 ? "due" : "not_due";
		}
		return today.month === 2 && today.day === 28 ? "due" : "not_due";
	}

	return birthday.month === today.month && birthday.day === today.day
		? "due"
		: "not_due";
}

async function issueBirthdayRewardIfDue(
	db: Db,
	candidate: BirthdayCandidate,
	rewardDefinitionId: string,
	today: JohannesburgDateParts,
	now: Date,
): Promise<
	| { status: "issued"; customerRewardId: string }
	| { status: "already_issued" }
	| { status: "not_due" }
	| { status: "invalid" }
	| { status: "no_birthday" }
> {
	if (!candidate.birthday) return { status: "no_birthday" };

	const due = isBirthdayDueToday(candidate.birthday, today);
	if (due === "invalid") return { status: "invalid" };
	if (due === "not_due") return { status: "not_due" };

	const issuanceKey = `birthday:${candidate.id}:${today.year}`;
	const expiresAt = new Date(now.getTime() + MVP_BIRTHDAY_REWARD_VALID_DAYS * DAY_MS);

	const inserted = await db
		.insert(customerRewards)
		.values({
			businessId: candidate.businessId,
			customerId: candidate.id,
			rewardDefinitionId,
			expiresAt,
			issuanceKey,
		})
		.onConflictDoNothing()
		.returning({ id: customerRewards.id });

	if (inserted.length === 0 || !inserted[0]) {
		return { status: "already_issued" };
	}

	return { status: "issued", customerRewardId: inserted[0].id };
}

export async function reconcileBirthdayRewardForCustomer(
	db: Db,
	candidate: BirthdayCandidate,
	onIssued?: (issued: BirthdayRewardIssued) => Promise<void>,
	now = new Date(),
): Promise<boolean> {
	if (candidate.role !== "customer" || !candidate.active || !candidate.birthday) {
		return false;
	}

	const reward = await ensureBirthdayRewardDefinition(db, candidate.businessId);
	if (!reward.active) return false;

	const today = toDateParts(now);
	const result = await issueBirthdayRewardIfDue(
		db,
		candidate,
		reward.id,
		today,
		now,
	);

	if (result.status === "issued" && onIssued) {
		await onIssued({
			businessId: candidate.businessId,
			customerId: candidate.id,
			customerRewardId: result.customerRewardId,
		});
	}

	return result.status === "issued";
}

export async function issueBirthdayRewardsForBusiness(
	db: Db,
	businessId: string,
	onIssued?: (issued: BirthdayRewardIssued) => Promise<void>,
	now = new Date(),
): Promise<BirthdayIssuanceSummary> {
	const today = toDateParts(now);
	const reward = await ensureBirthdayRewardDefinition(db, businessId);

	const summary: BirthdayIssuanceSummary = {
		date: dateOnlyKey(today),
		timeZone: JOHANNESBURG_TIME_ZONE,
		rewardName: MVP_BIRTHDAY_REWARD_NAME,
		scannedCustomers: 0,
		matchedBirthdays: 0,
		issued: 0,
		alreadyIssued: 0,
		skippedNoBirthday: 0,
		skippedInvalidBirthday: 0,
		skippedInactiveRewardDefinition: !reward.active,
	};

	if (!reward.active) {
		return summary;
	}

	const candidates = await db
		.select({
			id: profiles.id,
			businessId: profiles.businessId,
			role: profiles.role,
			active: profiles.active,
			birthday: profiles.birthday,
		})
		.from(profiles)
		.where(
			and(
				eq(profiles.businessId, businessId),
				eq(profiles.role, "customer"),
				eq(profiles.active, true),
			),
		);

	summary.scannedCustomers = candidates.length;

	for (const candidate of candidates) {
		try {
			const result = await issueBirthdayRewardIfDue(
				db,
				candidate,
				reward.id,
				today,
				now,
			);
			if (result.status === "no_birthday") {
				summary.skippedNoBirthday += 1;
				continue;
			}
			if (result.status === "invalid") {
				summary.skippedInvalidBirthday += 1;
				console.warn("Skipping invalid customer birthday", {
					customerId: candidate.id,
				});
				continue;
			}
			if (result.status === "not_due") {
				continue;
			}

			summary.matchedBirthdays += 1;
			if (result.status === "issued") {
				summary.issued += 1;
				if (onIssued) {
					await onIssued({
						businessId,
						customerId: candidate.id,
						customerRewardId: result.customerRewardId,
					});
				}
			} else {
				summary.alreadyIssued += 1;
			}
		} catch (error) {
			console.error("Birthday reward issuance failed", {
				customerId: candidate.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return summary;
}
