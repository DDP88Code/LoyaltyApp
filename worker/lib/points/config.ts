import { and, asc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { DEFAULT_TIMEZONE } from "@shared/domain";
import {
	DEFAULT_POINTS_PROGRAM_NAME,
	POINTS_CURRENCY_CODE,
} from "@shared/points";
import type { Db } from "@worker/db/client";
import { locations, loyaltyPrograms } from "@worker/db/schema";
import { ApiError } from "@worker/lib/http";

const LEGACY_HIDDEN_LOCATION_NAME = "Fives Main Branch";

const pointsRateSchema = z
	.object({
		earnRatePoints: z.number().int().positive().nullable(),
		earnRateSpendCents: z.number().int().positive().nullable(),
	})
	.refine(
		(value) =>
			(value.earnRatePoints === null && value.earnRateSpendCents === null) ||
			(value.earnRatePoints !== null && value.earnRateSpendCents !== null),
		"Points rate must define both earnRatePoints and earnRateSpendCents.",
	);

export interface PointsProgramConfig {
	id: string;
	businessId: string;
	name: string;
	active: boolean;
	earnRatePoints: number;
	earnRateSpendCents: number;
	timezone: string;
}

export async function ensurePointsProgram(
	db: Db,
	businessId: string,
): Promise<string> {
	let program = await db.query.loyaltyPrograms.findFirst({
		where: and(
			eq(loyaltyPrograms.businessId, businessId),
			eq(loyaltyPrograms.currencyCode, POINTS_CURRENCY_CODE),
		),
		columns: { id: true },
	});
	if (!program) {
		const [inserted] = await db
			.insert(loyaltyPrograms)
			.values({
				businessId,
				name: DEFAULT_POINTS_PROGRAM_NAME,
				description: "Earn points on eligible non-coffee spend.",
				programType: "points",
				currencyCode: POINTS_CURRENCY_CODE,
				active: false,
				earnRatePoints: 1,
				earnRateSpendCents: 100,
				rewardDefinitionId: null,
				sortOrder: 20,
			})
			.onConflictDoNothing()
			.returning({ id: loyaltyPrograms.id });
		if (inserted?.id) {
			return inserted.id;
		}
		program = await db.query.loyaltyPrograms.findFirst({
			where: and(
				eq(loyaltyPrograms.businessId, businessId),
				eq(loyaltyPrograms.currencyCode, POINTS_CURRENCY_CODE),
			),
			columns: { id: true },
		});
	}
	if (!program) {
		throw new Error("Points program could not be initialized.");
	}
	return program.id;
}

async function readPointsProgramRow(db: Db, businessId: string) {
	return db.query.loyaltyPrograms.findFirst({
		where: and(
			eq(loyaltyPrograms.businessId, businessId),
			eq(loyaltyPrograms.currencyCode, POINTS_CURRENCY_CODE),
			eq(loyaltyPrograms.programType, "points"),
		),
	});
}

export async function requirePointsProgram(
	db: Db,
	businessId: string,
): Promise<PointsProgramConfig> {
	const program = await readPointsProgramRow(db, businessId);
	if (!program || !program.active) {
		throw new ApiError("conflict", "Reward Points is not available.");
	}
	const parsed = pointsRateSchema.safeParse({
		earnRatePoints: program.earnRatePoints,
		earnRateSpendCents: program.earnRateSpendCents,
	});
	if (!parsed.success || parsed.data.earnRatePoints == null || parsed.data.earnRateSpendCents == null) {
		throw new ApiError(
			"conflict",
			"Reward Points configuration is incomplete. Ask an admin to review the earning rate.",
		);
	}
	return {
		id: program.id,
		businessId: program.businessId,
		name: program.name,
		active: program.active,
		earnRatePoints: parsed.data.earnRatePoints,
		earnRateSpendCents: parsed.data.earnRateSpendCents,
		timezone: DEFAULT_TIMEZONE,
	};
}

export async function readPointsProgramForAdmin(
	db: Db,
	businessId: string,
): Promise<PointsProgramConfig | null> {
	const program = await readPointsProgramRow(db, businessId);
	if (!program) {
		return null;
	}
	const parsed = pointsRateSchema.safeParse({
		earnRatePoints: program.earnRatePoints,
		earnRateSpendCents: program.earnRateSpendCents,
	});
	if (!parsed.success || parsed.data.earnRatePoints == null || parsed.data.earnRateSpendCents == null) {
		return {
			id: program.id,
			businessId: program.businessId,
			name: program.name,
			active: program.active,
			earnRatePoints: 1,
			earnRateSpendCents: 100,
			timezone: DEFAULT_TIMEZONE,
		};
	}
	return {
		id: program.id,
		businessId: program.businessId,
		name: program.name,
		active: program.active,
		earnRatePoints: parsed.data.earnRatePoints,
		earnRateSpendCents: parsed.data.earnRateSpendCents,
		timezone: DEFAULT_TIMEZONE,
	};
}

export async function resolvePointsRedemptionLocationId(
	db: Db,
	businessId: string,
): Promise<string> {
	const location = await db.query.locations.findFirst({
		where: and(
			eq(locations.businessId, businessId),
			eq(locations.active, true),
			ne(locations.name, LEGACY_HIDDEN_LOCATION_NAME),
		),
		orderBy: [asc(locations.createdAt)],
		columns: { id: true },
	});
	if (!location) {
		throw new ApiError(
			"conflict",
			"Reward Points redemption is not available until an active location is configured.",
		);
	}
	return location.id;
}
