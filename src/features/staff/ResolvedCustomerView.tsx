import { useState } from "react";
import { Coffee } from "lucide-react";
import type { CoffeeEarnResultPayload, StaffResolvedCustomerPayload } from "@shared/loyaltyCode";
import type { RewardSummary } from "@shared/loyalty";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { CoffeeStampGrid } from "@/features/customer/CoffeeStampGrid";
import { AddCoffeeDialog } from "@/features/staff/AddCoffeeDialog";
import { useAddCoffee, useRedeemReward } from "@/features/staff/api";
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
}: {
	customer: StaffResolvedCustomerPayload;
	locationId: string;
	onUpdated: (payload: StaffResolvedCustomerPayload) => void;
	onDone: () => void;
}) {
	const isOnline = useOnlineStatus();
	const addCoffee = useAddCoffee();
	const redeemReward = useRedeemReward();
	const [addCoffeeOpen, setAddCoffeeOpen] = useState(false);
	const [redeemTarget, setRedeemTarget] = useState<RewardSummary | null>(null);
	const [justIssued, setJustIssued] = useState<CoffeeEarnResultPayload | null>(null);

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

	const handleRedeem = (input: { billReference: string | null }) => {
		if (!redeemTarget) return;
		if (!isOnline) return;
		redeemReward.mutate(
			{
				customerId: customer.customerId,
				rewardId: redeemTarget.id,
				locationId,
				billReference: input.billReference,
			},
			{
				onSuccess: (result) => {
					setRedeemTarget(null);
					onUpdated(result);
				},
			},
		);
	};

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
				{customer.availableVouchers.length === 0 ? (
					<EmptyState title="None yet" />
				) : (
					<div className="mt-3 flex flex-col gap-2">
						{customer.availableVouchers.map((reward) => (
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

			<Button fullWidth disabled={!isOnline} onClick={() => setAddCoffeeOpen(true)}>
				Add Coffee
			</Button>

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
