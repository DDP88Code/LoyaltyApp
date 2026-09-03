import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useAdminLookups, useAdminReports } from "@/features/admin/core/api";
import { AdminPanel, AdminStatCard, TinyBars } from "@/features/admin/core/widgets";

function toDateInputValue(value: Date): string {
	return value.toISOString().slice(0, 10);
}

export function AdminReportsPage() {
	const now = new Date();
	const defaultTo = toDateInputValue(now);
	const defaultFrom = toDateInputValue(new Date(now.getTime() - 29 * 86_400_000));
	const [draftFrom, setDraftFrom] = useState(defaultFrom);
	const [draftTo, setDraftTo] = useState(defaultTo);
	const [draftLocationId, setDraftLocationId] = useState("");
	const [query, setQuery] = useState({ from: defaultFrom, to: defaultTo, locationId: "" });

	const lookups = useAdminLookups();
	const reports = useAdminReports({
		from: query.from,
		to: query.to,
		locationId: query.locationId || undefined,
	});

	const charts = useMemo(() => {
		if (!reports.data) {
			return {
				memberSeries: [] as number[],
				coffeeSeries: [] as number[],
				issuedSeries: [] as number[],
				redeemedSeries: [] as number[],
				maxMembers: 0,
				maxCoffee: 0,
				maxRewards: 0,
			};
		}

		const memberSeries = reports.data.newMembersOverTime.map((point) => point.value);
		const coffeeSeries = reports.data.coffeePurchasesOverTime.map((point) => point.value);
		const issuedSeries = reports.data.rewardsIssuedOverTime.map((point) => point.value);
		const redeemedSeries = reports.data.rewardsRedeemedOverTime.map((point) => point.value);

		return {
			memberSeries,
			coffeeSeries,
			issuedSeries,
			redeemedSeries,
			maxMembers: Math.max(0, ...memberSeries),
			maxCoffee: Math.max(0, ...coffeeSeries),
			maxRewards: Math.max(0, ...issuedSeries, ...redeemedSeries),
		};
	}, [reports.data]);

	if (reports.isPending || lookups.isPending) return <LoadingState label="Loading reports..." />;
	if (reports.isError) {
		return (
			<main className="p-6">
				<ErrorState
					title="Could not load reports"
					description={reports.error.message}
					onRetry={() => void reports.refetch()}
				/>
			</main>
		);
	}
	if (lookups.isError) {
		return (
			<main className="p-6">
				<ErrorState
					title="Could not load report filters"
					description={lookups.error.message}
					onRetry={() => void lookups.refetch()}
				/>
			</main>
		);
	}

	const metrics = reports.data.metrics;

	return (
		<main className="mx-auto w-full max-w-7xl p-6">
			<PageHeader
				title="Reports"
				subtitle="Live member, loyalty, reward, and staff performance analysis."
			/>

			<AdminPanel title="Filters" description="Analyze by date range and location.">
				<div className="grid gap-3 md:grid-cols-4">
					<Input label="From" type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} />
					<Input label="To" type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} />
					<div className="grid gap-1">
						<label htmlFor="reportLocation" className="text-sm font-medium">Location</label>
						<select
							id="reportLocation"
							value={draftLocationId}
							onChange={(event) => setDraftLocationId(event.target.value)}
							className="min-h-12 rounded-xl border border-brand-border bg-brand-surface px-3"
						>
							<option value="">All locations</option>
							{lookups.data.locations.map((location) => (
								<option key={location.id} value={location.id}>{location.name}</option>
							))}
						</select>
					</div>
					<div className="flex items-end">
						<Button
							onClick={() =>
								setQuery({
									from: draftFrom,
									to: draftTo,
									locationId: draftLocationId,
								})
							}
						>
							Apply
						</Button>
					</div>
				</div>
			</AdminPanel>

			<section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<AdminStatCard title="Members" value={String(metrics.totalMembers)} subtitle={`+${metrics.newMembersInRange} in range`} />
				<AdminStatCard title="Coffee Transactions" value={String(metrics.coffeeTransactions)} subtitle={`${metrics.coffeesPurchased} coffees logged`} />
				<AdminStatCard title="Rewards" value={String(metrics.rewardsIssued)} subtitle={`${metrics.rewardsRedeemed} redeemed`} />
				<AdminStatCard title="Redemption Rate" value={`${metrics.redemptionRatePercent.toFixed(2)}%`} subtitle={`${metrics.outstandingRewards} outstanding`} />
			</section>

			<section className="mt-6 grid gap-4 xl:grid-cols-2">
				<AdminPanel title="New Members Over Time" description="Customer signups by day.">
					<TinyBars points={charts.memberSeries} max={charts.maxMembers} />
				</AdminPanel>
				<AdminPanel title="Coffee Purchases Over Time" description="Earn-transaction quantities per day.">
					<TinyBars points={charts.coffeeSeries} max={charts.maxCoffee} colorClass="bg-brand-secondary/40" />
				</AdminPanel>
				<AdminPanel title="Rewards Issued Over Time" description="All rewards issued in range.">
					<TinyBars points={charts.issuedSeries} max={charts.maxRewards} colorClass="bg-brand-primary/45" />
				</AdminPanel>
				<AdminPanel title="Rewards Redeemed Over Time" description="Redeemed rewards in range.">
					<TinyBars points={charts.redeemedSeries} max={charts.maxRewards} colorClass="bg-brand-success/45" />
				</AdminPanel>
			</section>

			<AdminPanel title="Staff Activity" description="Transaction activity by staff member in selected range.">
				{reports.data.staffActivity.length === 0 ? (
					<p className="text-sm text-brand-muted">No staff activity in this range.</p>
				) : (
					<div className="overflow-x-auto">
						<table className="min-w-full text-sm">
							<thead>
								<tr className="border-b border-brand-border text-left text-brand-muted">
									<th className="px-2 py-2 font-medium">Staff</th>
									<th className="px-2 py-2 font-medium">Role</th>
									<th className="px-2 py-2 font-medium">Total Tx</th>
									<th className="px-2 py-2 font-medium">Earn Tx</th>
									<th className="px-2 py-2 font-medium">Coffees Added</th>
									<th className="px-2 py-2 font-medium">Redeems</th>
									<th className="px-2 py-2 font-medium">Adjustments</th>
									<th className="px-2 py-2 font-medium">Reversals</th>
								</tr>
							</thead>
							<tbody>
								{reports.data.staffActivity.map((row) => (
									<tr key={row.staffId} className="border-b border-brand-border/50">
										<td className="px-2 py-2">{row.staffName}</td>
										<td className="px-2 py-2 capitalize">{row.staffRole}</td>
										<td className="px-2 py-2">{row.totalTransactions}</td>
										<td className="px-2 py-2">{row.earnTransactions}</td>
										<td className="px-2 py-2">{row.coffeesAdded}</td>
										<td className="px-2 py-2">{row.redeemTransactions}</td>
										<td className="px-2 py-2">{row.adjustmentTransactions}</td>
										<td className="px-2 py-2">{row.reversalTransactions}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</AdminPanel>
		</main>
	);
}
