import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import {
	useAdminStaff,
	useCreateStaff,
	useUpdateStaff,
	type StaffInput,
} from "@/features/admin/core/api";
import { AdminPanel } from "@/features/admin/core/widgets";

const PAGE_SIZE = 20;

const NEW_STAFF: StaffInput = {
	fullName: "",
	email: "",
	mobileNumber: null,
	role: "staff",
	assignedLocationId: null,
	active: true,
};

export function AdminStaffPage() {
	const [search, setSearch] = useState("");
	const [offset, setOffset] = useState(0);
	const [form, setForm] = useState<StaffInput>(NEW_STAFF);
	const [editingId, setEditingId] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const staffQuery = useAdminStaff({ search, limit: PAGE_SIZE, offset });
	const createStaff = useCreateStaff();
	const updateStaff = useUpdateStaff();

	if (staffQuery.isPending) return <LoadingState label="Loading staff..." />;
	if (staffQuery.isError) {
		return (
			<main className="p-6">
				<ErrorState
					title="Could not load staff"
					description={staffQuery.error.message}
					onRetry={() => void staffQuery.refetch()}
				/>
			</main>
		);
	}

	const rows = staffQuery.data.staff;
	const locations = staffQuery.data.locations;

	function loadForEdit(staffId: string) {
		setError(null);
		setSuccess(null);
		setEditingId(staffId);
		const member = rows.find((row) => row.id === staffId);
		if (!member) return;
		if (member.role === "owner") {
			setEditingId("");
			setError("Owner accounts cannot be edited from this form.");
			return;
		}
		setForm({
			fullName: member.fullName,
			email: member.email,
			mobileNumber: member.mobileNumber ?? null,
			role: member.role === "admin" ? "admin" : "staff",
			assignedLocationId: member.assignedLocationId,
			active: member.active,
		});
	}

	async function save() {
		setError(null);
		setSuccess(null);
		try {
			if (editingId) {
				await updateStaff.mutateAsync({ id: editingId, ...form });
				setSuccess("Staff profile updated.");
			} else {
				await createStaff.mutateAsync(form);
				setSuccess(
					"Staff access assigned. If the account already existed, it has been promoted by email.",
				);
			}
			setForm(NEW_STAFF);
			setEditingId("");
			await staffQuery.refetch();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not save staff profile.");
		}
	}

	return (
		<main className="mx-auto w-full max-w-7xl p-6">
			<PageHeader
				title="Staff"
				subtitle="Assign staff access by email, set locations, and enforce role elevation controls."
			/>

			<div className="grid gap-4 xl:grid-cols-[340px_1fr]">
				<AdminPanel
					title="Staff list"
					description="Use create for new assignments, or select a staff/admin profile to edit."
				>
					<Input
						label="Search"
						value={search}
						onChange={(event) => {
							setSearch(event.target.value);
							setOffset(0);
						}}
					/>
					{rows.length === 0 ? (
						<EmptyState title="No staff found" />
					) : (
						<ul className="mt-3 grid gap-2">
							{rows.map((member) => (
								<li key={member.id}>
									<button
										type="button"
										onClick={() => loadForEdit(member.id)}
										className="w-full rounded-lg border border-brand-border px-3 py-2 text-left hover:bg-brand-surface-raised"
									>
										<p className="font-medium">{member.fullName}</p>
										<p className="text-xs text-brand-muted">{member.email}</p>
										<p className="text-xs text-brand-muted capitalize">
											{member.role} | {member.active ? "Active" : "Inactive"}
										</p>
									</button>
								</li>
							))}
						</ul>
					)}

					{staffQuery.data.total > PAGE_SIZE && (
						<div className="mt-3 flex justify-between text-sm">
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
								disabled={offset + PAGE_SIZE >= staffQuery.data.total}
								onClick={() => setOffset((value) => value + PAGE_SIZE)}
								className="text-brand-secondary underline disabled:opacity-40"
							>
								Older
							</button>
						</div>
					)}
				</AdminPanel>

				<AdminPanel title={editingId ? "Edit staff profile" : "Create staff profile"}>
					<div className="grid gap-3 md:grid-cols-2">
						{!editingId && (
							<p className="md:col-span-2 rounded-lg border border-brand-border bg-brand-background/30 p-3 text-sm text-brand-muted">
								Enter an existing account email to promote/assign it. If the email has not registered yet,
								 ask them to sign up first, then retry.
							</p>
						)}
						<Input
							label="Full name"
							value={form.fullName}
							onChange={(event) =>
								setForm((value) => ({ ...value, fullName: event.target.value }))
							}
						/>
						<Input
							label="Email"
							type="email"
							value={form.email}
							onChange={(event) =>
								setForm((value) => ({ ...value, email: event.target.value }))
							}
						/>
						<Input
							label="Mobile"
							value={form.mobileNumber ?? ""}
							onChange={(event) =>
								setForm((value) => ({
									...value,
									mobileNumber: event.target.value || null,
								}))
							}
						/>
						<div className="grid gap-1">
							<label className="text-sm font-medium" htmlFor="staffRole">Role</label>
							<select
								id="staffRole"
								value={form.role}
								onChange={(event) =>
									setForm((value) => ({
										...value,
										role: event.target.value as StaffInput["role"],
									}))
								}
								className="min-h-12 rounded-xl border border-brand-border bg-brand-surface px-3"
							>
								<option value="staff">staff</option>
								<option value="admin">admin</option>
							</select>
						</div>
						<div className="grid gap-1">
							<label className="text-sm font-medium" htmlFor="assignedLocation">
								Assigned location
							</label>
							<select
								id="assignedLocation"
								value={form.assignedLocationId ?? ""}
								onChange={(event) =>
									setForm((value) => ({
										...value,
										assignedLocationId: event.target.value || null,
									}))
								}
								className="min-h-12 rounded-xl border border-brand-border bg-brand-surface px-3"
							>
								<option value="">Unassigned</option>
								{locations.map((location) => (
									<option key={location.id} value={location.id}>
										{location.name}
									</option>
								))}
							</select>
						</div>
						<label className="inline-flex min-h-10 items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={form.active}
								onChange={(event) =>
									setForm((value) => ({ ...value, active: event.target.checked }))
								}
								className="size-4 accent-brand-primary"
							/>
							<span>Active</span>
						</label>
					</div>

					{error && <p className="mt-2 text-sm text-brand-danger">{error}</p>}
					{success && <p className="mt-2 text-sm text-brand-success">{success}</p>}
					<div className="mt-3 flex gap-2">
						<Button
							loading={createStaff.isPending || updateStaff.isPending}
							onClick={() => void save()}
						>
							{editingId ? "Save profile" : "Assign staff access"}
						</Button>
						{editingId && (
							<Button
								variant="outline"
								onClick={() => {
									setError(null);
									setSuccess(null);
									setEditingId("");
									setForm(NEW_STAFF);
								}}
							>
								New
							</Button>
						)}
					</div>
				</AdminPanel>
			</div>
		</main>
	);
}
