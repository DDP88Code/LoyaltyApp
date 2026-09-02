import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { Button } from "./Button";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
	return (
		<div
			role="status"
			className="flex flex-col items-center gap-3 py-12 text-brand-muted"
		>
			<Loader2 className="size-6 animate-spin" aria-hidden />
			<p className="text-sm">{label}</p>
		</div>
	);
}

export function EmptyState({
	title,
	description,
	icon,
	action,
}: {
	title: string;
	description?: string;
	icon?: ReactNode;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-col items-center gap-3 py-12 text-center">
			<div className="text-brand-muted" aria-hidden>
				{icon ?? <Inbox className="size-8" />}
			</div>
			<h2 className="text-base">{title}</h2>
			{description && (
				<p className="max-w-sm text-sm text-brand-muted">{description}</p>
			)}
			{action}
		</div>
	);
}

export function ErrorState({
	title = "Something went wrong",
	description,
	onRetry,
}: {
	title?: string;
	description?: string;
	onRetry?: () => void;
}) {
	return (
		<div
			role="alert"
			className="flex flex-col items-center gap-3 py-12 text-center"
		>
			<AlertTriangle className="size-8 text-brand-danger" aria-hidden />
			<h2 className="text-base">{title}</h2>
			{description && (
				<p className="max-w-sm text-sm text-brand-muted">{description}</p>
			)}
			{onRetry && (
				<Button variant="outline" size="sm" onClick={onRetry}>
					Try again
				</Button>
			)}
		</div>
	);
}
