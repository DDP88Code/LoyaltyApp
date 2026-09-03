import type { ReactNode } from "react";
import { Link } from "react-router";
import { Card } from "@/components/ui/Card";

export function AuthLayout({
	title,
	subtitle,
	children,
	footer,
}: {
	title: string;
	subtitle: string;
	children: ReactNode;
	footer: ReactNode;
}) {
	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
			<div className="text-center">
				<Link
					to="/"
					className="text-sm tracking-[0.3em] text-brand-secondary uppercase"
				>
					Fives Rewards
				</Link>
				<h1 className="mt-2 text-3xl">{title}</h1>
				<p className="mt-2 text-sm text-brand-muted">{subtitle}</p>
			</div>

			<Card>{children}</Card>

			<p className="text-center text-sm text-brand-muted">{footer}</p>
		</main>
	);
}

export function FormError({ message }: { message: string }) {
	return (
		<p
			role="alert"
			className="rounded-xl border border-brand-danger/40 bg-brand-danger/10 px-4 py-3 text-sm text-brand-danger"
		>
			{message}
		</p>
	);
}
