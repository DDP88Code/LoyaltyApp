import type { ReactNode } from "react";

export interface PageHeaderProps {
	title: string;
	subtitle?: string;
	actions?: ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
	return (
		<header className="mb-6 flex items-start justify-between gap-4">
			<div>
				<h1 className="text-2xl">{title}</h1>
				{subtitle && <p className="mt-1 text-sm text-brand-muted">{subtitle}</p>}
			</div>
			{actions}
		</header>
	);
}
