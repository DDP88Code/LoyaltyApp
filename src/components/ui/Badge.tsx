import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "primary" | "success" | "danger";

const TONES: Record<Tone, string> = {
	neutral: "bg-brand-surface-raised text-brand-muted",
	primary: "bg-brand-primary/15 text-brand-secondary",
	success: "bg-brand-success/15 text-brand-success",
	danger: "bg-brand-danger/15 text-brand-danger",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	tone?: Tone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
	return (
		<span
			{...props}
			className={cn(
				"inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
				TONES[tone],
				className,
			)}
		/>
	);
}
