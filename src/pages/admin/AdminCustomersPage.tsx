import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import {
	useAdminCustomerDetail,
	useAdminCustomers,
	useAdminLookups,
	useCreateAdminAdjustment,
} from "@/features/admin/core/api";
import { useOnlineStatus } from "@/features/system/useOnlineStatus";
import { AdminPanel } from "@/features/admin/core/widgets";
import { ApiClientError } from "@/lib/api";

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

export function AdminCustomersPage() {
	const isOnline = useOnlineStatus();
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [offset, setOffset] = useState(0);
	const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
	const [locationId, setLocationId] = useState("");
	const [programId, setProgramId] = useState("");
	const [transactionType, setTransactionType] = useState<"adjustment" | "reversal">(
		"adjustment",
	);
	const [quantity, setQuantity] = useState(1);
	const [reason, setReason] = useState("");
	const [billReference, setBillReference] = useState("");
	const [formError, setFormError] = useState<string | null>(null);
	const [fieldErrors, setFieldErrors] = useState<AdjustmentErrors>({});

	const customers = useAdminCustomers({ search, limit: PAGE_SIZE, offset });
	const lookups = useAdminLookups();
	const detail = useAdminCustomerDetail(selectedCustomerId);
	const createAdjustment = useCreateAdminAdjustment();

	const localValidation = validateAdjustmentForm({
		programId,
		locationId,
		transactionType,
		quantity,
		reason,
	});
	const canAdjust =
		isOnline &&
		Boolean(selectedCustomerId) &&
		Object.keys(localValidation).length === 0;

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
								<p>Join date: {selected ? new Date(selected.createdAt).toLocaleString("en-ZA") : "-"}</p>
								<p>
									Coffee progress: {detail.data?.coffee ? `${detail.data.coffee.current}/${detail.data.coffee.threshold ?? "?"}` : "No coffee program"}
								</p>
							</div>
						</AdminPanel>

						<AdminPanel title="Manual Adjustment" description="Write an audited correction entry.">
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
										value={locationId}
										onChange={(event) => {
											setLocationId(event.target.value);
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
											locationId,
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
												locationId,
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
									Save adjustment
								</Button>
							</div>
						</AdminPanel>

						<div className="grid gap-4 lg:grid-cols-3">
							<AdminPanel title={`Available rewards (${rewardsByStatus.available.length})`}>
								<ul className="grid gap-2 text-sm">
									{rewardsByStatus.available.map((reward) => (
										<li key={reward.id} className="rounded border border-brand-border p-2">
											<p className="font-medium">{reward.name}</p>
											<p className="text-xs text-brand-muted">Issued: {new Date(reward.issuedAt).toLocaleDateString("en-ZA")}</p>
										</li>
									))}
								</ul>
							</AdminPanel>
							<AdminPanel title={`Redeemed (${rewardsByStatus.redeemed.length})`}>
								<ul className="grid gap-2 text-sm">
									{rewardsByStatus.redeemed.map((reward) => (
										<li key={reward.id} className="rounded border border-brand-border p-2">
											<p className="font-medium">{reward.name}</p>
											<p className="text-xs text-brand-muted">Redeemed: {reward.redeemedAt ? new Date(reward.redeemedAt).toLocaleDateString("en-ZA") : "-"}</p>
										</li>
									))}
								</ul>
							</AdminPanel>
							<AdminPanel title={`Expired (${rewardsByStatus.expired.length})`}>
								<ul className="grid gap-2 text-sm">
									{rewardsByStatus.expired.map((reward) => (
										<li key={reward.id} className="rounded border border-brand-border p-2">
											{reward.name}
										</li>
									))}
								</ul>
							</AdminPanel>
						</div>

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
		</main>
	);
}
