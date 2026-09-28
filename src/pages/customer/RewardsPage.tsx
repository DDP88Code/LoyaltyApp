import { useEffect, useRef, useState } from "react";
import type { RewardSummary } from "@shared/loyalty";
import type { CustomerPointsPayload } from "@shared/rewardPoints";
import { useSearchParams } from "react-router";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import {
	useRedeemCustomerPoints,
	useCustomerRewards,
	useCustomerTransactions,
} from "@/features/customer/api";
import { CoffeeStampGrid } from "@/features/customer/CoffeeStampGrid";
import { RewardCard } from "@/features/customer/RewardCard";
import { ApiClientError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/money";

const TABS = ["coffee", "points", "available", "redeemed", "expired", "history"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
	coffee: "Coffee Rewards",
	points: "Points",
	available: "Available",
	redeemed: "Redeemed",
	expired: "Expired",
	history: "History",
};

function newIdempotencyKey() {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

interface ClaimIntent {
	catalogueItemId: string;
	rewardName: string;
	pointsCost: number;
	availableBalance: number;
	programName: string;
}

interface ClaimTarget extends ClaimIntent {
	requestIdempotencyKey: string;
}

interface ClaimSuccessMessage {
	title: string;
	description: string;
	note: string | null;
}

function formatClaimError(cause: unknown, target: ClaimTarget | null): string {
	if (cause instanceof ApiClientError) {
		if (
			cause.code === "validation_failed" &&
			/you do not have enough points/i.test(cause.message)
		) {
			if (target && target.availableBalance >= target.pointsCost) {
				return `This reward cost or your balance changed. You no longer have enough ${target.programName} to claim it.`;
			}
			return cause.message;
		}
		return cause.message;
	}

	if (cause instanceof Error) {
		return cause.message;
	}

	return "Could not claim reward right now. Please try again.";
}

export function RewardsPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const requestedTab = searchParams.get("tab");
	const rewards = useCustomerRewards();
	const redeemPoints = useRedeemCustomerPoints();
	const [claimTarget, setClaimTarget] = useState<ClaimTarget | null>(null);
	const [claimError, setClaimError] = useState<string | null>(null);
	const [claimSuccessMessage, setClaimSuccessMessage] =
		useState<ClaimSuccessMessage | null>(null);
	const claimInFlightRef = useRef(false);
	const pointsTabKnownDisabled = rewards.data?.pointsEnabled === false;

	const visibleTabs: Tab[] = pointsTabKnownDisabled
		? TABS.filter((value) => value !== "points")
		: [...TABS];
	const fallbackTab = visibleTabs[0] ?? "coffee";
	const tab: Tab = isVisibleTab(requestedTab, visibleTabs) ? requestedTab : fallbackTab;

	useEffect(() => {
		if (requestedTab === "points" && !pointsTabKnownDisabled) return;
		if (isVisibleTab(requestedTab, visibleTabs)) return;
		const next = new URLSearchParams(searchParams);
		next.set("tab", fallbackTab);
		setSearchParams(next, { replace: true });
	}, [fallbackTab, pointsTabKnownDisabled, requestedTab, searchParams, setSearchParams, visibleTabs]);

	const setTab = (nextTab: Tab) => {
		const next = new URLSearchParams(searchParams);
		next.set("tab", nextTab);
		setSearchParams(next);
	};

	useEffect(() => {
		if (!claimSuccessMessage) return;
		const timeout = window.setTimeout(() => {
			setClaimSuccessMessage(null);
		}, 8000);
		return () => window.clearTimeout(timeout);
	}, [claimSuccessMessage]);

	function startClaim(intent: ClaimIntent) {
		redeemPoints.reset();
		setClaimError(null);
		setClaimTarget({
			...intent,
			requestIdempotencyKey: newIdempotencyKey(),
		});
	}

	async function confirmClaim() {
		if (!claimTarget || claimInFlightRef.current) return;
		claimInFlightRef.current = true;
		setClaimError(null);

		try {
			const result = await redeemPoints.mutateAsync({
				catalogueItemId: claimTarget.catalogueItemId,
				requestIdempotencyKey: claimTarget.requestIdempotencyKey,
			});

			const costChanged = result.pointsCost !== claimTarget.pointsCost;
			setClaimSuccessMessage({
				title: "Reward added",
				description: `${result.catalogueItemName} is ready to use. Show your Fives QR to a staff member when you want to use it.`,
				note: costChanged
					? `Points cost updated to ${result.pointsCost.toLocaleString("en-ZA")} ${result.summary.programName}. Your balance now reflects the latest cost.`
					: null,
			});

			setClaimTarget(null);
			setTab("available");
		} catch (cause) {
			setClaimError(formatClaimError(cause, claimTarget));
			setClaimTarget(null);
		} finally {
			claimInFlightRef.current = false;
		}
	}

	return (
		<div className="p-5">
			<PageHeader title="Rewards" />

			<div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist">
				{visibleTabs.map((value) => (
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

			{claimSuccessMessage && (
				<div
					role="status"
					aria-live="polite"
					className="mb-4 rounded-xl border border-brand-success/40 bg-brand-success/10 px-4 py-3"
				>
					<div className="flex items-start justify-between gap-3">
						<div className="space-y-1">
							<p className="text-sm font-semibold text-brand-success">
								{claimSuccessMessage.title}
							</p>
							<p className="text-sm text-brand-text">{claimSuccessMessage.description}</p>
							{claimSuccessMessage.note && (
								<p className="text-xs text-brand-muted">{claimSuccessMessage.note}</p>
							)}
						</div>
						<button
							type="button"
							onClick={() => setClaimSuccessMessage(null)}
							className="text-xs font-medium text-brand-muted underline"
						>
							Dismiss
						</button>
					</div>
				</div>
			)}

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

			{rewards.data && tab === "points" && rewards.data.points && (
				<PointsPanel
					points={rewards.data.points}
					loading={redeemPoints.isPending}
					error={claimError ?? redeemPoints.error?.message ?? null}
					onClaim={startClaim}
				/>
			)}

			{rewards.data && tab !== "coffee" && tab !== "points" && tab !== "history" && (
				<RewardList rewards={rewards.data[tab]} />
			)}

			{rewards.data && tab === "history" && <TransactionHistory />}

			<ConfirmDialog
				open={Boolean(claimTarget)}
				title={
					claimTarget ? `Claim ${claimTarget.rewardName}?` : "Claim reward?"
				}
				confirmLabel="Claim reward"
				cancelLabel="Cancel"
				loading={redeemPoints.isPending}
				onConfirm={() => void confirmClaim()}
				onCancel={() => {
					if (redeemPoints.isPending) return;
					setClaimTarget(null);
				}}
			>
				{claimTarget && (
					<div className="space-y-3 text-sm">
						<p className="text-brand-muted">
							This will use {claimTarget.pointsCost.toLocaleString("en-ZA")} {claimTarget.programName} and add the reward to your Available Rewards.
						</p>
						<div className="rounded-lg border border-brand-border bg-brand-surface-raised px-3 py-2 text-xs text-brand-muted">
							<p>
								Current balance: {claimTarget.availableBalance.toLocaleString("en-ZA")}
							</p>
							<p>
								Balance after: {Math.max(0, claimTarget.availableBalance - claimTarget.pointsCost).toLocaleString("en-ZA")}
							</p>
						</div>
					</div>
				)}
			</ConfirmDialog>
		</div>
	);
}

function isVisibleTab(value: string | null, visibleTabs: readonly Tab[]): value is Tab {
	return value !== null && (visibleTabs as readonly string[]).includes(value);
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

function PointsPanel({
	points,
	loading,
	error,
	onClaim,
}: {
	points: CustomerPointsPayload;
	loading: boolean;
	error: string | null;
	onClaim: (intent: ClaimIntent) => void;
}) {
	const summary = points.summary;

	return (
		<div className="flex flex-col gap-3">
			<div className="rounded-xl border border-brand-border bg-brand-surface p-4">
				<p className="text-xs tracking-[0.2em] text-brand-secondary uppercase">
					{summary.programName}
				</p>
				<p className="mt-1 text-lg font-semibold">
					{summary.availableBalance.toLocaleString("en-ZA")} points available
				</p>
				{summary.inRecovery && (
					<p className="mt-2 text-sm text-brand-warning">
						{summary.recoveryPoints.toLocaleString("en-ZA")} points need to be recovered before you can claim rewards.
						 Points you earn from here will go towards this first.
					</p>
				)}
			</div>

			<div className="rounded-xl border border-brand-border bg-brand-surface p-4">
				<p className="text-sm font-semibold">Catalogue</p>
				{points.catalogue.length === 0 ? (
					<p className="mt-2 text-sm text-brand-muted">No points rewards available yet.</p>
				) : (
					<div className="mt-3 flex flex-col gap-2">
						{points.catalogue.map((item) => {
							const missingPoints = Math.max(
								0,
								item.pointsCost - summary.availableBalance,
							);
							const disabled =
								loading ||
								summary.inRecovery ||
								summary.availableBalance < item.pointsCost;
							const reason = summary.inRecovery
								? "Unavailable during recovery"
								: missingPoints > 0
									? `${missingPoints.toLocaleString("en-ZA")} more points needed`
									: null;

							return (
								<div
									key={item.id}
									className="flex items-center justify-between gap-3 rounded-lg border border-brand-border px-3 py-3"
								>
									<div className="min-w-0">
										<p className="truncate font-medium">{item.name}</p>
										<p className="text-xs text-brand-muted">
											{item.pointsCost.toLocaleString("en-ZA")} points
											{item.valueCents != null ? ` • ${formatCents(item.valueCents)}` : ""}
										</p>
										{reason && <p className="text-xs text-brand-warning">{reason}</p>}
									</div>
									<Button
										size="sm"
										disabled={disabled}
										onClick={() =>
											onClaim({
												catalogueItemId: item.id,
												rewardName: item.name,
												pointsCost: item.pointsCost,
												availableBalance: summary.availableBalance,
												programName: summary.programName,
											})
										}
									>
										Claim
									</Button>
								</div>
							);
						})}
					</div>
				)}
				{error && <p className="mt-2 text-sm text-brand-danger">{error}</p>}
			</div>

			<div className="rounded-xl border border-brand-border bg-brand-surface p-4">
				<p className="text-sm font-semibold">Points History</p>
				{points.history.length === 0 ? (
					<p className="mt-2 text-sm text-brand-muted">No points activity yet.</p>
				) : (
					<ul className="mt-3 flex flex-col gap-2">
						{points.history.map((entry) => {
							const claimedLabel =
								entry.label.toLowerCase() === "redeemed"
									? "Claimed reward"
									: `Claimed ${entry.label}`;

							return (
								<li
									key={entry.id}
									className="flex items-center justify-between gap-2 rounded-lg border border-brand-border px-3 py-2"
								>
									<div>
										<p className="text-sm font-medium">
											{entry.transactionType === "redeem"
												? claimedLabel
												: entry.label}
										</p>
										<p className="text-xs text-brand-muted">
											{new Date(entry.createdAt).toLocaleString("en-ZA")}
											{entry.transactionType === "redeem"
												? ` • ${Math.abs(entry.quantity).toLocaleString("en-ZA")} points used`
												: entry.detail
													? ` • ${entry.detail}`
													: ""}
										</p>
									</div>
									<p className={cn("font-semibold", entry.quantity < 0 && "text-brand-danger")}>
										{entry.quantity > 0 ? "+" : ""}
										{entry.quantity}
									</p>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}

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
