import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useAdminLookups, useAdminTransactions } from "@/features/admin/core/api";
import { AdminPanel } from "@/features/admin/core/widgets";

const PAGE_SIZE = 25;

export function AdminTransactionsPage() {
	const lookups = useAdminLookups();
	const [filters, setFilters] = useState({
		customerId: "",
		staffId: "",
		locationId: "",
		programId: "",
		type: "",
		billReference: "",
		from: "",
		to: "",
		offset: 0,
	});

	const transactions = useAdminTransactions({
		customerId: filters.customerId || undefined,
		staffId: filters.staffId || undefined,
		locationId: filters.locationId || undefined,
		programId: filters.programId || undefined,
		type:
			(filters.type as "earn" | "bonus" | "redeem" | "adjustment" | "reversal") ||
			undefined,
		billReference: filters.billReference || undefined,
		from: filters.from || undefined,
		to: filters.to || undefined,
		limit: PAGE_SIZE,
		offset: filters.offset,
	});

	if (lookups.isPending || transactions.isPending) {
		return <LoadingState label="Loading transactions..." />;
	}
	if (lookups.isError || transactions.isError) {
		return (
			<main className="p-6">
				<ErrorState
					title="Could not load transactions"
					description={lookups.error?.message ?? transactions.error?.message}
					onRetry={() => {
						void lookups.refetch();
						void transactions.refetch();
					}}
				/>
			</main>
		);
	}

	const rows = transactions.data.transactions;

	return (
		<main className="mx-auto w-full max-w-7xl p-6">
			<PageHeader
				title="Transactions"
				subtitle="Filter by customer, staff, date, program, type, location, and bill reference."
			/>

			<AdminPanel title="Filters">
				<div className="grid gap-3 md:grid-cols-4">
					<div className="grid gap-1">
						<label className="text-sm font-medium" htmlFor="customerFilter">Customer</label>
						<select
							id="customerFilter"
							value={filters.customerId}
							onChange={(event) =>
								setFilters((value) => ({ ...value, customerId: event.target.value, offset: 0 }))
							}
							className="min-h-12 rounded-xl border border-brand-border bg-brand-surface px-3"
						>
							<option value="">All customers</option>
							{lookups.data.customers.map((customer) => (
								<option key={customer.id} value={customer.id}>
									{customer.fullName}
								</option>
							))}
						</select>
					</div>

					<div className="grid gap-1">
						<label className="text-sm font-medium" htmlFor="staffFilter">Staff</label>
						<select
							id="staffFilter"
							value={filters.staffId}
							onChange={(event) =>
								setFilters((value) => ({ ...value, staffId: event.target.value, offset: 0 }))
							}
							className="min-h-12 rounded-xl border border-brand-border bg-brand-surface px-3"
						>
							<option value="">All staff</option>
							{lookups.data.staff.map((staff) => (
								<option key={staff.id} value={staff.id}>
									{staff.fullName}
								</option>
							))}
						</select>
					</div>

					<div className="grid gap-1">
						<label className="text-sm font-medium" htmlFor="locationFilter">Location</label>
						<select
							id="locationFilter"
							value={filters.locationId}
							onChange={(event) =>
								setFilters((value) => ({ ...value, locationId: event.target.value, offset: 0 }))
							}
							className="min-h-12 rounded-xl border border-brand-border bg-brand-surface px-3"
						>
							<option value="">All locations</option>
							{lookups.data.locations.map((location) => (
								<option key={location.id} value={location.id}>
									{location.name}
								</option>
							))}
						</select>
					</div>

					<div className="grid gap-1">
						<label className="text-sm font-medium" htmlFor="programFilter">Program</label>
						<select
							id="programFilter"
							value={filters.programId}
							onChange={(event) =>
								setFilters((value) => ({ ...value, programId: event.target.value, offset: 0 }))
							}
							className="min-h-12 rounded-xl border border-brand-border bg-brand-surface px-3"
						>
							<option value="">All programs</option>
							{lookups.data.programs.map((program) => (
								<option key={program.id} value={program.id}>
									{program.name}
								</option>
							))}
						</select>
					</div>

					<div className="grid gap-1">
						<label className="text-sm font-medium" htmlFor="typeFilter">Type</label>
						<select
							id="typeFilter"
							value={filters.type}
							onChange={(event) =>
								setFilters((value) => ({ ...value, type: event.target.value, offset: 0 }))
							}
							className="min-h-12 rounded-xl border border-brand-border bg-brand-surface px-3"
						>
							<option value="">All types</option>
							<option value="earn">earn</option>
							<option value="bonus">bonus</option>
							<option value="redeem">redeem</option>
							<option value="adjustment">adjustment</option>
							<option value="reversal">reversal</option>
						</select>
					</div>

					<Input
						label="Bill reference"
						value={filters.billReference}
						onChange={(event) =>
							setFilters((value) => ({ ...value, billReference: event.target.value, offset: 0 }))
						}
					/>
					<Input
						label="From"
						type="date"
						value={filters.from}
						onChange={(event) =>
							setFilters((value) => ({ ...value, from: event.target.value, offset: 0 }))
						}
					/>
					<Input
						label="To"
						type="date"
						value={filters.to}
						onChange={(event) =>
							setFilters((value) => ({ ...value, to: event.target.value, offset: 0 }))
						}
					/>
				</div>
			</AdminPanel>

			<AdminPanel title="Ledger records" description="Append-only records. No destructive delete path.">
				{rows.length === 0 ? (
					<EmptyState title="No transactions found" />
				) : (
					<ul className="grid gap-2 text-sm">
						{rows.map((row) => (
							<li key={row.id} className="rounded-lg border border-brand-border p-3">
								<p className="font-medium capitalize">
									{row.transactionType} | {row.quantity >= 0 ? "+" : ""}
									{row.quantity}
								</p>
								<p className="text-xs text-brand-muted">
									Customer: {row.customerName} | Staff: {row.staffName || "-"} | Program: {row.programName || "-"}
								</p>
								<p className="text-xs text-brand-muted">
									Location: {row.locationName} | Bill: {row.billReference || "-"}
								</p>
								<p className="text-xs text-brand-muted">{new Date(row.createdAt).toLocaleString("en-ZA")}</p>
							</li>
						))}
					</ul>
				)}

				{transactions.data.total > PAGE_SIZE && (
					<div className="mt-3 flex justify-between text-sm">
						<button
							type="button"
							disabled={filters.offset === 0}
							onClick={() =>
								setFilters((value) => ({ ...value, offset: Math.max(0, value.offset - PAGE_SIZE) }))
							}
							className="text-brand-secondary underline disabled:opacity-40"
						>
							Newer
						</button>
						<button
							type="button"
							disabled={filters.offset + PAGE_SIZE >= transactions.data.total}
							onClick={() =>
								setFilters((value) => ({ ...value, offset: value.offset + PAGE_SIZE }))
							}
							className="text-brand-secondary underline disabled:opacity-40"
						>
							Older
						</button>
					</div>
				)}
			</AdminPanel>
		</main>
	);
}
