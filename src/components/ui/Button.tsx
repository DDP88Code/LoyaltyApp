import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
	primary:
		"bg-brand-primary text-brand-on-primary hover:bg-brand-primary-strong",
	secondary: "bg-brand-secondary text-brand-on-primary hover:brightness-95",
	outline:
		"border border-brand-border bg-transparent text-brand-text hover:bg-brand-surface-raised",
	ghost: "bg-transparent text-brand-text hover:bg-brand-surface-raised",
	danger: "bg-brand-danger text-white hover:brightness-95",
};

const SIZES: Record<Size, string> = {
	sm: "min-h-10 px-3 text-sm",
	md: "min-h-12 px-5 text-base",
	lg: "min-h-14 px-6 text-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: Variant;
	size?: Size;
	loading?: boolean;
	fullWidth?: boolean;
	leadingIcon?: ReactNode;
}

export function Button({
	variant = "primary",
	size = "md",
	loading = false,
	fullWidth = false,
	leadingIcon,
	className,
	children,
	disabled,
	...props
}: ButtonProps) {
	return (
		<button
			{...props}
			disabled={disabled || loading}
			aria-busy={loading || undefined}
			className={cn(
				"inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors",
				"disabled:cursor-not-allowed disabled:opacity-50",
				VARIANTS[variant],
				SIZES[size],
				fullWidth && "w-full",
				className,
			)}
		>
			{loading ? (
				<Loader2 className="size-4 animate-spin" aria-hidden />
			) : (
				leadingIcon
			)}
			{children}
		</button>
	);
}
