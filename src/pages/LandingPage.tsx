import { Link } from "react-router";
import { Badge } from "@/components/ui/Badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useSession } from "@/features/auth/useSession";
import { useHealth } from "@/features/system/useHealth";
import { ROLE_HOME } from "@shared/roles";

export function LandingPage() {
	const health = useHealth();
	const { data: user } = useSession();

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
				{user ? (
					<Link
						to={ROLE_HOME[user.role]}
						className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-primary font-semibold text-brand-on-primary"
					>
						Continue as {user.fullName}
					</Link>
				) : (
					<>
						<Link
							to="/login"
							className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-primary font-semibold text-brand-on-primary"
						>
							Sign in
						</Link>
						<Link
							to="/register"
							className="inline-flex min-h-12 items-center justify-center rounded-xl border border-brand-border font-semibold transition-colors hover:bg-brand-surface-raised"
						>
							Create an account
						</Link>
					</>
				)}
			</nav>
		</main>
	);
}
