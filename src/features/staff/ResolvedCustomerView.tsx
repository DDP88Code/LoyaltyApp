import { useState } from "react";
import { Coffee } from "lucide-react";
import type { CoffeeEarnResultPayload, StaffResolvedCustomerPayload } from "@shared/loyaltyCode";
import type { Role } from "@shared/roles";
import type { RewardSummary } from "@shared/loyalty";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/States";
import { CoffeeStampGrid } from "@/features/customer/CoffeeStampGrid";
import { AddCoffeeDialog } from "@/features/staff/AddCoffeeDialog";
import {
	useAddCoffee,
	useCommitStaffCampaignBill,
	useQuoteStaffCampaignBill,
	useRedeemReward,
} from "@/features/staff/api";
import { RedeemDialog } from "@/features/staff/RedeemDialog";
import { useOnlineStatus } from "@/features/system/useOnlineStatus";

function newIdempotencyKey() {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function ResolvedCustomerView({
	customer,
	locationId,
	onUpdated,
	onDone,
	staffRole,
}: {
	customer: StaffResolvedCustomerPayload;
	locationId: string;
	onUpdated: (payload: StaffResolvedCustomerPayload) => void;
	onDone: () => void;
	staffRole: Role;
}) {
	const isOnline = useOnlineStatus();
	const addCoffee = useAddCoffee();
	const redeemReward = useRedeemReward();
	const quoteBill = useQuoteStaffCampaignBill();
	const commitBill = useCommitStaffCampaignBill();
	const [addCoffeeOpen, setAddCoffeeOpen] = useState(false);
	const [redeemTarget, setRedeemTarget] = useState<RewardSummary | null>(null);
	const [justIssued, setJustIssued] = useState<CoffeeEarnResultPayload | null>(null);
	const [awardPointsOpen, setAwardPointsOpen] = useState(false);
	const [billTotalRand, setBillTotalRand] = useState("");
	const [otherExcludedSpendRand, setOtherExcludedSpendRand] = useState("0");
	const [billReference, setBillReference] = useState("");
	const [duplicateOverrideReason, setDuplicateOverrideReason] = useState("");
	const [campaignQuantities, setCampaignQuantities] = useState<Record<string, string>>({});

	const handleAddCoffee = (input: { quantity: number; billReference: string | null }) => {
		if (!isOnline) return;
		addCoffee.mutate(
			{
				customerId: customer.customerId,
				locationId,
				quantity: input.quantity,
				billReference: input.billReference,
				idempotencyKey: newIdempotencyKey(),
			},
			{
				onSuccess: (result) => {
					setAddCoffeeOpen(false);
					setJustIssued(result.newlyIssuedCount > 0 ? result : null);
					onUpdated(result);
				},
			},
		);
	};

	const handleRedeem = (input: {
		billReference: string | null;
		billTotalRand: number | null;
	}) => {
		if (!redeemTarget) return;
		if (!isOnline) return;
		redeemReward.mutate(
			{
				customerId: customer.customerId,
				rewardId: redeemTarget.id,
				locationId,
				billReference: input.billReference,
				billTotalRand: input.billTotalRand,
			},
			{
				onSuccess: (result) => {
					setRedeemTarget(null);
					onUpdated(result);
				},
			},
		);
	};

	const canOverrideDuplicate = staffRole === "admin" || staffRole === "owner";

	const quote = quoteBill.data;

	const campaignLines = customer.points.itemCampaigns
		.map((campaign) => ({
			campaignId: campaign.campaignId,
			quantity: Number(campaignQuantities[campaign.campaignId] ?? "0"),
		}))
		.filter((line) => Number.isInteger(line.quantity) && line.quantity > 0);

	return (
		<div className="flex flex-col gap-4 p-5">
			<div>
				<p className="text-sm text-brand-muted">Customer</p>
				<h1 className="text-2xl">{customer.fullName}</h1>
			</div>

			{justIssued && (
				<Card className="border-brand-primary bg-brand-primary/10">
					<p className="font-semibold text-brand-primary">
						New reward earned! {customer.fullName} can redeem it now.
					</p>
				</Card>
			)}

			{!isOnline && (
				<p className="text-sm text-brand-danger">
					Internet is required to add coffee and redeem rewards.
				</p>
			)}

			{customer.coffee && (
				<Card>
					<CardTitle>{customer.coffee.programName}</CardTitle>
					<CardDescription>
						{customer.coffee.current}/{customer.coffee.threshold ?? "—"} coffees
					</CardDescription>
					<div className="mt-4">
						<CoffeeStampGrid coffee={customer.coffee} />
					</div>
				</Card>
			)}

			{customer.points.enabled && (
				<Card>
					<CardTitle>{customer.points.programName ?? "Reward Points"}</CardTitle>
					<CardDescription>
						{customer.points.availableBalance.toLocaleString("en-ZA")} points available
					</CardDescription>
					{customer.points.activePromotionSummary && (
						<p className="mt-2 text-sm text-brand-muted">
							Active promotion: {customer.points.activePromotionSummary}
						</p>
					)}
					{customer.points.inRecovery && (
						<p className="mt-2 text-sm text-brand-warning">
							{customer.points.recoveryPoints.toLocaleString("en-ZA")} points are in recovery.
							 Earned points will reduce this before redemptions are available.
						</p>
					)}
					{customer.points.itemCampaigns.length > 0 && (
						<div className="mt-4 space-y-2">
							<p className="text-sm font-semibold text-brand-text">Active item campaigns</p>
							{customer.points.itemCampaigns.map((campaign) => (
								<div
									key={campaign.campaignId}
									className="rounded-lg border border-brand-border px-3 py-2 text-sm"
								>
									<p className="font-medium">{campaign.name}</p>
									<p className="text-brand-muted">
										{campaign.currentNetQuantity}/{campaign.targetQuantity} in current progression
										 {campaign.inCatchUp
											? `(catch-up ${campaign.catchUpQuantity})`
											: `(remaining ${campaign.remainingToNextReward})`}
									</p>
									<p className="text-brand-muted">Reward: {campaign.rewardName}</p>
								</div>
							))}
						</div>
					)}
				</Card>
			)}

			<Card>
				<CardTitle>Available free coffees</CardTitle>
				{customer.availableFreeCoffees.length === 0 ? (
					<EmptyState title="None yet" icon={<Coffee className="size-6" />} />
				) : (
					<div className="mt-3 flex flex-col gap-2">
						{customer.availableFreeCoffees.map((reward) => (
							<RewardRow
								key={reward.id}
								reward={reward}
								disabled={!isOnline}
								onRedeem={() => setRedeemTarget(reward)}
							/>
						))}
					</div>
				)}
			</Card>

			<Card>
				<CardTitle>Available vouchers</CardTitle>
				{!customer.voucherRedemptionEnabled && (
					<p className="mt-2 text-sm text-brand-muted">
						Voucher redemption is currently disabled for staff. Ask an admin to enable it in settings.
					</p>
				)}
				{customer.availableVouchers.length === 0 ? (
					<EmptyState title="None yet" />
				) : (
					<div className="mt-3 flex flex-col gap-2">
						{customer.availableVouchers.map((reward) => (
							<RewardRow
								key={reward.id}
								reward={reward}
								disabled={!isOnline || !customer.voucherRedemptionEnabled}
								onRedeem={() => setRedeemTarget(reward)}
							/>
						))}
					</div>
				)}
			</Card>

			<Button fullWidth disabled={!isOnline} onClick={() => setAddCoffeeOpen(true)}>
				Add Coffee
			</Button>

			{customer.points.enabled && (
				<Button
					fullWidth
					disabled={!isOnline}
					onClick={() => {
						setAwardPointsOpen(true);
						quoteBill.reset();
					}}
				>
					Capture Bill (Points + Campaigns)
				</Button>
			)}

			<Button variant="outline" fullWidth onClick={onDone}>
				Done — scan next customer
			</Button>

			<AddCoffeeDialog
				open={addCoffeeOpen}
				loading={addCoffee.isPending}
				onConfirm={handleAddCoffee}
				onCancel={() => setAddCoffeeOpen(false)}
			/>
			<RedeemDialog
				reward={redeemTarget}
				loading={redeemReward.isPending}
				onConfirm={handleRedeem}
				onCancel={() => setRedeemTarget(null)}
			/>

			<ConfirmDialog
				open={awardPointsOpen}
				title="Capture Bill"
				description="Capture the full bill, excluded spend, and any item campaign quantities."
				confirmLabel="Preview bill"
				loading={quoteBill.isPending}
				onConfirm={() => {
					quoteBill.mutate({
						customerId: customer.customerId,
						locationId,
						billTotalRand,
						otherExcludedSpendRand,
						campaignLines,
					});
				}}
				onCancel={() => {
					setAwardPointsOpen(false);
					quoteBill.reset();
				}}
			>
				<div className="flex flex-col gap-3">
					<Input
						label="Full bill amount (Rand)"
						inputMode="decimal"
						placeholder="450.00"
						value={billTotalRand}
						onChange={(event) => setBillTotalRand(event.target.value)}
					/>
					<Input
						label="Other excluded spend (Rand)"
						inputMode="decimal"
						placeholder="0.00"
						value={otherExcludedSpendRand}
						onChange={(event) => setOtherExcludedSpendRand(event.target.value)}
					/>
					<Input
						label="Bill / receipt reference"
						value={billReference}
						onChange={(event) => setBillReference(event.target.value)}
					/>
					{customer.points.itemCampaigns.length > 0 && (
						<div className="space-y-2 rounded-xl border border-brand-border p-3">
							<p className="text-sm font-semibold">Item campaign quantities</p>
							{customer.points.itemCampaigns.map((campaign) => (
								<Input
									key={campaign.campaignId}
									label={`${campaign.name} (${(campaign.unitPriceCents / 100).toFixed(2)} each)`}
									inputMode="numeric"
									placeholder="0"
									value={campaignQuantities[campaign.campaignId] ?? ""}
									onChange={(event) =>
										setCampaignQuantities((prev) => ({
											...prev,
											[campaign.campaignId]: event.target.value,
										}))
									}
								/>
							))}
						</div>
					)}
					{canOverrideDuplicate && (
						<Input
							label="Duplicate override reason (optional)"
							hint="Only needed when intentionally overriding a duplicate receipt."
							value={duplicateOverrideReason}
							onChange={(event) => setDuplicateOverrideReason(event.target.value)}
						/>
					)}
					{quoteBill.isError && (
						<p className="text-sm text-brand-danger">{quoteBill.error.message}</p>
					)}
				</div>
			</ConfirmDialog>

			<ConfirmDialog
				open={Boolean(quote)}
				title="Confirm Points Award"
				description={
					quote ? (
						<div className="space-y-1 text-sm text-brand-muted">
							<p>Base points: {quote.basePoints.toLocaleString("en-ZA")}</p>
							<p>Promotion bonus: +{quote.bonusPoints.toLocaleString("en-ZA")}</p>
							<p className="font-semibold text-brand-text">
								Total: {quote.totalPoints.toLocaleString("en-ZA")} points
							</p>
						</div>
					) : null
				}
				confirmLabel="Award points"
				loading={commitBill.isPending}
				onConfirm={() => {
					if (!quote) return;
					commitBill.mutate(
						{
							customerId: customer.customerId,
							locationId,
							billTotalRand,
							otherExcludedSpendRand,
							billReference,
							campaignLines,
							requestIdempotencyKey: newIdempotencyKey(),
							duplicateOverrideReason:
								duplicateOverrideReason.trim() || undefined,
						},
						{
							onSuccess: (result) => {
								setAwardPointsOpen(false);
								quoteBill.reset();
								setBillTotalRand("");
								setOtherExcludedSpendRand("0");
								setBillReference("");
								setDuplicateOverrideReason("");
								setCampaignQuantities({});
								onUpdated({
									...customer,
									points: {
										...customer.points,
										programName: result.programName,
										availableBalance: result.summary.availableBalance,
										recoveryPoints: result.summary.recoveryPoints,
										inRecovery: result.summary.inRecovery,
									},
								});
							},
						},
					);
				}}
				onCancel={() => {
					quoteBill.reset();
				}}
			>
				{commitBill.isError && (
					<p className="text-sm text-brand-danger">{commitBill.error.message}</p>
				)}
			</ConfirmDialog>
		</div>
	);
}

function RewardRow({
	reward,
	disabled,
	onRedeem,
}: {
	reward: RewardSummary;
	disabled: boolean;
	onRedeem: () => void;
}) {
	return (
		<div className="flex items-center justify-between gap-3 rounded-xl border border-brand-border px-4 py-3">
			<div>
				<p className="font-medium">{reward.name}</p>
				{reward.terms && (
					<p className="text-xs text-brand-muted">{reward.terms}</p>
				)}
				{reward.expiresAt && (
					<Badge tone="neutral">
						Expires {new Date(reward.expiresAt).toLocaleDateString("en-ZA")}
					</Badge>
				)}
			</div>
			<Button size="sm" disabled={disabled} onClick={onRedeem}>
				Redeem
			</Button>
		</div>
	);
}
