import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useAdminDashboard } from "@/features/admin/core/api";
import { AdminPanel, AdminStatCard, TinyBars } from "@/features/admin/core/widgets";

export function AdminDashboardPage() {
	const [days, setDays] = useState(30);
	const dashboard = useAdminDashboard(days);

	if (dashboard.isPending) {
		return <LoadingState label="Loading dashboard..." />;
	}
	if (dashboard.isError) {
		return (
			<main className="p-6">
				<ErrorState
					title="Could not load dashboard"
					description={dashboard.error.message}
					onRetry={() => void dashboard.refetch()}
				/>
			</main>
		);
	}

	const data = dashboard.data;
	const metrics = data.metrics;
	const memberSeries = data.newMembersOverTime.map((point) => point.value);
	const coffeeSeries = data.coffeePurchasesOverTime.map((point) => point.value);
	const issuedSeries = data.rewardsEarnedVsRedeemed.map((point) => point.issued);
	const redeemedSeries = data.rewardsEarnedVsRedeemed.map((point) => point.redeemed);

	const maxMembers = Math.max(0, ...memberSeries);
	const maxCoffee = Math.max(0, ...coffeeSeries);
	const maxRewards = Math.max(0, ...issuedSeries, ...redeemedSeries);

	return (
		<main className="mx-auto w-full max-w-7xl p-6">
			<PageHeader
				title="Admin Dashboard"
				subtitle="Loyalty health across members, coffee activity, and rewards."
				actions={
					<div className="flex items-center gap-2 text-sm">
						<label htmlFor="window" className="text-brand-muted">
							Window
						</label>
						<select
							id="window"
							value={days}
							onChange={(event) => setDays(Number(event.target.value))}
							className="rounded-lg border border-brand-border bg-brand-surface px-2 py-1"
						>
							<option value={14}>14d</option>
							<option value={30}>30d</option>
							<option value={60}>60d</option>
							<option value={90}>90d</option>
						</select>
					</div>
				}
			/>

			<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<AdminStatCard title="Total Members" value={String(metrics.totalMembers)} />
				<AdminStatCard title="Active Members" value={String(metrics.activeMembers)} />
				<AdminStatCard
					title="New Members This Month"
					value={String(metrics.newMembersThisMonth)}
				/>
				<AdminStatCard title="Coffees Purchased" value={String(metrics.coffeesPurchased)} />
				<AdminStatCard
					title="Free Coffees Issued"
					value={String(metrics.freeCoffeesIssued)}
				/>
				<AdminStatCard
					title="Free Coffees Redeemed"
					value={String(metrics.freeCoffeesRedeemed)}
				/>
				<AdminStatCard
					title="Outstanding Rewards"
					value={String(metrics.outstandingRewards)}
				/>
				<AdminStatCard
					title="Redemption Rate"
					value={`${metrics.redemptionRatePercent.toFixed(2)}%`}
				/>
			</section>

			<section className="mt-6 grid gap-4 xl:grid-cols-3">
				<AdminPanel title="New Members Over Time" description={`Last ${days} days`}>
					<TinyBars points={memberSeries} max={maxMembers} />
				</AdminPanel>
				<AdminPanel title="Coffee Purchases Over Time" description={`Last ${days} days`}>
					<TinyBars points={coffeeSeries} max={maxCoffee} colorClass="bg-brand-secondary/40" />
				</AdminPanel>
				<AdminPanel title="Rewards Earned vs Redeemed" description={`Last ${days} days`}>
					<div className="grid gap-2">
						<TinyBars points={issuedSeries} max={maxRewards} colorClass="bg-brand-primary/45" />
						<TinyBars points={redeemedSeries} max={maxRewards} colorClass="bg-brand-success/45" />
						<p className="text-xs text-brand-muted">
							Top: issued, bottom: redeemed.
						</p>
					</div>
				</AdminPanel>
			</section>

			<section className="mt-4">
				<AdminPanel title="Metric Definitions" description="Production dashboard scope for member and reward counters.">
					<ul className="grid gap-1 text-sm text-brand-muted">
						<li>Total Members: profiles where role = customer.</li>
						<li>Active Members: profiles where role = customer and active = true.</li>
						<li>New Members This Month: customer profiles created in the current month.</li>
						<li>Outstanding Rewards: customer rewards with status = available.</li>
					</ul>
				</AdminPanel>
			</section>
		</main>
	);
}
