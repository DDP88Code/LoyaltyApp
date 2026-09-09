import { useCallback, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router";
import { type SignInInput, signInSchema } from "@shared/auth";
import { BRAND } from "@shared/branding";
import { ROLE_HOME } from "@shared/roles";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthLayout, FormError } from "@/features/auth/AuthLayout";
import { TurnstileWidget } from "@/features/auth/TurnstileWidget";
import { useSignIn } from "@/features/auth/useSession";

export function LoginPage() {
	const [showPassword, setShowPassword] = useState(false);
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
	const [turnstileResetKey, setTurnstileResetKey] = useState(0);
	const [turnstileMessage, setTurnstileMessage] = useState<string | null>(null);
	const navigate = useNavigate();
	const location = useLocation();
	const signIn = useSignIn();
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
	} = useForm<SignInInput>({ resolver: zodResolver(signInSchema) });

	const from = (location.state as { from?: { pathname: string } } | null)?.from
		?.pathname;

	const onSubmit = handleSubmit((values) => {
		if (turnstileMisconfigured) {
			setTurnstileMessage(
				`Sign-in verification is not configured. Please contact support at ${BRAND.support.email}.`,
			);
			return;
		}

		if (turnstileEnabled && !turnstileToken) {
			setTurnstileMessage("Complete the bot check and try again.");
			return;
		}

		const token = turnstileEnabled ? turnstileToken ?? undefined : undefined;
		setTurnstileMessage(null);
		signIn.mutate({ ...values, turnstileToken: token }, {
			onSuccess: (user) => {
				void navigate(from ?? ROLE_HOME[user.role], { replace: true });
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
			title="Sign in"
			subtitle={`Welcome back to ${BRAND.rewardsName}.`}
			footer={
				<>
					New here?{" "}
					<Link to="/register" className="text-brand-secondary underline">
						Create an account
					</Link>
				</>
			}
		>
			<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
				{turnstileMisconfigured && (
					<FormError
						message={`Sign-in verification is unavailable. Please contact support at ${BRAND.support.email}.`}
					/>
				)}
				{signIn.isError && <FormError message={signIn.error.message} />}

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
					autoComplete="current-password"
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

				<Link
					to="/forgot-password"
					className="self-end text-sm text-brand-secondary underline"
				>
					Forgot password?
				</Link>

				{turnstileEnabled ? (
					<TurnstileWidget
						siteKey={turnstileSiteKey}
						action="sign-in"
						resetKey={turnstileResetKey}
						onTokenChange={handleTurnstileToken}
						onExpired={handleTurnstileExpired}
					/>
				) : null}

				{turnstileMessage ? <FormError message={turnstileMessage} /> : null}

				<Button
					type="submit"
					loading={signIn.isPending}
					disabled={disableSubmit}
					fullWidth
				>
					Sign in
				</Button>
			</form>
		</AuthLayout>
	);
}
