import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { AdminSendTestNotificationPayload } from "@shared/admin";
import type { RewardSummary } from "@shared/loyalty";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import {
	useAdminCustomerDetail,
	useAdminCustomers,
	useAdminLookups,
	useCreateAdminAdjustment,
	useRedeemAdminReward,
	useSendAdminTestNotification,
} from "@/features/admin/core/api";
import { useOnlineStatus } from "@/features/system/useOnlineStatus";
import { AdminPanel } from "@/features/admin/core/widgets";
import { ApiClientError } from "@/lib/api";
import { formatCents } from "@/lib/money";

const PAGE_SIZE = 20;

type AdjustmentField = "programId" | "locationId" | "quantity" | "reason";
type AdjustmentErrors = Partial<Record<AdjustmentField, string>>;

function normalizeServerFieldErrors(details: unknown): AdjustmentErrors {
	if (!details || typeof details !== "object") return {};

	const record = details as Record<string, unknown>;
	const next: AdjustmentErrors = {};
	for (const key of ["programId", "locationId", "quantity", "reason"] as const) {
		const value = record[key];
		if (Array.isArray(value) && typeof value[0] === "string") {
			next[key] = value[0];
		}
	}
	return next;
}

function validateAdjustmentForm(input: {
	programId: string;
	locationId: string;
	transactionType: "adjustment" | "reversal";
	quantity: number;
	reason: string;
}): AdjustmentErrors {
	const errors: AdjustmentErrors = {};
	if (!input.programId) errors.programId = "Program is required.";
	if (!input.locationId) errors.locationId = "Location is required.";
	if (!Number.isInteger(input.quantity) || input.quantity === 0 || Math.abs(input.quantity) > 1000) {
		errors.quantity = "Enter a non-zero whole number between -1000 and 1000.";
	} else if (input.transactionType === "adjustment" && input.quantity < 0) {
		errors.quantity = "Adjustment adds coffee, so quantity must be positive.";
	} else if (input.transactionType === "reversal" && input.quantity > 0) {
		errors.quantity = "Reversal subtracts coffee, so quantity must be negative.";
	}
	if (input.reason.trim().length < 5) {
		errors.reason = "Reason must be at least 5 characters.";
	}
	return errors;
}

function alignQuantityToType(
	current: number,
	transactionType: "adjustment" | "reversal",
) {
	const base = Number.isFinite(current) ? Math.max(1, Math.abs(Math.trunc(current))) : 1;
	return transactionType === "reversal" ? -base : base;
}

function newIdempotencyKey() {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function rewardTypeLabel(rewardType: RewardSummary["rewardType"]) {
	if (rewardType === "free_item") return "Free Item";
	if (rewardType === "voucher") return "Voucher";
	if (rewardType === "discount") return "Discount";
	return "Points Reward";
}

function rewardValueLabel(reward: RewardSummary) {
	if (reward.valueCents === null) return rewardTypeLabel(reward.rewardType);
	return `${formatCents(reward.valueCents)} ${rewardTypeLabel(reward.rewardType)}`;
}

function rewardStatusTone(status: RewardSummary["status"]) {
	if (status === "available") return "primary" as const;
	if (status === "expired") return "danger" as const;
	return "neutral" as const;
}

function rewardStatusLabel(status: RewardSummary["status"]) {
	if (status === "available") return "Available";
	if (status === "redeemed") return "Redeemed";
	if (status === "expired") return "Expired";
	return "Cancelled";
}

function yesNo(value: boolean): "Yes" | "No" {
	return value ? "Yes" : "No";
}

export function AdminCustomersPage() {
	const showPushNotificationTest = !import.meta.env.PROD;
	const isOnline = useOnlineStatus();
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [offset, setOffset] = useState(0);
	const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
	const [adjustmentLocationId, setAdjustmentLocationId] = useState("");
	const [redeemLocationId, setRedeemLocationId] = useState("");
	const [programId, setProgramId] = useState("");
	const [transactionType, setTransactionType] = useState<"adjustment" | "reversal">(
		"adjustment",
	);
	const [quantity, setQuantity] = useState(1);
	const [reason, setReason] = useState("");
	const [billReference, setBillReference] = useState("");
	const [formError, setFormError] = useState<string | null>(null);
	const [redeemError, setRedeemError] = useState<string | null>(null);
	const [redeemTarget, setRedeemTarget] = useState<RewardSummary | null>(null);
	const [redeemBillReference, setRedeemBillReference] = useState("");
	const [redeemNote, setRedeemNote] = useState("");
	const [redeemBillTotalRand, setRedeemBillTotalRand] = useState("");
	const [testResult, setTestResult] =
		useState<AdminSendTestNotificationPayload | null>(null);
	const [testError, setTestError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<AdjustmentErrors>({});

	const customers = useAdminCustomers({ search, limit: PAGE_SIZE, offset });
	const lookups = useAdminLookups();
	const detail = useAdminCustomerDetail(selectedCustomerId);
	const createAdjustment = useCreateAdminAdjustment();
	const redeemReward = useRedeemAdminReward();
	const sendTestNotification = useSendAdminTestNotification();

	const localValidation = validateAdjustmentForm({
		programId,
		locationId: adjustmentLocationId,
		transactionType,
		quantity,
		reason,
	});
	const canAdjust =
		isOnline &&
		Boolean(selectedCustomerId) &&
		Object.keys(localValidation).length === 0;
	const canRedeemRewards =
		isOnline && Boolean(selectedCustomerId) && Boolean(redeemLocationId);
	const selectedRedeemLocationName =
		lookups.data?.locations.find((location) => location.id === redeemLocationId)?.name ??
		null;

	const rewardsByStatus = useMemo(() => {
		const rows = detail.data?.rewards ?? [];
		return {
			available: rows.filter((reward) => reward.status === "available"),
			redeemed: rows.filter((reward) => reward.status === "redeemed"),
			expired: rows.filter((reward) => reward.status === "expired"),
		};
	}, [detail.data?.rewards]);

	const redemptionHistory = useMemo(
		() =>
			detail.data?.transactions.filter((row) => row.transactionType === "redeem") ?? [],
		[detail.data?.transactions],
	);

	useEffect(() => {
		const handle = setTimeout(() => {
			setOffset(0);
			setSearch(searchInput.trim());
		}, 250);
		return () => clearTimeout(handle);
	}, [searchInput]);

	useEffect(() => {
		if (!lookups.data?.locations.length) return;
		const firstLocationId = lookups.data.locations[0]?.id ?? "";
		if (!adjustmentLocationId) setAdjustmentLocationId(firstLocationId);
		if (!redeemLocationId) setRedeemLocationId(firstLocationId);
	}, [adjustmentLocationId, lookups.data?.locations, redeemLocationId]);

	useEffect(() => {
		if (!redeemTarget) return;
		setRedeemBillReference("");
		setRedeemNote("");
		setRedeemBillTotalRand("");
	}, [redeemTarget]);

	useEffect(() => {
		setTestResult(null);
		setTestError(null);
	}, [selectedCustomerId]);

	if (customers.isPending) return <LoadingState label="Loading customers..." />;
	if (customers.isError) {
		return (
			<main className="p-6">
				<ErrorState
					title="Could not load customers"
					description={customers.error.message}
					onRetry={() => void customers.refetch()}
				/>
			</main>
		);
	}

	const rows = customers.data.customers;
	const selected = detail.data?.customer ?? null;
	const pushState = detail.data?.pushState ?? null;

	const redeemMinBillRand =
		redeemTarget?.minBillCents != null ? redeemTarget.minBillCents / 100 : null;
	const parsedRedeemBillTotal = Number(redeemBillTotalRand);
	const redeemHasBillTotal = redeemBillTotalRand.trim().length > 0;
	const redeemBillTotalValid =
		!redeemHasBillTotal ||
		(Number.isFinite(parsedRedeemBillTotal) && parsedRedeemBillTotal >= 0);
	const redeemMeetsMinimum =
		redeemMinBillRand == null ||
		(redeemHasBillTotal &&
			redeemBillTotalValid &&
			parsedRedeemBillTotal >= redeemMinBillRand);
	const canConfirmRedemption =
		Boolean(selectedCustomerId) &&
		Boolean(redeemTarget) &&
		Boolean(redeemLocationId) &&
		redeemBillTotalValid &&
		redeemMeetsMinimum &&
		!redeemReward.isPending;

	const handleRedeem = () => {
		if (!selectedCustomerId || !redeemTarget || !redeemLocationId) return;
		setRedeemError(null);
		redeemReward
			.mutateAsync({
				customerId: selectedCustomerId,
				rewardId: redeemTarget.id,
				locationId: redeemLocationId,
				billReference: redeemBillReference.trim() || null,
				billTotalRand:
					redeemHasBillTotal && redeemBillTotalValid ? parsedRedeemBillTotal : null,
			})
			.then(() => {
				setRedeemTarget(null);
				void detail.refetch();
			})
			.catch((error: unknown) => {
				setRedeemError(
					error instanceof Error ? error.message : "Could not redeem reward.",
				);
			});
	};

	return (
		<main className="mx-auto w-full max-w-7xl p-6">
			<PageHeader
				title="Customers"
				subtitle="Customer members only by default. Search by name, email, mobile, or bill reference."
			/>

			<div className="grid gap-4 xl:grid-cols-[340px_1fr]">
				<AdminPanel title="Customer Search" description="Name, email, mobile, or reference.">
					<div className="flex gap-2">
						<Input
							label="Search"
							value={searchInput}
							onChange={(event) => setSearchInput(event.target.value)}
						/>
						<Button
							className="self-end"
							onClick={() => {
								setOffset(0);
								setSearch(searchInput.trim());
							}}
						>
							Refresh
						</Button>
					</div>

					{rows.length === 0 ? (
						<EmptyState title="No customers found" description="Try a wider search." />
					) : (
						<ul className="mt-3 grid gap-2">
							{rows.map((customer) => (
								<li key={customer.id}>
									<button
										type="button"
										onClick={() => setSelectedCustomerId(customer.id)}
										className={`w-full rounded-lg border px-3 py-2 text-left hover:bg-brand-surface-raised ${selectedCustomerId === customer.id ? "border-brand-secondary bg-brand-surface-raised" : "border-brand-border"}`}
									>
										<p className="font-medium">{customer.fullName}</p>
										<p className="text-xs text-brand-muted">{customer.email}</p>
										<p className="text-xs text-brand-muted">
											{customer.mobileNumber || "No mobile"}
										</p>
									</button>
								</li>
							))}
						</ul>
					)}

					{customers.data.total > PAGE_SIZE && (
						<div className="mt-3 flex justify-between text-sm">
							<button
								type="button"
								className="text-brand-secondary underline disabled:opacity-40"
								disabled={offset === 0}
								onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
							>
								Newer
							</button>
							<button
								type="button"
								className="text-brand-secondary underline disabled:opacity-40"
								disabled={offset + PAGE_SIZE >= customers.data.total}
								onClick={() => setOffset((value) => value + PAGE_SIZE)}
							>
								Older
							</button>
						</div>
					)}
				</AdminPanel>

				{!selectedCustomerId ? (
					<AdminPanel title="Customer Detail" description="Select a customer to inspect activity.">
						<EmptyState title="No customer selected" />
					</AdminPanel>
				) : detail.isPending ? (
					<LoadingState label="Loading customer detail..." />
				) : detail.isError ? (
					<ErrorState
						title="Could not load customer detail"
						description={detail.error.message}
						onRetry={() => void detail.refetch()}
					/>
				) : (
					<div className="grid gap-4">
						<AdminPanel title={selected?.fullName ?? "Customer"} description={selected?.reference}>
							<div className="grid gap-2 text-sm">
								<p>Email: {selected?.email}</p>
								<p>Mobile: {selected?.mobileNumber || "Not provided"}</p>
								<p>Status: {selected?.active ? "Active" : "Inactive"}</p>
								<p>Account notifications opt-in: {selected ? yesNo(selected.notificationOptIn) : "-"}</p>
								<p>Marketing opt-in: {selected ? yesNo(selected.marketingOptIn) : "-"}</p>
								<p>Active push subscriptions: {pushState?.activePushSubscriptions ?? 0}</p>
								<p>
									Latest push last seen: {pushState?.latestPushSubscriptionLastSeenAt
										? new Date(pushState.latestPushSubscriptionLastSeenAt).toLocaleString("en-ZA")
										: "Not available"}
								</p>
								<p>Join date: {selected ? new Date(selected.createdAt).toLocaleString("en-ZA") : "-"}</p>
								<p>
									Coffee progress: {detail.data?.coffee ? `${detail.data.coffee.current}/${detail.data.coffee.threshold ?? "?"}` : "No coffee program"}
								</p>
							</div>
						</AdminPanel>

						{showPushNotificationTest && (
							<AdminPanel
								title="Push Notification Test"
								description="Send one test notification to this selected customer only."
							>
								<div className="flex flex-wrap items-center gap-3">
									<Button
										disabled={!isOnline || !selectedCustomerId}
										loading={sendTestNotification.isPending}
										onClick={() => {
											if (!selectedCustomerId) return;
											setTestError(null);
											setTestResult(null);
											sendTestNotification
												.mutateAsync(selectedCustomerId)
												.then((payload) => {
													setTestResult(payload);
													void detail.refetch();
												})
												.catch((error: unknown) => {
													setTestError(
														error instanceof Error
															? error.message
															: "Could not send test notification.",
													);
												});
										}}
									>
										Send test notification
									</Button>
									{!isOnline && (
										<p className="text-sm text-brand-danger">
											You are offline. Connect to send a test push.
										</p>
									)}
								</div>

								{testError && (
									<p className="mt-3 text-sm text-brand-danger">{testError}</p>
								)}

								{testResult && (
									<div className="mt-4 grid gap-2 text-sm">
										<p>In-app notification created: {yesNo(testResult.inAppNotificationCreated)}</p>
										<p>Push subscription found: {yesNo(testResult.pushSubscriptionFound)}</p>
										<p>Push attempted: {yesNo(testResult.pushAttempted)}</p>
										<p>Push sent: {yesNo(testResult.pushSent)}</p>
										<p>Reason if not sent: {testResult.reason ?? "-"}</p>
									</div>
								)}
							</AdminPanel>
						)}

						<AdminPanel
							title="Customer Rewards & Vouchers"
							description="Redeem member rewards and review voucher lifecycle."
							className="border-brand-primary/50 bg-brand-primary/5"
						>
							<div className="grid gap-3 md:grid-cols-[minmax(220px,320px)_1fr] md:items-end">
								<div className="grid gap-1">
									<label className="text-sm font-medium" htmlFor="redeemLocationSelect">
										Redemption location
									</label>
									<select
										id="redeemLocationSelect"
										value={redeemLocationId}
										onChange={(event) => setRedeemLocationId(event.target.value)}
										className="min-h-12 rounded-xl border border-brand-primary/60 bg-brand-surface px-3"
									>
										<option value="">Select location</option>
										{lookups.data?.locations.map((location) => (
											<option key={location.id} value={location.id}>
												{location.name}
											</option>
										))}
									</select>
								</div>
								<div className="text-xs text-brand-muted">
									Reward redemption is separate from Admin Corrections and uses the secure
									reward redemption API.
								</div>
							</div>

							{redeemError && (
								<p className="mt-3 text-sm text-brand-danger">{redeemError}</p>
							)}

							<div className="mt-4 grid gap-4 lg:grid-cols-3">
								<RewardStatusPanel
									title={`Available (${rewardsByStatus.available.length})`}
									emptyLabel="No available rewards."
									rewards={rewardsByStatus.available}
									renderItem={(reward) => (
										<div className="rounded-xl border border-brand-primary/40 bg-brand-surface px-3 py-3">
											<div className="flex items-start justify-between gap-2">
												<div className="space-y-1">
													<p className="font-medium">{reward.name}</p>
													<p className="text-xs text-brand-muted">{rewardValueLabel(reward)}</p>
													<p className="text-xs text-brand-muted">
														Valid until {reward.expiresAt ? new Date(reward.expiresAt).toLocaleDateString("en-ZA") : "No expiry"}
													</p>
													<p className="text-xs text-brand-muted">
														{selectedRedeemLocationName ?? "Select a location"}
													</p>
													<div>
														<Badge tone={rewardStatusTone(reward.status)}>
															{rewardStatusLabel(reward.status)}
														</Badge>
													</div>
												</div>
												<Button
													size="sm"
													disabled={!canRedeemRewards}
													onClick={() => {
														setRedeemError(null);
														setRedeemTarget(reward);
													}}
												>
													Redeem
												</Button>
											</div>
										</div>
									)}
								/>

								<RewardStatusPanel
									title={`Redeemed (${rewardsByStatus.redeemed.length})`}
									emptyLabel="No redeemed rewards yet."
									rewards={rewardsByStatus.redeemed}
									renderItem={(reward) => (
										<div className="rounded-xl border border-brand-border p-3">
											<div className="flex items-start justify-between gap-2">
												<div className="space-y-1">
													<p className="font-medium">{reward.name}</p>
													<p className="text-xs text-brand-muted">{rewardValueLabel(reward)}</p>
													<p className="text-xs text-brand-muted">
														Redeemed {reward.redeemedAt ? new Date(reward.redeemedAt).toLocaleDateString("en-ZA") : "-"}
													</p>
												</div>
												<Badge tone={rewardStatusTone(reward.status)}>
													{rewardStatusLabel(reward.status)}
												</Badge>
											</div>
										</div>
									)}
								/>

								<RewardStatusPanel
									title={`Expired (${rewardsByStatus.expired.length})`}
									emptyLabel="No expired rewards."
									rewards={rewardsByStatus.expired}
									renderItem={(reward) => (
										<div className="rounded-xl border border-brand-border p-3">
											<div className="flex items-start justify-between gap-2">
												<div className="space-y-1">
													<p className="font-medium">{reward.name}</p>
													<p className="text-xs text-brand-muted">{rewardValueLabel(reward)}</p>
													<p className="text-xs text-brand-muted">
														Expired {reward.expiresAt ? new Date(reward.expiresAt).toLocaleDateString("en-ZA") : "-"}
													</p>
												</div>
												<Badge tone={rewardStatusTone(reward.status)}>
													{rewardStatusLabel(reward.status)}
												</Badge>
											</div>
										</div>
									)}
								/>
							</div>
						</AdminPanel>

						<AdminPanel
							title="Admin Corrections"
							description="Use only to correct loyalty records. All changes are audited."
							className="border-brand-border/80 bg-brand-surface"
						>
							{!isOnline && (
								<p className="mb-3 text-sm text-brand-danger">
									Internet is required before saving ledger adjustments.
								</p>
							)}
							<div className="grid gap-3 md:grid-cols-2">
								<div className="grid gap-1">
									<label className="text-sm font-medium" htmlFor="programSelect">Program *</label>
									<select
										id="programSelect"
										value={programId}
										onChange={(event) => {
											setProgramId(event.target.value);
											setFieldErrors((value) => ({ ...value, programId: undefined }));
										}}
										className={`min-h-12 rounded-xl border bg-brand-surface px-3 ${fieldErrors.programId ? "border-brand-danger" : "border-brand-border"}`}
									>
										<option value="">Select program</option>
										{lookups.data?.programs.map((program) => (
											<option key={program.id} value={program.id}>
												{program.name}
											</option>
										))}
									</select>
									{fieldErrors.programId && (
										<p className="text-xs text-brand-danger">{fieldErrors.programId}</p>
									)}
								</div>

								<div className="grid gap-1">
									<label className="text-sm font-medium" htmlFor="locationSelect">Location *</label>
									<select
										id="locationSelect"
										value={adjustmentLocationId}
										onChange={(event) => {
											setAdjustmentLocationId(event.target.value);
											setFieldErrors((value) => ({ ...value, locationId: undefined }));
										}}
										className={`min-h-12 rounded-xl border bg-brand-surface px-3 ${fieldErrors.locationId ? "border-brand-danger" : "border-brand-border"}`}
									>
										<option value="">Select location</option>
										{lookups.data?.locations.map((location) => (
											<option key={location.id} value={location.id}>
												{location.name}
											</option>
										))}
									</select>
									{fieldErrors.locationId && (
										<p className="text-xs text-brand-danger">{fieldErrors.locationId}</p>
									)}
								</div>

								<div className="grid gap-1">
									<label className="text-sm font-medium" htmlFor="typeSelect">Type</label>
									<select
										id="typeSelect"
										value={transactionType}
										onChange={(event) => {
											const nextType = event.target.value as "adjustment" | "reversal";
											setTransactionType(nextType);
											setQuantity((current) => alignQuantityToType(current, nextType));
											setFieldErrors((value) => ({ ...value, quantity: undefined }));
										}}
										className="min-h-12 rounded-xl border border-brand-border bg-brand-surface px-3"
									>
										<option value="adjustment">Adjustment</option>
										<option value="reversal">Reversal</option>
									</select>
								</div>

								<Input
									label="Quantity *"
									type="number"
									value={String(quantity)}
									onChange={(event) => {
										setQuantity(Number(event.target.value));
										setFieldErrors((value) => ({ ...value, quantity: undefined }));
									}}
									error={fieldErrors.quantity}
									hint={
										transactionType === "reversal"
											? "Reversal subtracts coffee. Use a negative whole number (example: -1)."
											: "Adjustment adds coffee. Use a positive whole number (example: 1)."
									}
								/>
								<Input
									label="Reason *"
									value={reason}
									onChange={(event) => {
										setReason(event.target.value);
										setFieldErrors((value) => ({ ...value, reason: undefined }));
									}}
									error={fieldErrors.reason}
									hint="Minimum 5 characters."
								/>
								<Input
									label="Bill/reference"
									value={billReference}
									onChange={(event) => setBillReference(event.target.value)}
								/>
							</div>

							{formError && <p className="mt-2 text-sm text-brand-danger">{formError}</p>}

							<div className="mt-3">
								<Button
									disabled={!canAdjust}
									loading={createAdjustment.isPending}
									onClick={() => {
										if (!selectedCustomerId) return;
										const nextErrors = validateAdjustmentForm({
											programId,
											locationId: adjustmentLocationId,
											transactionType,
											quantity,
											reason,
										});
										if (Object.keys(nextErrors).length > 0) {
											setFieldErrors(nextErrors);
											setFormError("Please fix the highlighted required fields.");
											return;
										}
										setFormError(null);
										setFieldErrors({});
										createAdjustment
											.mutateAsync({
												customerId: selectedCustomerId,
												programId,
												locationId: adjustmentLocationId,
												transactionType,
												quantity,
												reason: reason.trim(),
												billReference: billReference.trim() || null,
												idempotencyKey: newIdempotencyKey(),
											})
											.then(() => {
												setReason("");
												setBillReference("");
												setFieldErrors({});
												void detail.refetch();
											})
											.catch((error: unknown) => {
												if (error instanceof ApiClientError) {
													const mapped = normalizeServerFieldErrors(error.details);
													if (Object.keys(mapped).length > 0) {
														setFieldErrors(mapped);
													}
												}
												setFormError(
													error instanceof Error
														? error.message
														: "Could not save adjustment.",
												);
											});
									}}
								>
									Save correction
								</Button>
							</div>
						</AdminPanel>

						<AdminPanel title="Customer transactions and redemptions">
							<ul className="grid gap-2 text-sm">
								{detail.data?.transactions.map((row) => (
									<li key={row.id} className="rounded border border-brand-border p-3">
										<p className="font-medium capitalize">
											{row.transactionType} · {row.quantity >= 0 ? "+" : ""}
											{row.quantity}
										</p>
										<p className="text-xs text-brand-muted">
											Customer: {row.customerName} | Staff: {row.staffName || "-"} | Location: {row.locationName}
										</p>
										<p className="text-xs text-brand-muted">
											{new Date(row.createdAt).toLocaleString("en-ZA")}
										</p>
									</li>
								))}
							</ul>
						</AdminPanel>

						<AdminPanel title={`Redemption history (${redemptionHistory.length})`}>
							{redemptionHistory.length === 0 ? (
								<p className="text-sm text-brand-muted">No redemption transactions yet.</p>
							) : (
								<ul className="grid gap-2 text-sm">
									{redemptionHistory.map((row) => (
										<li key={row.id} className="rounded border border-brand-border p-3">
											<p className="font-medium">{row.programName || "Loyalty program"}</p>
											<p className="text-xs text-brand-muted">Location: {row.locationName} | Staff: {row.staffName || "-"}</p>
											<p className="text-xs text-brand-muted">{new Date(row.createdAt).toLocaleString("en-ZA")}</p>
										</li>
									))}
								</ul>
							)}
						</AdminPanel>
					</div>
				)}
			</div>
			<ConfirmDialog
				open={redeemTarget !== null}
				title="Redeem reward?"
				confirmLabel="Confirm Redemption"
				confirmDisabled={!canConfirmRedemption}
				loading={redeemReward.isPending}
				onConfirm={handleRedeem}
				onCancel={() => setRedeemTarget(null)}
			>
				<div className="space-y-3 text-sm">
					<div>
						<p className="text-brand-muted">Customer:</p>
						<p className="font-medium">{selected?.fullName ?? "-"}</p>
					</div>
					<div>
						<p className="text-brand-muted">Reward:</p>
						<p className="font-medium">{redeemTarget?.name ?? "-"}</p>
					</div>
					<div>
						<p className="text-brand-muted">Value:</p>
						<p className="font-medium">
							{redeemTarget?.valueCents != null
								? formatCents(redeemTarget.valueCents)
								: rewardTypeLabel(redeemTarget?.rewardType ?? "voucher")}
						</p>
					</div>
					<div>
						<p className="text-brand-muted">Location:</p>
						<p className="font-medium">{selectedRedeemLocationName ?? "Select location"}</p>
					</div>
					<Input
						label="Bill/reference (optional)"
						value={redeemBillReference}
						onChange={(event) => setRedeemBillReference(event.target.value)}
					/>
					<Input
						label="Note (optional)"
						value={redeemNote}
						onChange={(event) => setRedeemNote(event.target.value)}
						hint="Operational note for this redemption confirmation."
					/>
					{redeemMinBillRand != null && (
						<Input
							label={`Bill total (Rand) - minimum ${redeemMinBillRand.toFixed(2)}`}
							type="number"
							min={0}
							step="0.01"
							value={redeemBillTotalRand}
							onChange={(event) => setRedeemBillTotalRand(event.target.value)}
							error={
								!redeemBillTotalValid
									? "Enter a valid non-negative bill total."
									: !redeemMeetsMinimum
										? `Minimum bill is R${redeemMinBillRand.toFixed(2)} for this voucher.`
										: undefined
							}
						/>
					)}
				</div>
			</ConfirmDialog>
		</main>
	);
}

function RewardStatusPanel({
	title,
	emptyLabel,
	rewards,
	renderItem,
}: {
	title: string;
	emptyLabel: string;
	rewards: RewardSummary[];
	renderItem: (reward: RewardSummary) => ReactNode;
}) {
	return (
		<div>
			<h3 className="text-base font-semibold">{title}</h3>
			{rewards.length === 0 ? (
				<p className="mt-2 text-sm text-brand-muted">{emptyLabel}</p>
			) : (
				<ul className="mt-2 grid gap-2 text-sm">
					{rewards.map((reward) => (
						<li key={reward.id}>{renderItem(reward)}</li>
					))}
				</ul>
			)}
		</div>
	);
}
