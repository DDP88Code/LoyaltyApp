import type { ReactNode } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

export function AdminStatCard({
	title,
	value,
	subtitle,
}: {
	title: string;
	value: string;
	subtitle?: string;
}) {
	return (
		<Card className="p-4">
			<p className="text-xs text-brand-muted uppercase tracking-wide">{title}</p>
			<p className="mt-1 text-2xl font-semibold">{value}</p>
			{subtitle && <p className="mt-1 text-xs text-brand-muted">{subtitle}</p>}
		</Card>
	);
}

export function AdminPanel({
	title,
	description,
	children,
	className,
}: {
	title: string;
	description?: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<Card className={cn("p-4", className)}>
			<CardTitle>{title}</CardTitle>
			{description && <CardDescription className="mt-1">{description}</CardDescription>}
			<div className="mt-4">{children}</div>
		</Card>
	);
}

export function TinyBars({
	points,
	max,
	colorClass,
}: {
	points: number[];
	max: number;
	colorClass?: string;
}) {
	return (
		<div className="flex h-24 items-end gap-1">
			{points.map((value, index) => {
				const height = max > 0 ? Math.max(4, Math.round((value / max) * 90)) : 4;
				return (
					<div
						key={`${index}-${value}`}
						className={cn(
							"min-w-0 flex-1 rounded-sm bg-brand-primary/35",
							colorClass,
						)}
						style={{ height }}
					/>
				);
			})}
		</div>
	);
}
