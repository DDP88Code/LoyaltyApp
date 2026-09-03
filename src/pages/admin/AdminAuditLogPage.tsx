import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useAdminAuditLogs } from "@/features/admin/core/api";
import { AdminPanel, AdminStatCard } from "@/features/admin/core/widgets";

const PAGE_SIZE = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function valueText(value: unknown): string {
	if (value === null || value === undefined) return "Not set";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (typeof value === "number" || typeof value === "string") return String(value);
	if (Array.isArray(value)) return value.length === 0 ? "[]" : value.join(", ");
	return JSON.stringify(value);
}

function buildFieldDiff(
	oldValue: unknown,
	newValue: unknown,
): Array<{ field: string; before: string; after: string }> {
	if (!isRecord(oldValue) || !isRecord(newValue)) return [];

	const fields = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
	const rows: Array<{ field: string; before: string; after: string }> = [];

	for (const field of fields) {
		const before = oldValue[field];
		const after = newValue[field];
		if (JSON.stringify(before) === JSON.stringify(after)) continue;
		rows.push({ field, before: valueText(before), after: valueText(after) });
	}

	return rows;
}

function summaryForAction(action: string, entityType: string, changesCount: number): string {
	if (changesCount > 0) {
		return `${changesCount} field${changesCount === 1 ? "" : "s"} changed`;
	}
	if (action.endsWith(".created")) return `Created ${entityType}`;
	if (action.endsWith(".updated")) return `Updated ${entityType}`;
	if (action.endsWith(".deleted")) return `Deleted ${entityType}`;
	return "No field-level changes captured";
}

export function AdminAuditLogPage() {
	const [expandedId, setExpandedId] = useState<string | null>(null);
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
	const entryDiffs = new Map(
		entries.map((entry) => [entry.id, buildFieldDiff(entry.oldValueJson, entry.newValueJson)]),
	);
	const entriesWithChanges = entries.filter((entry) => (entryDiffs.get(entry.id)?.length ?? 0) > 0).length;

	return (
		<main className="mx-auto w-full max-w-7xl p-6">
			<PageHeader
				title="Audit Log"
				subtitle="Trace actor, role, action, entity, payload deltas, and metadata."
			/>

			<section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<AdminStatCard title="Filtered Entries" value={String(entries.length)} />
				<AdminStatCard title="Total Matching" value={String(logs.data.total)} />
				<AdminStatCard title="With Field Changes" value={String(entriesWithChanges)} />
				<AdminStatCard title="Window Size" value={String(PAGE_SIZE)} subtitle="per page" />
			</section>

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
								<p className="font-medium">{entry.action}</p>
								<p className="text-xs text-brand-muted">
									{new Date(entry.createdAt).toLocaleString("en-ZA")} | Actor: {entry.actorName || entry.actorUserId} ({entry.actorRole})
								</p>
								<p className="text-xs text-brand-muted">
									Entity: {entry.entityType} {entry.entityId ? `| ${entry.entityId}` : ""}
								</p>
								<p className="mt-1 text-sm text-brand-muted">
									Summary: {summaryForAction(entry.action, entry.entityType, entryDiffs.get(entry.id)?.length ?? 0)}
								</p>

								<button
									type="button"
									onClick={() => setExpandedId((value) => (value === entry.id ? null : entry.id))}
									className="mt-2 text-xs text-brand-secondary underline"
								>
									{expandedId === entry.id ? "Hide details" : "View details"}
								</button>

								{expandedId === entry.id && (
									<div className="mt-3 grid gap-2">
										{(entryDiffs.get(entry.id)?.length ?? 0) > 0 && (
											<div className="rounded border border-brand-border/70 bg-brand-background/40 p-2">
												<p className="text-xs font-medium uppercase tracking-wide text-brand-muted">Field changes</p>
												<ul className="mt-2 grid gap-1 text-xs">
													{entryDiffs.get(entry.id)?.map((row) => (
														<li key={row.field}>
															<span className="font-medium">{row.field}</span>: {row.before}{" -> "}{row.after}
														</li>
													))}
												</ul>
											</div>
										)}
										{entry.oldValueJson !== undefined && entry.oldValueJson !== null && (
											<pre className="overflow-x-auto rounded bg-brand-background/60 p-2 text-xs">
												OLD: {JSON.stringify(entry.oldValueJson, null, 2)}
											</pre>
										)}
										{entry.newValueJson !== undefined && entry.newValueJson !== null && (
											<pre className="overflow-x-auto rounded bg-brand-background/60 p-2 text-xs">
												NEW: {JSON.stringify(entry.newValueJson, null, 2)}
											</pre>
										)}
										{entry.metadataJson !== undefined && entry.metadataJson !== null && (
											<pre className="overflow-x-auto rounded bg-brand-background/60 p-2 text-xs">
												META: {JSON.stringify(entry.metadataJson, null, 2)}
											</pre>
										)}
									</div>
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
