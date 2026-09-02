import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Card({
	className,
	...props
}: HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			{...props}
			className={cn(
				"rounded-card border border-brand-border bg-brand-surface p-5 shadow-lg shadow-black/30",
				className,
			)}
		/>
	);
}

export function CardTitle({
	className,
	...props
}: HTMLAttributes<HTMLHeadingElement>) {
	return <h2 {...props} className={cn("text-lg", className)} />;
}

export function CardDescription({
	className,
	...props
}: HTMLAttributes<HTMLParagraphElement>) {
	return (
		<p {...props} className={cn("text-sm text-brand-muted", className)} />
	);
}
