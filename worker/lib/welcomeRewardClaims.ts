import { and, asc, count, eq } from "drizzle-orm";
import type { Db } from "@worker/db/client";
import {
	customerRewards,
	profiles,
	rewardDefinitions,
	welcomeRewardClaims,
} from "@worker/db/schema";

const encoder = new TextEncoder();

type WelcomeClaimIdentityType = "email" | "mobile";

interface WelcomeClaimIdentityInput {
	email?: string | null;
	mobileNumber?: string | null;
}

interface WelcomeClaimMarker {
	identityType: WelcomeClaimIdentityType;
	identityHash: string;
}

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeWelcomeClaimEmail(value: string): string | null {
	const normalized = value.trim().toLowerCase();
	return normalized.length > 0 ? normalized : null;
}

function normalizeWelcomeClaimMobile(value: string): string | null {
	const compact = value.trim().replace(/[\s-]/g, "");
	if (!compact) return null;

	const digits = compact.replace(/^\+/, "");
	if (/^0\d{9}$/.test(digits)) {
		return `27${digits.slice(1)}`;
	}
	if (/^27\d{9}$/.test(digits)) {
		return digits;
	}
	return null;
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
	return toHex(new Uint8Array(signature));
}

export function getWelcomeClaimHashSecret(env: Env): string {
	const configured = env.WELCOME_CLAIM_HASH_SECRET?.trim();
	if (configured) return configured;
	throw new Error("WELCOME_CLAIM_HASH_SECRET is not configured.");
}

export async function buildWelcomeClaimMarkers(
	hashSecret: string,
	identity: WelcomeClaimIdentityInput,
): Promise<WelcomeClaimMarker[]> {
	const normalizedEmail = identity.email
		? normalizeWelcomeClaimEmail(identity.email)
		: null;
	const normalizedMobile = identity.mobileNumber
		? normalizeWelcomeClaimMobile(identity.mobileNumber)
		: null;

	const candidates: Array<{ identityType: WelcomeClaimIdentityType; value: string }> = [];
	if (normalizedEmail) {
		candidates.push({ identityType: "email", value: normalizedEmail });
	}
	if (normalizedMobile) {
		candidates.push({ identityType: "mobile", value: normalizedMobile });
	}

	if (candidates.length === 0) return [];

	const markers = await Promise.all(
		candidates.map(async (candidate) => ({
			identityType: candidate.identityType,
			identityHash: await hmacSha256Hex(hashSecret, candidate.value),
		})),
	);

	const seen = new Set<string>();
	return markers.filter((marker) => {
		const key = `${marker.identityType}:${marker.identityHash}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export async function reserveWelcomeClaimMarkers(
	db: Db,
	businessId: string,
	markers: WelcomeClaimMarker[],
	claimedAt: Date,
): Promise<{ reserved: boolean; insertedMarkers: WelcomeClaimMarker[] }> {
	if (markers.length === 0) {
		return { reserved: false, insertedMarkers: [] };
	}

	const insertedMarkers: WelcomeClaimMarker[] = [];
	for (const marker of markers) {
		const [inserted] = await db
			.insert(welcomeRewardClaims)
			.values({
				businessId,
				identityType: marker.identityType,
				identityHash: marker.identityHash,
				claimedAt,
			})
			.onConflictDoNothing()
			.returning({
				identityType: welcomeRewardClaims.identityType,
				identityHash: welcomeRewardClaims.identityHash,
			});

		if (!inserted) {
			await releaseWelcomeClaimMarkers(db, businessId, insertedMarkers);
			return { reserved: false, insertedMarkers: [] };
		}

		insertedMarkers.push(marker);
	}

	return { reserved: true, insertedMarkers };
}

export async function releaseWelcomeClaimMarkers(
	db: Db,
	businessId: string,
	markers: WelcomeClaimMarker[],
): Promise<void> {
	for (const marker of markers) {
		await db
			.delete(welcomeRewardClaims)
			.where(
				and(
					eq(welcomeRewardClaims.businessId, businessId),
					eq(welcomeRewardClaims.identityType, marker.identityType),
					eq(welcomeRewardClaims.identityHash, marker.identityHash),
				),
			);
	}
}

async function findFirstWelcomeIssuedAt(
	db: Db,
	businessId: string,
	customerId: string,
): Promise<Date | null> {
	const row = await db
		.select({ issuedAt: customerRewards.issuedAt })
		.from(customerRewards)
		.innerJoin(
			rewardDefinitions,
			eq(customerRewards.rewardDefinitionId, rewardDefinitions.id),
		)
		.where(
			and(
				eq(customerRewards.businessId, businessId),
				eq(customerRewards.customerId, customerId),
				eq(rewardDefinitions.welcomeReward, true),
			),
		)
		.orderBy(asc(customerRewards.issuedAt))
		.limit(1)
		.then((rows) => rows[0]);

	return row?.issuedAt ?? null;
}

export async function registerKnownMobileWelcomeClaimMarker(
	db: Db,
	hashSecret: string,
	businessId: string,
	customerId: string,
	mobileNumber: string | null,
): Promise<void> {
	if (!mobileNumber) return;

	const firstWelcomeIssuedAt = await findFirstWelcomeIssuedAt(db, businessId, customerId);
	if (!firstWelcomeIssuedAt) return;

	const markers = await buildWelcomeClaimMarkers(hashSecret, { mobileNumber });
	for (const marker of markers) {
		if (marker.identityType !== "mobile") continue;
		await db
			.insert(welcomeRewardClaims)
			.values({
				businessId,
				identityType: marker.identityType,
				identityHash: marker.identityHash,
				claimedAt: firstWelcomeIssuedAt,
			})
			.onConflictDoNothing();
	}
}

export async function backfillWelcomeClaimMarkersForBusiness(
	db: Db,
	hashSecret: string,
	businessId: string,
): Promise<{ scannedRewards: number; insertedMarkers: number }> {
	const rows = await db
		.select({
			customerId: customerRewards.customerId,
			email: profiles.email,
			mobileNumber: profiles.mobileNumber,
			issuedAt: customerRewards.issuedAt,
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
				eq(rewardDefinitions.welcomeReward, true),
			),
		)
		.orderBy(asc(customerRewards.issuedAt));

	let insertedMarkers = 0;
	const seen = new Set<string>();
	for (const row of rows) {
		const markers = await buildWelcomeClaimMarkers(hashSecret, {
			email: row.email,
			mobileNumber: row.mobileNumber,
		});
		for (const marker of markers) {
			const key = `${marker.identityType}:${marker.identityHash}`;
			if (seen.has(key)) continue;
			seen.add(key);

			const [inserted] = await db
				.insert(welcomeRewardClaims)
				.values({
					businessId,
					identityType: marker.identityType,
					identityHash: marker.identityHash,
					claimedAt: row.issuedAt,
				})
				.onConflictDoNothing()
				.returning({ value: welcomeRewardClaims.identityHash });
			if (inserted) insertedMarkers += 1;
		}
	}

	return {
		scannedRewards: rows.length,
		insertedMarkers,
	};
}

export async function customerHasWelcomeReward(
	db: Db,
	businessId: string,
	customerId: string,
): Promise<boolean> {
	const [row] = await db
		.select({ value: count() })
		.from(customerRewards)
		.innerJoin(
			rewardDefinitions,
			eq(customerRewards.rewardDefinitionId, rewardDefinitions.id),
		)
		.where(
			and(
				eq(customerRewards.businessId, businessId),
				eq(customerRewards.customerId, customerId),
				eq(rewardDefinitions.welcomeReward, true),
			),
		);

	return (row?.value ?? 0) > 0;
}
