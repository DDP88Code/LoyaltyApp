import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useAdminLookups } from "@/features/admin/core/api";
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

function parsePositiveInt(value: string): number | null {
	if (!/^\d+$/.test(value.trim())) return null;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) return null;
	return parsed;
}

function parseNonNegativeInt(value: string): number | null {
	if (!/^\d+$/.test(value.trim())) return null;
	const parsed = Number.parseInt(value, 10);
	if (!Number.isFinite(parsed) || parsed < 0) return null;
	return parsed;
}

function parseRandToCents(value: string): number | null {
	const normalized = value.trim().replace(/,/g, "");
	if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;

	const [rawWholePart, decimalPart = ""] = normalized.split(".");
	const wholePart = rawWholePart ?? "0";
	const whole = Number.parseInt(wholePart, 10);
	if (!Number.isFinite(whole)) return null;

	const centsPart = Number.parseInt((decimalPart + "00").slice(0, 2), 10);
	const total = whole * 100 + centsPart;
	if (!Number.isFinite(total) || total < 0) return null;
	return total;
}

function parseMultiplierToBasisPoints(value: string): number | null {
	const normalized = value.trim().replace(/,/g, "");
	if (!/^\d+(\.\d{0,4})?$/.test(normalized)) return null;

	const [rawWholePart, decimalPart = ""] = normalized.split(".");
	const wholePart = rawWholePart ?? "0";
	const whole = Number.parseInt(wholePart, 10);
	if (!Number.isFinite(whole)) return null;

	const basisPointsPart = Number.parseInt(
		(decimalPart + "0000").slice(0, 4),
		10,
	);
	const total = whole * 10_000 + basisPointsPart;
	if (!Number.isFinite(total) || total <= 10_000) return null;
	return total;
}

function formatRandFromCents(cents: number): string {
	return (cents / 100).toFixed(2);
}

function formatMultiplierFromBasisPoints(basisPoints: number): string {
	const value = (basisPoints / 10_000).toFixed(4);
	return value.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function rewardTypeLabel(rewardType: string): string {
	if (rewardType === "free_item") return "Free item";
	if (rewardType === "voucher") return "Voucher";
	if (rewardType === "discount") return "Discount";
	if (rewardType === "points_reward") return "Points reward";
	return rewardType;
}

function promotionTypeLabel(type: "multiplier" | "fixed_bonus"): string {
	return type === "multiplier" ? "Points multiplier" : "Fixed bonus points";
}

export function AdminPointsPage() {
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const requestedCatalogueRewardId = searchParams.get("catalogueRewardId");

	const program = useAdminPointsProgram();
	const promotions = useAdminPointsPromotions();
	const catalogue = useAdminPointsCatalogue();
	const activity = useAdminPointsActivity();
	const report = useAdminPointsReport();
	const lookups = useAdminLookups();

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
	const [earnRateSpendRand, setEarnRateSpendRand] = useState("1.00");
	const [programFormError, setProgramFormError] = useState<string | null>(null);

	const [promoName, setPromoName] = useState("");
	const [promoDescription, setPromoDescription] = useState("");
	const [promoType, setPromoType] = useState<"multiplier" | "fixed_bonus">("multiplier");
	const [promoMultiplier, setPromoMultiplier] = useState("2");
	const [promoFixedBonusPoints, setPromoFixedBonusPoints] = useState("250");
	const [promoMinSpendRand, setPromoMinSpendRand] = useState("");
	const [promoStartAt, setPromoStartAt] = useState("");
	const [promoEndAt, setPromoEndAt] = useState("");
	const [promoEnabled, setPromoEnabled] = useState(true);
	const [promoFormError, setPromoFormError] = useState<string | null>(null);

	const [catalogueRewardId, setCatalogueRewardId] = useState(
		requestedCatalogueRewardId ?? "",
	);
	const [cataloguePointsCost, setCataloguePointsCost] = useState("500");
	const [catalogueSortOrder, setCatalogueSortOrder] = useState("0");
	const [catalogueActive, setCatalogueActive] = useState(true);
	const [catalogueFormError, setCatalogueFormError] = useState<string | null>(null);

	const [adjustCustomerId, setAdjustCustomerId] = useState("");
	const [adjustLocationId, setAdjustLocationId] = useState("");
	const [adjustQuantity, setAdjustQuantity] = useState("50");
	const [adjustReason, setAdjustReason] = useState("");

	if (
		program.isPending ||
		promotions.isPending ||
		catalogue.isPending ||
		activity.isPending ||
		report.isPending ||
		lookups.isPending
	) {
		return <LoadingState label="Loading points admin..." />;
	}

	if (
		program.isError ||
		promotions.isError ||
		catalogue.isError ||
		activity.isError ||
		report.isError ||
		lookups.isError
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
						]);
					}}
				/>
			</main>
		);
	}

	const programData = program.data;
	const rewardOptions = catalogue.data.eligibleRewards;
	const selectedCatalogueReward = rewardOptions.find(
		(reward) => reward.id === catalogueRewardId,
	);
	const requestedRewardMissing =
		Boolean(requestedCatalogueRewardId) &&
		!rewardOptions.some((reward) => reward.id === requestedCatalogueRewardId);

	const resolvedEarnRatePoints =
		parsePositiveInt(earnRatePoints) ?? programData.earnRatePoints;
	const resolvedEarnRateSpendCents =
		parseRandToCents(earnRateSpendRand) ?? programData.earnRateSpendCents;
	const examplePerRand =
		(resolvedEarnRatePoints * 100) / Math.max(1, resolvedEarnRateSpendCents);
	const workedExampleSpendCents = 35_000;
	const workedExamplePoints = Math.floor(
		(workedExampleSpendCents * resolvedEarnRatePoints) /
			Math.max(1, resolvedEarnRateSpendCents),
	);

	const voucherCatalogueInUse = catalogue.data.items.some(
		(item) => item.rewardType === "voucher",
	);
	const voucherBeingConfigured = selectedCatalogueReward?.rewardType === "voucher";
	const showVoucherRedemptionWarning =
		!catalogue.data.staffVoucherRedemptionEnabled &&
		(voucherCatalogueInUse || voucherBeingConfigured);

	async function saveProgram() {
		setProgramFormError(null);
		try {
			const pointsRaw = earnRatePoints.trim();
			const spendRaw = earnRateSpendRand.trim();

			const nextEarnRatePoints = pointsRaw
				? parsePositiveInt(pointsRaw)
				: programData.earnRatePoints;
			if (!nextEarnRatePoints) {
				throw new Error("Enter a valid whole number of points greater than zero.");
			}

			const nextEarnRateSpendCents = spendRaw
				? parseRandToCents(spendRaw)
				: programData.earnRateSpendCents;
			if (nextEarnRateSpendCents == null || nextEarnRateSpendCents <= 0) {
				throw new Error(
					"Enter a valid Rand amount for spend required, for example 1, 10 or 25.50.",
				);
			}

			await updateProgram.mutateAsync({
				name: programName.trim() || programData.name,
				active: programActive ?? programData.active,
				earnRatePoints: nextEarnRatePoints,
				earnRateSpendCents: nextEarnRateSpendCents,
			});

			setEarnRatePoints(String(nextEarnRatePoints));
			setEarnRateSpendRand(formatRandFromCents(nextEarnRateSpendCents));
		} catch (cause) {
			setProgramFormError(
				cause instanceof Error ? cause.message : "Could not save programme settings.",
			);
		}
	}

	async function addPromotion() {
		setPromoFormError(null);
		try {
			if (promoName.trim().length < 2) {
				throw new Error("Enter a promotion name with at least 2 characters.");
			}
			if (!promoStartAt || !promoEndAt) {
				throw new Error("Choose both start and end date/time.");
			}

			const startAt = toIso(promoStartAt);
			const endAt = toIso(promoEndAt);
			if (new Date(endAt).getTime() <= new Date(startAt).getTime()) {
				throw new Error("End date/time must be after start date/time.");
			}

			const minSpendRaw = promoMinSpendRand.trim();
			const minEligibleSpendCents = minSpendRaw
				? parseRandToCents(minSpendRaw)
				: null;
			if (minSpendRaw && minEligibleSpendCents == null) {
				throw new Error("Minimum spend must be a valid Rand amount.");
			}

			const multiplierBp =
				promoType === "multiplier"
					? parseMultiplierToBasisPoints(promoMultiplier)
					: null;
			if (promoType === "multiplier" && multiplierBp == null) {
				throw new Error("Enter a multiplier greater than 1, for example 1.5 or 2.");
			}

			const fixedBonusPoints =
				promoType === "fixed_bonus"
					? parsePositiveInt(promoFixedBonusPoints)
					: null;
			if (promoType === "fixed_bonus" && fixedBonusPoints == null) {
				throw new Error("Fixed bonus points must be a whole number greater than zero.");
			}

			await createPromotion.mutateAsync({
				name: promoName.trim(),
				description: promoDescription.trim() || null,
				promotionType: promoType,
				multiplierBp,
				fixedBonusPoints,
				minEligibleSpendCents,
				startAt,
				endAt,
				enabled: promoEnabled,
			});

			setPromoName("");
			setPromoDescription("");
			setPromoMinSpendRand("");
		} catch (cause) {
			setPromoFormError(
				cause instanceof Error ? cause.message : "Could not create points promotion.",
			);
		}
	}

	async function addCatalogueItem() {
		setCatalogueFormError(null);
		try {
			if (!catalogueRewardId) {
				throw new Error("Select an eligible reward first.");
			}

			const pointsCost = parsePositiveInt(cataloguePointsCost);
			if (!pointsCost) {
				throw new Error("Points required must be a whole number greater than zero.");
			}

			const sortOrder = parseNonNegativeInt(catalogueSortOrder);
			if (sortOrder == null) {
				throw new Error("Display order must be a whole number of zero or more.");
			}

			await createCatalogue.mutateAsync({
				rewardDefinitionId: catalogueRewardId,
				pointsCost,
				active: catalogueActive,
				sortOrder,
				imageKey: null,
			});
		} catch (cause) {
			setCatalogueFormError(
				cause instanceof Error ? cause.message : "Could not add catalogue item.",
			);
		}
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
				subtitle="Manage earning rules, promotions, and which rewards customers can redeem with points."
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
				<AdminPanel title="Programme" description="Set how customers earn points for spend.">
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
							label="How many points to award"
							type="number"
							value={earnRatePoints || String(programData.earnRatePoints)}
							onChange={(event) => setEarnRatePoints(event.target.value)}
							hint="Whole numbers only. Example: 1"
						/>
						<Input
							label="Spend required for that points amount (Rand)"
							value={earnRateSpendRand || formatRandFromCents(programData.earnRateSpendCents)}
							onChange={(event) => setEarnRateSpendRand(event.target.value)}
							hint="Example: 1 means 1 point per R1 spent."
						/>
					</div>
					<p className="mt-3 text-sm text-brand-muted">
						Worked example: R350.00 earns {workedExamplePoints.toLocaleString("en-ZA")} points
						 ({examplePerRand.toFixed(2)} points per Rand).
					</p>
					{programFormError && (
						<p className="mt-3 text-sm text-brand-danger">{programFormError}</p>
					)}
					<div className="mt-4">
						<Button loading={updateProgram.isPending} onClick={() => void saveProgram()}>
							Save programme
						</Button>
					</div>
				</AdminPanel>

				<AdminPanel title="Points Promotions" description="Create time-based earning boosts.">
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
								<option value="multiplier">Points multiplier</option>
								<option value="fixed_bonus">Fixed bonus points</option>
							</select>
						</div>
						{promoType === "multiplier" ? (
							<Input
								label="Multiplier (x)"
								hint="Examples: 1.5 = 50% bonus, 2 = double points"
								value={promoMultiplier}
								onChange={(event) => setPromoMultiplier(event.target.value)}
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
							label="Minimum spend required (Rand, optional)"
							value={promoMinSpendRand}
							onChange={(event) => setPromoMinSpendRand(event.target.value)}
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
					{promoFormError && (
						<p className="mt-3 text-sm text-brand-danger">{promoFormError}</p>
					)}
					<div className="mt-4 grid gap-2">
						{promotions.data.length === 0 ? (
							<EmptyState title="No points promotions" />
						) : (
							promotions.data.map((row) => (
								<div key={row.id} className="rounded-lg border border-brand-border px-3 py-2">
									<p className="font-medium">{row.name}</p>
									<p className="text-xs text-brand-muted">
										{promotionTypeLabel(row.promotionType)}: {row.promotionType === "multiplier"
											? `${formatMultiplierFromBasisPoints(row.multiplierBp ?? 20_000)}x`
											: `+${(row.fixedBonusPoints ?? 0).toLocaleString("en-ZA")} points`}
										{row.minEligibleSpendCents != null ? ` • Min spend ${formatCents(row.minEligibleSpendCents)}` : ""}
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
				<AdminPanel
					title="Points Reward Catalogue"
					description="Choose which customer rewards can be redeemed with points and set their points cost."
				>
					<div className="mb-3 flex flex-wrap gap-2">
						<Button
							variant="outline"
							onClick={() => navigate("/admin/rewards?source=points")}
						>
							Create new reward definition
						</Button>
					</div>
					{showVoucherRedemptionWarning && (
						<div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-warning/40 bg-brand-warning/10 px-3 py-2 text-sm text-brand-warning">
							<span>
								Voucher rewards require staff voucher redemption to be enabled in Settings.
							</span>
							<Button
								size="sm"
								variant="outline"
								onClick={() => navigate("/admin/settings")}
							>
								Go to Settings
							</Button>
						</div>
					)}
					{requestedRewardMissing && (
						<p className="mb-3 rounded-lg border border-brand-warning/40 bg-brand-warning/10 px-3 py-2 text-sm text-brand-warning">
							The reward you just created is not currently eligible for points catalogue mapping.
						</p>
					)}
					<div className="grid gap-3 md:grid-cols-2">
						<div className="grid gap-1 md:col-span-2">
							<label className="text-sm font-medium" htmlFor="pointsRewardDefinition">Eligible reward</label>
							<select
								id="pointsRewardDefinition"
								value={catalogueRewardId}
								onChange={(event) => setCatalogueRewardId(event.target.value)}
								className="min-h-12 w-full min-w-0 rounded-xl border border-brand-border bg-brand-surface px-3"
							>
								<option value="">Select eligible reward</option>
								{rewardOptions.map((reward) => (
									<option key={reward.id} value={reward.id}>
										{reward.name} - {rewardTypeLabel(reward.rewardType)}
										{reward.valueCents != null ? ` (${formatCents(reward.valueCents)})` : ""}
									</option>
								))}
							</select>
							{rewardOptions.length === 0 && (
								<p className="text-xs text-brand-muted">
									No eligible rewards are available. Create a Free item or Voucher reward first.
								</p>
							)}
						</div>
						<Input
							label="Points required to redeem"
							type="number"
							value={cataloguePointsCost}
							onChange={(event) => setCataloguePointsCost(event.target.value)}
						/>
						<Input
							label="Display order"
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
					{catalogueFormError && (
						<p className="mt-3 text-sm text-brand-danger">{catalogueFormError}</p>
					)}
					<div className="mt-4 grid gap-2">
						{catalogue.data.items.length === 0 ? (
							<EmptyState title="No catalogue items yet" />
						) : (
							catalogue.data.items.map((item) => (
								<div key={item.id} className="rounded-lg border border-brand-border px-3 py-2">
									<p className="font-medium">{item.name} - {rewardTypeLabel(item.rewardType)}</p>
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
