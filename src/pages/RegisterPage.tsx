import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { PASSWORD_MIN_LENGTH, type RegisterInput, registerSchema } from "@shared/auth";
import { ROLE_HOME } from "@shared/roles";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthLayout, FormError } from "@/features/auth/AuthLayout";
import { useRegister } from "@/features/auth/useSession";

export function RegisterPage() {
	const [showPassword, setShowPassword] = useState(false);
	const navigate = useNavigate();
	const registerAccount = useRegister();

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

	const onSubmit = handleSubmit((values) => {
		registerAccount.mutate(values, {
			onSuccess: (user) => {
				void navigate(ROLE_HOME[user.role], { replace: true });
			},
		});
	});

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

				<Button type="submit" loading={registerAccount.isPending} fullWidth>
					Create account
				</Button>
			</form>
		</AuthLayout>
	);
}
