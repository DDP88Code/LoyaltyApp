import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import {
	useAdminLookups,
	useAdminRewards,
} from "@/features/admin/core/api";
import {
	useAdminPointsActivity,
	useAdminPointsCatalogue,
	useAdminPointsProgram,
	useAdminPointsPromotions,
	useAdminPointsReport,
	useCreatePointsAdjustment,
	useCreatePointsCatalogueItem,
	useCreatePointsPromotion,
	useDeletePointsCatalogueItem,
	useDeletePointsPromotion,
	useReversePointsAward,
	useUpdateAdminPointsProgram,
} from "@/features/admin/points/api";
import { AdminPanel, AdminStatCard } from "@/features/admin/core/widgets";
import { formatCents } from "@/lib/money";

function toIso(value: string): string {
	return new Date(value).toISOString();
}

function newIdempotencyKey() {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function AdminPointsPage() {
	const program = useAdminPointsProgram();
	const promotions = useAdminPointsPromotions();
	const catalogue = useAdminPointsCatalogue();
	const activity = useAdminPointsActivity();
	const report = useAdminPointsReport();
	const lookups = useAdminLookups();
	const rewards = useAdminRewards();

	const updateProgram = useUpdateAdminPointsProgram();
	const createPromotion = useCreatePointsPromotion();
	const deletePromotion = useDeletePointsPromotion();
	const createCatalogue = useCreatePointsCatalogueItem();
	const deleteCatalogue = useDeletePointsCatalogueItem();
	const reverseAward = useReversePointsAward();
	const createAdjustment = useCreatePointsAdjustment();

	const [programName, setProgramName] = useState("");
	const [programActive, setProgramActive] = useState<boolean | null>(null);
	const [earnRatePoints, setEarnRatePoints] = useState("1");
	const [earnRateSpendCents, setEarnRateSpendCents] = useState("100");

	const [promoName, setPromoName] = useState("");
	const [promoDescription, setPromoDescription] = useState("");
	const [promoType, setPromoType] = useState<"multiplier" | "fixed_bonus">("multiplier");
	const [promoMultiplierBp, setPromoMultiplierBp] = useState("20000");
	const [promoFixedBonusPoints, setPromoFixedBonusPoints] = useState("250");
	const [promoMinSpend, setPromoMinSpend] = useState("");
	const [promoStartAt, setPromoStartAt] = useState("");
	const [promoEndAt, setPromoEndAt] = useState("");
	const [promoEnabled, setPromoEnabled] = useState(true);

	const [catalogueRewardId, setCatalogueRewardId] = useState("");
	const [cataloguePointsCost, setCataloguePointsCost] = useState("500");
	const [catalogueSortOrder, setCatalogueSortOrder] = useState("0");
	const [catalogueActive, setCatalogueActive] = useState(true);

	const [adjustCustomerId, setAdjustCustomerId] = useState("");
	const [adjustLocationId, setAdjustLocationId] = useState("");
	const [adjustQuantity, setAdjustQuantity] = useState("50");
	const [adjustReason, setAdjustReason] = useState("");

	const rewardOptions = useMemo(
		() =>
			(rewards.data?.rewards ?? []).filter(
				(reward) => reward.rewardType === "free_item" || reward.rewardType === "voucher",
			),
		[rewards.data?.rewards],
	);

	if (
		program.isPending ||
		promotions.isPending ||
		catalogue.isPending ||
		activity.isPending ||
		report.isPending ||
		lookups.isPending ||
		rewards.isPending
	) {
		return <LoadingState label="Loading points admin..." />;
	}

	if (
		program.isError ||
		promotions.isError ||
		catalogue.isError ||
		activity.isError ||
		report.isError ||
		lookups.isError ||
		rewards.isError
	) {
		return (
			<main className="p-6">
				<ErrorState
					title="Could not load points admin"
					description={
						program.error?.message ??
						promotions.error?.message ??
						catalogue.error?.message ??
						activity.error?.message ??
						report.error?.message ??
						lookups.error?.message ??
						rewards.error?.message ??
						"Unknown error"
					}
					onRetry={() => {
						void Promise.all([
							program.refetch(),
							promotions.refetch(),
							catalogue.refetch(),
							activity.refetch(),
							report.refetch(),
							lookups.refetch(),
							rewards.refetch(),
						]);
					}}
				/>
			</main>
		);
	}

	const programData = program.data;
	const examplePerRand =
		(Number(earnRatePoints || programData.earnRatePoints) * 100) /
		Number(earnRateSpendCents || programData.earnRateSpendCents);

	async function saveProgram() {
		await updateProgram.mutateAsync({
			name: programName.trim() || programData.name,
			active: programActive ?? programData.active,
			earnRatePoints: Number(earnRatePoints || programData.earnRatePoints),
			earnRateSpendCents: Number(earnRateSpendCents || programData.earnRateSpendCents),
		});
	}

	async function addPromotion() {
		await createPromotion.mutateAsync({
			name: promoName,
			description: promoDescription.trim() || null,
			promotionType: promoType,
			multiplierBp: promoType === "multiplier" ? Number(promoMultiplierBp) : null,
			fixedBonusPoints: promoType === "fixed_bonus" ? Number(promoFixedBonusPoints) : null,
			minEligibleSpendCents: promoMinSpend ? Number(promoMinSpend) : null,
			startAt: toIso(promoStartAt),
			endAt: toIso(promoEndAt),
			enabled: promoEnabled,
		});
		setPromoName("");
		setPromoDescription("");
	}

	async function addCatalogueItem() {
		await createCatalogue.mutateAsync({
			rewardDefinitionId: catalogueRewardId,
			pointsCost: Number(cataloguePointsCost),
			active: catalogueActive,
			sortOrder: Number(catalogueSortOrder),
			imageKey: null,
		});
	}

	async function submitAdjustment() {
		if (!adjustCustomerId || !adjustLocationId) return;
		await createAdjustment.mutateAsync({
			customerId: adjustCustomerId,
			locationId: adjustLocationId,
			quantity: Number(adjustQuantity),
			reason: adjustReason,
			idempotencyKey: newIdempotencyKey(),
		});
		setAdjustReason("");
	}

	return (
		<main className="mx-auto w-full max-w-7xl p-6">
			<PageHeader
				title="Reward Points"
				subtitle="Configure programme settings, promotions, catalogue, and point activity."
			/>

			<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<AdminStatCard
					title="Outstanding Points Balance"
					value={report.data.outstandingPoints.toLocaleString("en-ZA")}
					subtitle="Current net points"
				/>
				<AdminStatCard
					title="Points Issued"
					value={report.data.pointsIssued.toLocaleString("en-ZA")}
					subtitle={`+${report.data.pointsIssuedFromPromotions.toLocaleString("en-ZA")} from promotions`}
				/>
				<AdminStatCard
					title="Points Redeemed"
					value={report.data.pointsRedeemed.toLocaleString("en-ZA")}
					subtitle={`${report.data.pointsReversed.toLocaleString("en-ZA")} reversed`}
				/>
				<AdminStatCard
					title="Customers In Recovery"
					value={report.data.customersInRecovery.toLocaleString("en-ZA")}
					subtitle={`${report.data.pointsAdjusted.toLocaleString("en-ZA")} adjusted`}
				/>
			</section>

			<section className="mt-6 grid gap-4 xl:grid-cols-2">
				<AdminPanel title="Programme" description="Single source of truth for Reward Points programme state.">
					<div className="grid gap-3 md:grid-cols-2">
						<Input
							label="Programme name"
							value={programName || programData.name}
							onChange={(event) => setProgramName(event.target.value)}
						/>
						<label className="inline-flex min-h-12 items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={programActive ?? programData.active}
								onChange={(event) => setProgramActive(event.target.checked)}
								className="size-4 accent-brand-primary"
							/>
							<span>Programme enabled</span>
						</label>
						<Input
							label="Earn rate points"
							type="number"
							value={earnRatePoints || String(programData.earnRatePoints)}
							onChange={(event) => setEarnRatePoints(event.target.value)}
						/>
						<Input
							label="Earn rate spend (cents)"
							type="number"
							value={earnRateSpendCents || String(programData.earnRateSpendCents)}
							onChange={(event) => setEarnRateSpendCents(event.target.value)}
						/>
					</div>
					<p className="mt-3 text-sm text-brand-muted">
						Worked example: R1 = {examplePerRand.toFixed(2)} points
					</p>
					<div className="mt-4">
						<Button loading={updateProgram.isPending} onClick={() => void saveProgram()}>
							Save programme
						</Button>
					</div>
				</AdminPanel>

				<AdminPanel title="Points Promotions" description="Create scheduled multipliers and fixed bonuses.">
					<div className="grid gap-3 md:grid-cols-2">
						<Input label="Name" value={promoName} onChange={(event) => setPromoName(event.target.value)} />
						<Input
							label="Description"
							value={promoDescription}
							onChange={(event) => setPromoDescription(event.target.value)}
						/>
						<div className="grid gap-1">
							<label className="text-sm font-medium" htmlFor="pointsPromoType">Promotion type</label>
							<select
								id="pointsPromoType"
								value={promoType}
								onChange={(event) => setPromoType(event.target.value as "multiplier" | "fixed_bonus")}
								className="min-h-12 w-full min-w-0 rounded-xl border border-brand-border bg-brand-surface px-3"
							>
								<option value="multiplier">multiplier</option>
								<option value="fixed_bonus">fixed_bonus</option>
							</select>
						</div>
						{promoType === "multiplier" ? (
							<Input
								label="Multiplier basis points"
								hint="20000 = 2x, 30000 = 3x"
								type="number"
								value={promoMultiplierBp}
								onChange={(event) => setPromoMultiplierBp(event.target.value)}
							/>
						) : (
							<Input
								label="Fixed bonus points"
								type="number"
								value={promoFixedBonusPoints}
								onChange={(event) => setPromoFixedBonusPoints(event.target.value)}
							/>
						)}
						<Input
							label="Minimum eligible spend (cents, optional)"
							type="number"
							value={promoMinSpend}
							onChange={(event) => setPromoMinSpend(event.target.value)}
						/>
						<Input
							label="Start"
							type="datetime-local"
							value={promoStartAt}
							onChange={(event) => setPromoStartAt(event.target.value)}
						/>
						<Input
							label="End"
							type="datetime-local"
							value={promoEndAt}
							onChange={(event) => setPromoEndAt(event.target.value)}
						/>
						<label className="inline-flex min-h-12 items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={promoEnabled}
								onChange={(event) => setPromoEnabled(event.target.checked)}
								className="size-4 accent-brand-primary"
							/>
							<span>Enabled</span>
						</label>
					</div>
					<div className="mt-3 flex gap-2">
						<Button loading={createPromotion.isPending} onClick={() => void addPromotion()}>
							Create promotion
						</Button>
					</div>
					<div className="mt-4 grid gap-2">
						{promotions.data.length === 0 ? (
							<EmptyState title="No points promotions" />
						) : (
							promotions.data.map((row) => (
								<div key={row.id} className="rounded-lg border border-brand-border px-3 py-2">
									<p className="font-medium">{row.name}</p>
									<p className="text-xs text-brand-muted">
										{row.promotionType === "multiplier"
											? `${(row.multiplierBp ?? 0) / 10000}x`
											: `+${row.fixedBonusPoints ?? 0} points`}
										 • {new Date(row.startAt).toLocaleString("en-ZA")} to {new Date(row.endAt).toLocaleString("en-ZA")}
									</p>
									<div className="mt-2 flex gap-2">
										<Button
											size="sm"
											variant="outline"
											onClick={() => void deletePromotion.mutateAsync(row.id)}
										>
											Delete
										</Button>
									</div>
								</div>
							))
						)}
					</div>
				</AdminPanel>
			</section>

			<section className="mt-6 grid gap-4 xl:grid-cols-2">
				<AdminPanel title="Points Reward Catalogue" description="Map reward definitions to configurable points costs.">
					{!catalogue.data.staffVoucherRedemptionEnabled && (
						<p className="mb-3 rounded-lg border border-brand-warning/40 bg-brand-warning/10 px-3 py-2 text-sm text-brand-warning">
							Staff cannot redeem voucher rewards until staff voucher redemption is enabled in Settings.
						</p>
					)}
					<div className="grid gap-3 md:grid-cols-2">
						<div className="grid gap-1 md:col-span-2">
							<label className="text-sm font-medium" htmlFor="pointsRewardDefinition">Reward definition</label>
							<select
								id="pointsRewardDefinition"
								value={catalogueRewardId}
								onChange={(event) => setCatalogueRewardId(event.target.value)}
								className="min-h-12 w-full min-w-0 rounded-xl border border-brand-border bg-brand-surface px-3"
							>
								<option value="">Select reward definition</option>
								{rewardOptions.map((reward) => (
									<option key={reward.id} value={reward.id}>
										{reward.name} ({reward.rewardType})
									</option>
								))}
							</select>
						</div>
						<Input
							label="Points cost"
							type="number"
							value={cataloguePointsCost}
							onChange={(event) => setCataloguePointsCost(event.target.value)}
						/>
						<Input
							label="Sort order"
							type="number"
							value={catalogueSortOrder}
							onChange={(event) => setCatalogueSortOrder(event.target.value)}
						/>
						<label className="inline-flex min-h-12 items-center gap-2 text-sm md:col-span-2">
							<input
								type="checkbox"
								checked={catalogueActive}
								onChange={(event) => setCatalogueActive(event.target.checked)}
								className="size-4 accent-brand-primary"
							/>
							<span>Active</span>
						</label>
					</div>
					<div className="mt-3">
						<Button loading={createCatalogue.isPending} onClick={() => void addCatalogueItem()}>
							Add catalogue item
						</Button>
					</div>
					<div className="mt-4 grid gap-2">
						{catalogue.data.items.length === 0 ? (
							<EmptyState title="No catalogue items yet" />
						) : (
							catalogue.data.items.map((item) => (
								<div key={item.id} className="rounded-lg border border-brand-border px-3 py-2">
									<p className="font-medium">{item.name}</p>
									<p className="text-xs text-brand-muted">
										{item.pointsCost.toLocaleString("en-ZA")} points
										{item.valueCents != null ? ` • ${formatCents(item.valueCents)}` : ""}
									</p>
									<div className="mt-2">
										<Button
											size="sm"
											variant="outline"
											onClick={() => void deleteCatalogue.mutateAsync(item.id)}
										>
											Delete
										</Button>
									</div>
								</div>
							))
						)}
					</div>
				</AdminPanel>

				<AdminPanel title="Activity & Outstanding Points" description="Recent awards, reversals, and customers in recovery.">
					<div className="mb-4 rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-muted">
						Outstanding Points Balance: {activity.data.outstandingPoints.toLocaleString("en-ZA")}
					</div>
					<div className="grid gap-2">
						{activity.data.recentAwards.length === 0 ? (
							<EmptyState title="No points awards yet" />
						) : (
							activity.data.recentAwards.map((row) => (
								<div key={row.id} className="rounded-lg border border-brand-border px-3 py-2">
									<p className="font-medium">
										{row.customerName} • {row.totalPoints.toLocaleString("en-ZA")} points
									</p>
									<p className="text-xs text-brand-muted">
										{row.billReference} • {row.locationName} • {new Date(row.createdAt).toLocaleString("en-ZA")}
									</p>
									<div className="mt-2">
										<Button
											size="sm"
											variant="outline"
											disabled={Boolean(row.reversedAt) || reverseAward.isPending}
											onClick={() => {
												const reason = window.prompt("Reversal reason (min 5 chars)", "");
												if (!reason) return;
												void reverseAward.mutateAsync({ awardId: row.id, reason });
											}}
										>
											{row.reversedAt ? "Reversed" : "Reverse Award"}
										</Button>
									</div>
								</div>
							))
						)}
					</div>
					<div className="mt-4">
						<p className="text-sm font-semibold">Customers in recovery</p>
						{activity.data.customersInRecovery.length === 0 ? (
							<p className="mt-1 text-sm text-brand-muted">No customers currently in recovery.</p>
						) : (
							<ul className="mt-2 grid gap-1 text-sm">
								{activity.data.customersInRecovery.map((row) => (
									<li key={row.customerId} className="rounded border border-brand-border px-2 py-1">
										{row.customerName}: {row.recoveryPoints.toLocaleString("en-ZA")} to recover (raw {row.rawBalance})
									</li>
								))}
							</ul>
						)}
					</div>
				</AdminPanel>
			</section>

			<section className="mt-6">
				<AdminPanel title="Adjustments" description="Create audited positive or negative points adjustments.">
					<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
						<div className="grid gap-1">
							<label className="text-sm font-medium" htmlFor="adjustCustomer">Customer</label>
							<select
								id="adjustCustomer"
								value={adjustCustomerId}
								onChange={(event) => setAdjustCustomerId(event.target.value)}
								className="min-h-12 w-full min-w-0 rounded-xl border border-brand-border bg-brand-surface px-3"
							>
								<option value="">Select customer</option>
								{lookups.data.customers.map((customer) => (
									<option key={customer.id} value={customer.id}>{customer.fullName}</option>
								))}
							</select>
						</div>
						<div className="grid gap-1">
							<label className="text-sm font-medium" htmlFor="adjustLocation">Location</label>
							<select
								id="adjustLocation"
								value={adjustLocationId}
								onChange={(event) => setAdjustLocationId(event.target.value)}
								className="min-h-12 w-full min-w-0 rounded-xl border border-brand-border bg-brand-surface px-3"
							>
								<option value="">Select location</option>
								{lookups.data.locations.map((location) => (
									<option key={location.id} value={location.id}>{location.name}</option>
								))}
							</select>
						</div>
						<Input
							label="Quantity (+/-)"
							type="number"
							value={adjustQuantity}
							onChange={(event) => setAdjustQuantity(event.target.value)}
						/>
						<Input
							label="Reason"
							value={adjustReason}
							onChange={(event) => setAdjustReason(event.target.value)}
						/>
					</div>
					<div className="mt-3">
						<Button loading={createAdjustment.isPending} onClick={() => void submitAdjustment()}>
							Create adjustment
						</Button>
					</div>
				</AdminPanel>
			</section>
		</main>
	);
}
