import { useCallback, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { z } from "zod";
import { emailSchema, PASSWORD_MIN_LENGTH, passwordSchema } from "@shared/auth";
import { BRAND } from "@shared/branding";
import { birthdaySchema, mobileNumberSchema } from "@shared/profile";
import { ROLE_HOME } from "@shared/roles";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthLayout, FormError } from "@/features/auth/AuthLayout";
import { TurnstileWidget } from "@/features/auth/TurnstileWidget";
import { useRegister } from "@/features/auth/useSession";

// Mirrors shared/auth.ts registerSchema, but allows an empty birthday input
// (an unfilled <input type="date"> submits "", not undefined).
const registerFormSchema = z.object({
	name: z.string().trim().min(2, "Enter your name.").max(80, "That name is too long."),
	email: emailSchema,
	password: passwordSchema,
	mobileNumber: mobileNumberSchema,
	birthday: z.union([z.literal(""), birthdaySchema]),
});

type RegisterFormInput = z.infer<typeof registerFormSchema>;

export function RegisterPage() {
	const [showPassword, setShowPassword] = useState(false);
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
	const [turnstileResetKey, setTurnstileResetKey] = useState(0);
	const [turnstileMessage, setTurnstileMessage] = useState<string | null>(null);
	const navigate = useNavigate();
	const registerAccount = useRegister();
	const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? "";
	const turnstileEnabled = turnstileSiteKey.length > 0;
	const turnstileMisconfigured = import.meta.env.PROD && !turnstileEnabled;

	const handleTurnstileToken = useCallback((token: string | null) => {
		setTurnstileToken(token);
		if (token) {
			setTurnstileMessage(null);
		}
	}, []);

	const handleTurnstileExpired = useCallback(() => {
		setTurnstileMessage("Verification expired. Please try again.");
	}, []);

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<RegisterFormInput>({ resolver: zodResolver(registerFormSchema) });

	const onSubmit = handleSubmit((values) => {
		if (turnstileMisconfigured) {
			setTurnstileMessage(
				`Registration verification is not configured. Please contact support at ${BRAND.support.email}.`,
			);
			return;
		}

		if (turnstileEnabled && !turnstileToken) {
			setTurnstileMessage("Complete the bot check and try again.");
			return;
		}

		const token = turnstileEnabled ? turnstileToken ?? undefined : undefined;
		setTurnstileMessage(null);
		registerAccount.mutate(
			{ ...values, birthday: values.birthday || undefined, turnstileToken: token },
			{
				onSuccess: (user) => {
					void navigate(ROLE_HOME[user.role], { replace: true });
				},
				onError: () => {
					if (!turnstileEnabled) return;
					setTurnstileToken(null);
					setTurnstileResetKey((current) => current + 1);
					setTurnstileMessage("Please complete verification again.");
				},
			},
		);
	});

	const disableSubmit =
		turnstileMisconfigured || (turnstileEnabled && !turnstileToken);

	return (
		<AuthLayout
			title="Create your account"
			subtitle={`Join ${BRAND.rewardsName} and start collecting.`}
			footer={
				<>
					Already a member?{" "}
					<Link to="/login" className="text-brand-secondary underline">
						Sign in
					</Link>
				</>
			}
		>
			<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
				{turnstileMisconfigured && (
					<FormError
						message={`Registration verification is unavailable. Please contact support at ${BRAND.support.email}.`}
					/>
				)}
				{registerAccount.isError && (
					<FormError message={registerAccount.error.message} />
				)}

				<Input
					label="Full name"
					autoComplete="name"
					error={errors.name?.message}
					{...register("name")}
				/>
				<Input
					label="Email"
					type="email"
					autoComplete="email"
					inputMode="email"
					error={errors.email?.message}
					{...register("email")}
				/>
				<Input
					label="Mobile number"
					autoComplete="tel"
					inputMode="tel"
					placeholder="082 123 4567"
					error={errors.mobileNumber?.message}
					{...register("mobileNumber")}
				/>
				<Input
					label="Birthday (optional)"
					type="date"
					autoComplete="bday"
					hint="Add your birthday so we can send you a birthday treat 🎂"
					error={errors.birthday?.message}
					{...register("birthday")}
				/>
				<Input
					label="Password"
					type={showPassword ? "text" : "password"}
					autoComplete="new-password"
					hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
					error={errors.password?.message}
					trailingControl={
						<button
							type="button"
							onClick={() => setShowPassword((current) => !current)}
							aria-label={showPassword ? "Hide password" : "Show password"}
							aria-pressed={showPassword}
							className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-muted transition-colors hover:text-brand-text"
						>
							{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
						</button>
					}
					{...register("password")}
				/>

				{turnstileEnabled ? (
					<TurnstileWidget
						siteKey={turnstileSiteKey}
						action="sign-up"
						resetKey={turnstileResetKey}
						onTokenChange={handleTurnstileToken}
						onExpired={handleTurnstileExpired}
					/>
				) : null}

				{turnstileMessage ? <FormError message={turnstileMessage} /> : null}

				<Button
					type="submit"
					loading={registerAccount.isPending}
					disabled={disableSubmit}
					fullWidth
				>
					Create account
				</Button>
			</form>
		</AuthLayout>
	);
}
