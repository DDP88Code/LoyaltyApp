import { z } from "zod";
import { birthdaySchema, mobileNumberSchema } from "./profile";

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
	mobileNumber: mobileNumberSchema,
	birthday: birthdaySchema.optional(),
});

export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, "Enter your current password."),
		newPassword: passwordSchema,
		confirmNewPassword: z.string().min(1, "Confirm your new password."),
	})
	.refine((data) => data.newPassword === data.confirmNewPassword, {
		message: "Passwords do not match.",
		path: ["confirmNewPassword"],
	});

export const forgotPasswordSchema = z.object({
	email: emailSchema,
});

export const resetPasswordSchema = z
	.object({
		newPassword: passwordSchema,
		confirmNewPassword: z.string().min(1, "Confirm your new password."),
	})
	.refine((data) => data.newPassword === data.confirmNewPassword, {
		message: "Passwords do not match.",
		path: ["confirmNewPassword"],
	});

export type SignInInput = z.infer<typeof signInSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
