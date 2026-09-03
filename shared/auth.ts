import { z } from "zod";

/**
 * Shared between the sign-up form and the Worker so a rule can never be
 * enforced in the browser alone. Mirrors Better Auth's `minPasswordLength`.
 */
export const PASSWORD_MIN_LENGTH = 10;

export const emailSchema = z
	.string()
	.trim()
	.min(1, "Enter your email address.")
	.email("Enter a valid email address.")
	.max(254)
	.toLowerCase();

export const passwordSchema = z
	.string()
	.min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
	.max(128, "That password is too long.");

export const signInSchema = z.object({
	email: emailSchema,
	password: z.string().min(1, "Enter your password."),
});

export const registerSchema = z.object({
	name: z
		.string()
		.trim()
		.min(2, "Enter your name.")
		.max(80, "That name is too long."),
	email: emailSchema,
	password: passwordSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
