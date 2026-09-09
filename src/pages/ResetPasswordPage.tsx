import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";
import { type ResetPasswordInput, resetPasswordSchema } from "@shared/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthLayout, FormError } from "@/features/auth/AuthLayout";
import { useResetPassword } from "@/features/auth/useSession";

export function ResetPasswordPage() {
	const [searchParams] = useSearchParams();
	const token = searchParams.get("token") ?? "";
	const navigate = useNavigate();
	const resetPassword = useResetPassword();
	const [success, setSuccess] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

	const onSubmit = handleSubmit((values) => {
		resetPassword.mutate(
			{ newPassword: values.newPassword, token },
			{ onSuccess: () => setSuccess(true) },
		);
	});

	if (!token) {
		return (
			<AuthLayout
				title="Reset password"
				subtitle="This reset link is invalid or has expired."
				footer={
					<Link to="/forgot-password" className="text-brand-secondary underline">
						Request a new link
					</Link>
				}
			>
				<FormError message="This password reset link is invalid or has expired." />
			</AuthLayout>
		);
	}

	if (success) {
		return (
			<AuthLayout
				title="Password changed"
				subtitle="You can now sign in with your new password."
				footer={null}
			>
				<Button fullWidth onClick={() => void navigate("/login", { replace: true })}>
					Go to sign in
				</Button>
			</AuthLayout>
		);
	}

	return (
		<AuthLayout
			title="Reset password"
			subtitle="Choose a new password for your account."
			footer={
				<Link to="/login" className="text-brand-secondary underline">
					Back to sign in
				</Link>
			}
		>
			<form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
				{resetPassword.isError && <FormError message={resetPassword.error.message} />}

				<Input
					label="New password"
					type={showNewPassword ? "text" : "password"}
					autoComplete="new-password"
					error={errors.newPassword?.message}
					trailingControl={
						<button
							type="button"
							onClick={() => setShowNewPassword((current) => !current)}
							aria-label={showNewPassword ? "Hide password" : "Show password"}
							aria-pressed={showNewPassword}
							className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-muted transition-colors hover:text-brand-text"
						>
							{showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
						</button>
					}
					{...register("newPassword")}
				/>
				<Input
					label="Confirm new password"
					type={showConfirmNewPassword ? "text" : "password"}
					autoComplete="new-password"
					error={errors.confirmNewPassword?.message}
					trailingControl={
						<button
							type="button"
							onClick={() =>
								setShowConfirmNewPassword((current) => !current)
							}
							aria-label={showConfirmNewPassword ? "Hide password" : "Show password"}
							aria-pressed={showConfirmNewPassword}
							className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-muted transition-colors hover:text-brand-text"
						>
							{showConfirmNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
						</button>
					}
					{...register("confirmNewPassword")}
				/>

				<Button type="submit" loading={resetPassword.isPending} fullWidth>
					Reset password
				</Button>
			</form>
		</AuthLayout>
	);
}
