import { and, eq, gt } from "drizzle-orm";
import type { Db } from "@worker/db/client";
import { customerRewards, profiles, rewardDefinitions } from "@worker/db/schema";

const JOHANNESBURG_TIME_ZONE = "Africa/Johannesburg";

interface DateParts {
	year: number;
	month: number;
	day: number;
}

export interface RewardExpiryCandidate {
	businessId: string;
	customerId: string;
	customerRewardId: string;
	rewardName: string;
	expiresAt: Date;
}

export interface RewardExpirySummary {
	date: string;
	timeZone: string;
	scannedRewards: number;
	dueSoon: number;
	notified: number;
	alreadyNotified: number;
	skipped: number;
}

function toDateParts(value: Date, timeZone: string): DateParts {
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone,
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
		throw new Error("Failed to resolve report date parts.");
	}

	return { year, month, day };
}

function dateOnly(parts: DateParts): string {
	return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function daysBetween(start: DateParts, end: DateParts): number {
	const startUtc = Date.UTC(start.year, start.month - 1, start.day);
	const endUtc = Date.UTC(end.year, end.month - 1, end.day);
	return Math.round((endUtc - startUtc) / 86_400_000);
}

export async function notifyRewardsExpiringInDays(
	db: Db,
	businessId: string,
	daysRemaining: number,
	now: Date,
	notify: (candidate: RewardExpiryCandidate) => Promise<"created" | "duplicate" | "skipped">,
): Promise<RewardExpirySummary> {
	const today = toDateParts(now, JOHANNESBURG_TIME_ZONE);

	const rows = await db
		.select({
			businessId: customerRewards.businessId,
			customerId: customerRewards.customerId,
			customerRewardId: customerRewards.id,
			rewardName: rewardDefinitions.name,
			expiresAt: customerRewards.expiresAt,
		})
		.from(customerRewards)
		.innerJoin(
			rewardDefinitions,
			eq(customerRewards.rewardDefinitionId, rewardDefinitions.id),
		)
		.innerJoin(profiles, eq(customerRewards.customerId, profiles.id))
		.where(
			and(
				eq(customerRewards.businessId, businessId),
				eq(customerRewards.status, "available"),
				gt(customerRewards.expiresAt, now),
				eq(profiles.businessId, businessId),
				eq(profiles.role, "customer"),
				eq(profiles.active, true),
			),
		);

	let dueSoon = 0;
	let notified = 0;
	let alreadyNotified = 0;
	let skipped = 0;

	for (const row of rows) {
		if (!row.expiresAt) {
			skipped += 1;
			continue;
		}

		const expiry = toDateParts(row.expiresAt, JOHANNESBURG_TIME_ZONE);
		const diff = daysBetween(today, expiry);
		if (diff !== daysRemaining) {
			skipped += 1;
			continue;
		}

		dueSoon += 1;
		const result = await notify({
			businessId: row.businessId,
			customerId: row.customerId,
			customerRewardId: row.customerRewardId,
			rewardName: row.rewardName,
			expiresAt: row.expiresAt,
		});
		if (result === "created") {
			notified += 1;
		} else if (result === "duplicate") {
			alreadyNotified += 1;
		} else {
			skipped += 1;
		}
	}

	return {
		date: dateOnly(today),
		timeZone: JOHANNESBURG_TIME_ZONE,
		scannedRewards: rows.length,
		dueSoon,
		notified,
		alreadyNotified,
		skipped,
	};
}
