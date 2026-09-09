import { useCallback, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { type ForgotPasswordInput, forgotPasswordSchema } from "@shared/auth";
import { BRAND } from "@shared/branding";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthLayout, FormError } from "@/features/auth/AuthLayout";
import { TurnstileWidget } from "@/features/auth/TurnstileWidget";
import { useRequestPasswordReset } from "@/features/auth/useSession";

export function ForgotPasswordPage() {
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
	const [turnstileResetKey, setTurnstileResetKey] = useState(0);
	const [turnstileMessage, setTurnstileMessage] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(false);
	const requestReset = useRequestPasswordReset();
	const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? "";
	const turnstileEnabled = turnstileSiteKey.length > 0;
	const turnstileMisconfigured = import.meta.env.PROD && !turnstileEnabled;

	const handleTurnstileToken = useCallback((token: string | null) => {
		setTurnstileToken(token);
		if (token) setTurnstileMessage(null);
	}, []);

	const handleTurnstileExpired = useCallback(() => {
		setTurnstileMessage("Verification expired. Please try again.");
	}, []);

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

	const onSubmit = handleSubmit((values) => {
		if (turnstileMisconfigured) {
			setTurnstileMessage(
				`Password reset verification is not configured. Please contact support at ${BRAND.support.email}.`,
			);
			return;
		}

		if (turnstileEnabled && !turnstileToken) {
			setTurnstileMessage("Complete the bot check and try again.");
			return;
		}

		const token = turnstileEnabled ? turnstileToken ?? undefined : undefined;
		setTurnstileMessage(null);
		requestReset.mutate(
			{ email: values.email, turnstileToken: token },
			{
				// Same message whether or not the email exists, by design.
				onSuccess: () => setSubmitted(true),
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
			title="Forgot password"
			subtitle="We'll send you a link to reset it."
			footer={
				<>
					Remembered it?{" "}
					<Link to="/login" className="text-brand-secondary underline">
						Sign in
					</Link>
				</>
			}
		>
			{submitted ? (
				<p className="text-sm text-brand-text">
					If that email exists in our system, check your inbox for a link to
					reset your password.
				</p>
			) : (
				<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
					{turnstileMisconfigured && (
						<FormError
							message={`Password reset verification is unavailable. Please contact support at ${BRAND.support.email}.`}
						/>
					)}
					{requestReset.isError && <FormError message={requestReset.error.message} />}

					<Input
						label="Email"
						type="email"
						autoComplete="email"
						inputMode="email"
						error={errors.email?.message}
						{...register("email")}
					/>

					{turnstileEnabled ? (
						<TurnstileWidget
							siteKey={turnstileSiteKey}
							action="forgot-password"
							resetKey={turnstileResetKey}
							onTokenChange={handleTurnstileToken}
							onExpired={handleTurnstileExpired}
						/>
					) : null}

					{turnstileMessage ? <FormError message={turnstileMessage} /> : null}

					<Button
						type="submit"
						loading={requestReset.isPending}
						disabled={disableSubmit}
						fullWidth
					>
						Send reset link
					</Button>
				</form>
			)}
		</AuthLayout>
	);
}
