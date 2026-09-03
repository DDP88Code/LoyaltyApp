import { useState } from "react";
import type { RewardSummary } from "@shared/loyalty";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useCustomerRewards, useCustomerTransactions } from "@/features/customer/api";
import { CoffeeStampGrid } from "@/features/customer/CoffeeStampGrid";
import { RewardCard } from "@/features/customer/RewardCard";
import { cn } from "@/lib/cn";

const TABS = ["coffee", "available", "redeemed", "expired", "history"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
	coffee: "Coffee Rewards",
	available: "Available",
	redeemed: "Redeemed",
	expired: "Expired",
	history: "History",
};

export function RewardsPage() {
	const [tab, setTab] = useState<Tab>("coffee");
	const rewards = useCustomerRewards();

	return (
		<div className="p-5">
			<PageHeader title="Rewards" />

			<div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist">
				{TABS.map((value) => (
					<button
						key={value}
						type="button"
						role="tab"
						aria-selected={tab === value}
						onClick={() => setTab(value)}
						className={cn(
							"shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
							tab === value
								? "border-brand-primary bg-brand-primary/15 text-brand-primary"
								: "border-brand-border text-brand-muted",
						)}
					>
						{TAB_LABEL[value]}
					</button>
				))}
			</div>

			{rewards.isPending && <LoadingState label="Loading your rewards…" />}
			{rewards.isError && (
				<ErrorState
					description={rewards.error.message}
					onRetry={() => void rewards.refetch()}
				/>
			)}

			{rewards.data && tab === "coffee" && (
				<div className="flex flex-col gap-3">
					{rewards.data.coffee ? (
						<CoffeeStampGrid coffee={rewards.data.coffee} />
					) : (
						<EmptyState
							title="No coffee program yet"
							description="Ask a member of staff to find out how to start collecting."
						/>
					)}
					{rewards.data.pointsEnabled && (
						<p className="text-sm text-brand-muted">Points are coming soon.</p>
					)}
				</div>
			)}

			{rewards.data && tab !== "coffee" && tab !== "history" && (
				<RewardList rewards={rewards.data[tab]} />
			)}

			{rewards.data && tab === "history" && <TransactionHistory />}
		</div>
	);
}

function RewardList({ rewards }: { rewards: RewardSummary[] }) {
	if (rewards.length === 0) {
		return <EmptyState title="Nothing here yet" />;
	}

	return (
		<div className="flex flex-col gap-2">
			{rewards.map((reward) => (
				<RewardCard key={reward.id} reward={reward} />
			))}
		</div>
	);
}

const PAGE_SIZE = 20;

function TransactionHistory() {
	const [offset, setOffset] = useState(0);
	const transactions = useCustomerTransactions({ limit: PAGE_SIZE, offset });

	if (transactions.isPending) return <LoadingState label="Loading history…" />;
	if (transactions.isError) {
		return (
			<ErrorState
				description={transactions.error.message}
				onRetry={() => void transactions.refetch()}
			/>
		);
	}

	const { transactions: rows, total } = transactions.data;

	if (rows.length === 0) {
		return (
			<EmptyState
				title="No activity yet"
				description="Coffees you earn and rewards you redeem will show up here."
			/>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<ul className="flex flex-col gap-2">
				{rows.map((row) => (
					<li
						key={row.id}
						className="flex items-center justify-between rounded-xl border border-brand-border px-4 py-3"
					>
						<div>
							<p className="text-sm font-medium capitalize">
								{row.transactionType}
								{row.programName ? ` · ${row.programName}` : ""}
							</p>
							<p className="text-xs text-brand-muted">
								{new Date(row.createdAt).toLocaleString("en-ZA")}
							</p>
						</div>
						<p className={cn("font-semibold", row.quantity < 0 && "text-brand-danger")}>
							{row.quantity > 0 ? "+" : ""}
							{row.quantity}
						</p>
					</li>
				))}
			</ul>

			{total > PAGE_SIZE && (
				<div className="flex items-center justify-between text-sm">
					<button
						type="button"
						disabled={offset === 0}
						onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
						className="text-brand-secondary underline disabled:opacity-40"
					>
						Newer
					</button>
					<button
						type="button"
						disabled={offset + PAGE_SIZE >= total}
						onClick={() => setOffset((value) => value + PAGE_SIZE)}
						className="text-brand-secondary underline disabled:opacity-40"
					>
						Older
					</button>
				</div>
			)}
		</div>
	);
}
