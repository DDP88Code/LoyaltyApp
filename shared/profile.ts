import { z } from "zod";

/** South African mobile numbers: 06/07/08 prefixes, in local or +27 form. */
const SA_MOBILE = /^(?:\+27|0)[6-8]\d{8}$/;

const MAX_AGE_YEARS = 120;

export const mobileNumberSchema = z
	.string()
	.trim()
	.transform((value) => value.replace(/[\s-]/g, ""))
	.refine((value) => SA_MOBILE.test(value), {
		message: "Enter a South African mobile number, for example 082 123 4567.",
	});

export const birthdaySchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD.")
	.refine((value) => {
		const date = new Date(`${value}T00:00:00Z`);
		if (Number.isNaN(date.getTime())) return false;
		// Round-trip check: rejects impossible dates such as 2026-02-31.
		if (date.toISOString().slice(0, 10) !== value) return false;
		const now = Date.now();
		const oldest = now - MAX_AGE_YEARS * 365.25 * 86_400_000;
		return date.getTime() <= now && date.getTime() >= oldest;
	}, "Enter a valid date of birth.");

/**
 * The only profile fields a customer may change. Role, active status, business
 * and email are absent by design — the Worker would ignore them anyway.
 */
export const updateProfileSchema = z
	.object({
		fullName: z.string().trim().min(2, "Enter your name.").max(80),
		mobileNumber: mobileNumberSchema.nullable(),
		birthday: birthdaySchema.nullable(),
		marketingOptIn: z.boolean(),
		notificationOptIn: z.boolean(),
	})
	.partial()
	.refine((value) => Object.keys(value).length > 0, {
		message: "Nothing to update.",
	});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
