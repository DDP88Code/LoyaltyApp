import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useAdminAuditLogs } from "@/features/admin/core/api";
import { AdminPanel } from "@/features/admin/core/widgets";

const PAGE_SIZE = 50;

export function AdminAuditLogPage() {
	const [filters, setFilters] = useState({
		action: "",
		entityType: "",
		actorRole: "",
		entityId: "",
		from: "",
		to: "",
		offset: 0,
	});

	const logs = useAdminAuditLogs({
		action: filters.action || undefined,
		entityType: filters.entityType || undefined,
		actorRole:
			(filters.actorRole as "customer" | "staff" | "admin" | "owner") || undefined,
		entityId: filters.entityId || undefined,
		from: filters.from || undefined,
		to: filters.to || undefined,
		limit: PAGE_SIZE,
		offset: filters.offset,
	});

	if (logs.isPending) return <LoadingState label="Loading audit logs..." />;
	if (logs.isError) {
		return (
			<main className="p-6">
				<ErrorState
					title="Could not load audit logs"
					description={logs.error.message}
					onRetry={() => void logs.refetch()}
				/>
			</main>
		);
	}

	const entries = logs.data.entries;

	return (
		<main className="mx-auto w-full max-w-7xl p-6">
			<PageHeader
				title="Audit Log"
				subtitle="Trace actor, role, action, entity, payload deltas, and metadata."
			/>

			<AdminPanel title="Filters">
				<div className="grid gap-3 md:grid-cols-3">
					<Input
						label="Action"
						value={filters.action}
						onChange={(event) =>
							setFilters((value) => ({ ...value, action: event.target.value, offset: 0 }))
						}
					/>
					<Input
						label="Entity type"
						value={filters.entityType}
						onChange={(event) =>
							setFilters((value) => ({ ...value, entityType: event.target.value, offset: 0 }))
						}
					/>
					<div className="grid gap-1">
						<label className="text-sm font-medium" htmlFor="actorRole">Actor role</label>
						<select
							id="actorRole"
							value={filters.actorRole}
							onChange={(event) =>
								setFilters((value) => ({ ...value, actorRole: event.target.value, offset: 0 }))
							}
							className="min-h-12 rounded-xl border border-brand-border bg-brand-surface px-3"
						>
							<option value="">All roles</option>
							<option value="customer">customer</option>
							<option value="staff">staff</option>
							<option value="admin">admin</option>
							<option value="owner">owner</option>
						</select>
					</div>
					<Input
						label="Entity id"
						value={filters.entityId}
						onChange={(event) =>
							setFilters((value) => ({ ...value, entityId: event.target.value, offset: 0 }))
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

			<AdminPanel title="Entries">
				{entries.length === 0 ? (
					<EmptyState title="No audit records found" />
				) : (
					<ul className="grid gap-2">
						{entries.map((entry) => (
							<li key={entry.id} className="rounded-lg border border-brand-border p-3 text-sm">
								<p className="font-medium">
									{entry.action} | {entry.entityType}
								</p>
								<p className="text-xs text-brand-muted">
									Actor: {entry.actorName || entry.actorUserId} ({entry.actorRole})
								</p>
								<p className="text-xs text-brand-muted">
									Entity id: {entry.entityId || "-"} | {new Date(entry.createdAt).toLocaleString("en-ZA")}
								</p>
								{entry.oldValueJson !== undefined && entry.oldValueJson !== null && (
									<pre className="mt-2 overflow-x-auto rounded bg-brand-background/60 p-2 text-xs">
										OLD: {JSON.stringify(entry.oldValueJson, null, 2)}
									</pre>
								)}
								{entry.newValueJson !== undefined && entry.newValueJson !== null && (
									<pre className="mt-2 overflow-x-auto rounded bg-brand-background/60 p-2 text-xs">
										NEW: {JSON.stringify(entry.newValueJson, null, 2)}
									</pre>
								)}
								{entry.metadataJson !== undefined && entry.metadataJson !== null && (
									<pre className="mt-2 overflow-x-auto rounded bg-brand-background/60 p-2 text-xs">
										META: {JSON.stringify(entry.metadataJson, null, 2)}
									</pre>
								)}
							</li>
						))}
					</ul>
				)}

				{logs.data.total > PAGE_SIZE && (
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
							disabled={filters.offset + PAGE_SIZE >= logs.data.total}
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
