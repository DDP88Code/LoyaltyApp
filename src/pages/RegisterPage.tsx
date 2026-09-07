import { useCallback, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { PASSWORD_MIN_LENGTH, type RegisterInput, registerSchema } from "@shared/auth";
import { ROLE_HOME } from "@shared/roles";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthLayout, FormError } from "@/features/auth/AuthLayout";
import { TurnstileWidget } from "@/features/auth/TurnstileWidget";
import { useRegister } from "@/features/auth/useSession";

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
	} = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

	const onSubmit = handleSubmit((values) => {
		if (turnstileMisconfigured) {
			setTurnstileMessage(
				"Registration verification is not configured. Please contact support.",
			);
			return;
		}

		if (turnstileEnabled && !turnstileToken) {
			setTurnstileMessage("Complete the bot check and try again.");
			return;
		}

		const token = turnstileEnabled ? turnstileToken ?? undefined : undefined;
		setTurnstileMessage(null);
		registerAccount.mutate({ ...values, turnstileToken: token }, {
			onSuccess: (user) => {
				void navigate(ROLE_HOME[user.role], { replace: true });
			},
			onError: () => {
				if (!turnstileEnabled) return;
				setTurnstileToken(null);
				setTurnstileResetKey((current) => current + 1);
				setTurnstileMessage("Please complete verification again.");
			},
		});
	});

	const disableSubmit =
		turnstileMisconfigured || (turnstileEnabled && !turnstileToken);

	return (
		<AuthLayout
			title="Create your account"
			subtitle="Join Fives Rewards and start collecting."
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
					<FormError message="Registration verification is unavailable. Please contact support." />
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
