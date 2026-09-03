import { and, eq, gt, isNull } from "drizzle-orm";
import {
	DEFAULT_LOYALTY_CODE_TTL_SECONDS,
	type LoyaltyCodePayload,
	type ResolveLoyaltyCodeInput,
} from "@shared/loyaltyCode";
import type { Db } from "@worker/db/client";
import { appSettings, loyaltyCodes } from "@worker/db/schema";

const OTP_MODULUS = 1_000_000;
// Largest multiple of OTP_MODULUS that fits in a Uint32 — rejecting values above
// it keeps every one of the million possible OTPs equally likely.
const OTP_REJECTION_CEILING = Math.floor(0x1_0000_0000 / OTP_MODULUS) * OTP_MODULUS;

function toHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomOtp(): string {
	const buffer = new Uint32Array(1);
	let value: number;
	do {
		crypto.getRandomValues(buffer);
		value = buffer[0] as number;
	} while (value >= OTP_REJECTION_CEILING);
	return (value % OTP_MODULUS).toString().padStart(6, "0");
}

function randomQrToken(): string {
	return toHex(crypto.getRandomValues(new Uint8Array(24)));
}

/**
 * A 6-digit OTP has only a million possibilities, so a plain hash would be
 * rainbow-table-able. Keying with the Worker's secret means reversing a stored
 * hash requires that secret, not just the hash itself.
 */
async function hmacHex(secret: string, value: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(value),
	);
	return toHex(new Uint8Array(signature));
}

async function getLoyaltyCodeTtlSeconds(
	db: Db,
	businessId: string,
): Promise<number> {
	const setting = await db.query.appSettings.findFirst({
		where: and(
			eq(appSettings.businessId, businessId),
			eq(appSettings.key, "loyalty_code_ttl_seconds"),
		),
	});
	const value = setting?.valueJson;
	return typeof value === "number" && value > 0
		? value
		: DEFAULT_LOYALTY_CODE_TTL_SECONDS;
}

/**
 * Issues a fresh OTP + QR token pair. Only hashes are ever written to D1; the
 * raw values returned here are the only time they exist outside the customer's
 * screen. Any code still active for this customer is invalidated first, so a
 * screenshot of an old code can never be replayed after a new one is generated.
 */
export async function issueLoyaltyCode(
	db: Db,
	secret: string,
	businessId: string,
	customerId: string,
): Promise<LoyaltyCodePayload> {
	const ttlSeconds = await getLoyaltyCodeTtlSeconds(db, businessId);
	const otp = randomOtp();
	const qrToken = randomQrToken();
	const [otpHash, qrTokenHash] = await Promise.all([
		hmacHex(secret, otp),
		hmacHex(secret, qrToken),
	]);

	const now = new Date();
	const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

	await db
		.update(loyaltyCodes)
		.set({ usedAt: now })
		.where(and(eq(loyaltyCodes.customerId, customerId), isNull(loyaltyCodes.usedAt)));

	await db.insert(loyaltyCodes).values({
		businessId,
		customerId,
		otpHash,
		qrTokenHash,
		expiresAt,
	});

	return { otp, qrToken, expiresAt: expiresAt.toISOString() };
}

/**
 * Validates and immediately consumes a code. A code that fails to match is
 * indistinguishable from one that matched but already expired or was already
 * used — the caller can't tell which, which is deliberate.
 */
export async function resolveLoyaltyCode(
	db: Db,
	secret: string,
	businessId: string,
	input: ResolveLoyaltyCodeInput,
): Promise<{ customerId: string } | null> {
	const raw = input.otp ?? input.qrToken;
	if (!raw) return null;

	const hash = await hmacHex(secret, raw);
	const matchColumn = input.otp ? loyaltyCodes.otpHash : loyaltyCodes.qrTokenHash;
	const now = new Date();

	const code = await db.query.loyaltyCodes.findFirst({
		where: and(
			eq(loyaltyCodes.businessId, businessId),
			eq(matchColumn, hash),
			isNull(loyaltyCodes.usedAt),
			gt(loyaltyCodes.expiresAt, now),
		),
	});
	if (!code) return null;

	// Single-use the moment it resolves, whatever happens next in the caller.
	await db
		.update(loyaltyCodes)
		.set({ usedAt: now })
		.where(eq(loyaltyCodes.id, code.id));

	return { customerId: code.customerId };
}
