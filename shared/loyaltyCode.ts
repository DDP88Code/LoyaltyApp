import { z } from "zod";
import type { CoffeeProgress, RewardSummary } from "./loyalty";

export const OTP_LENGTH = 6;

/** A default. The Worker prefers `app_settings.loyalty_code_ttl_seconds` when set. */
export const DEFAULT_LOYALTY_CODE_TTL_SECONDS = 600;

/** Raw values are only ever present in this one response, right after generation. */
export interface LoyaltyCodePayload {
	otp: string;
	qrToken: string;
	expiresAt: string;
}

/** The minimum a staff member needs to act — no email, mobile or birthday. */
export interface StaffResolvedCustomerPayload {
	customerId: string;
	fullName: string;
	coffee: CoffeeProgress | null;
	availableFreeCoffees: RewardSummary[];
	availableVouchers: RewardSummary[];
}

/** Same as above, plus how many rewards this specific action just issued. */
export interface CoffeeEarnResultPayload extends StaffResolvedCustomerPayload {
	newlyIssuedCount: number;
}

export const resolveLoyaltyCodeSchema = z
	.object({
		otp: z
			.string()
			.trim()
			.regex(/^\d{6}$/, "Enter the 6-digit code exactly as shown.")
			.optional(),
		qrToken: z.string().trim().min(1).max(256).optional(),
	})
	.refine((value) => Boolean(value.otp) !== Boolean(value.qrToken), {
		message: "Provide either the 6-digit code or a scanned QR code, not both.",
	});

export type ResolveLoyaltyCodeInput = z.infer<typeof resolveLoyaltyCodeSchema>;
