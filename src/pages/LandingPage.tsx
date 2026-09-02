import { Link } from "react-router";
import { Coffee, ShieldCheck, Store } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useHealth } from "@/features/system/useHealth";

const ENTRY_POINTS = [
	{ to: "/app", label: "Customer app", icon: Coffee },
	{ to: "/staff", label: "Staff", icon: Store },
	{ to: "/admin", label: "Admin", icon: ShieldCheck },
];

export function LandingPage() {
	const health = useHealth();

	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
			<div className="text-center">
				<p className="text-sm tracking-[0.3em] text-brand-secondary uppercase">
					Fives Pub &amp; Grill
				</p>
				<h1 className="mt-2 text-4xl">Fives Rewards</h1>
				<p className="mt-2 text-sm text-brand-muted">
					Ten coffees. One on the house.
				</p>
			</div>

			<Card>
				<CardTitle>API status</CardTitle>
				<CardDescription>
					Confirms the React app can reach the Cloudflare Worker.
				</CardDescription>
				<div className="mt-4">
					{health.isPending && <LoadingState label="Checking API…" />}
					{health.isError && (
						<ErrorState
							description={health.error.message}
							onRetry={() => void health.refetch()}
						/>
					)}
					{health.data && (
						<dl className="space-y-2 text-sm">
							<div className="flex items-center justify-between">
								<dt className="text-brand-muted">Status</dt>
								<dd>
									<Badge tone="success">{health.data.status}</Badge>
								</dd>
							</div>
							<div className="flex items-center justify-between">
								<dt className="text-brand-muted">Environment</dt>
								<dd>{health.data.environment}</dd>
							</div>
						</dl>
					)}
				</div>
			</Card>

			<nav className="grid gap-3">
				{ENTRY_POINTS.map(({ to, label, icon: Icon }) => (
					<Link
						key={to}
						to={to}
						className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand-border font-semibold transition-colors hover:bg-brand-surface-raised"
					>
						<Icon className="size-4" aria-hidden />
						{label}
					</Link>
				))}
			</nav>
		</main>
	);
}
