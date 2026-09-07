import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router";
import { type SignInInput, signInSchema } from "@shared/auth";
import { ROLE_HOME } from "@shared/roles";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthLayout, FormError } from "@/features/auth/AuthLayout";
import { useSignIn } from "@/features/auth/useSession";

export function LoginPage() {
	const [showPassword, setShowPassword] = useState(false);
	const navigate = useNavigate();
	const location = useLocation();
	const signIn = useSignIn();

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<SignInInput>({ resolver: zodResolver(signInSchema) });

	const from = (location.state as { from?: { pathname: string } } | null)?.from
		?.pathname;

	const onSubmit = handleSubmit((values) => {
		signIn.mutate(values, {
			onSuccess: (user) => {
				void navigate(from ?? ROLE_HOME[user.role], { replace: true });
			},
		});
	});

	return (
		<AuthLayout
			title="Sign in"
			subtitle="Welcome back to Fives Rewards."
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

				<Button type="submit" loading={signIn.isPending} fullWidth>
					Sign in
				</Button>
			</form>
		</AuthLayout>
	);
}
