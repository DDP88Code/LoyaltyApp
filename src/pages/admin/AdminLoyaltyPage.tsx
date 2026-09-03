import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import {
	useAdminLoyaltyPrograms,
	useUpdateRewardDefinition,
	useUpdateLoyaltyProgram,
} from "@/features/admin/core/api";
import { AdminPanel } from "@/features/admin/core/widgets";

export function AdminLoyaltyPage() {
	const programsQuery = useAdminLoyaltyPrograms();
	const updateProgram = useUpdateLoyaltyProgram();
	const updateReward = useUpdateRewardDefinition();
	const [selectedProgramId, setSelectedProgramId] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const selectedProgram = useMemo(
		() =>
			programsQuery.data?.programs.find((program) => program.id === selectedProgramId) ??
			null,
		[programsQuery.data?.programs, selectedProgramId],
	);

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [threshold, setThreshold] = useState("");
	const [rewardId, setRewardId] = useState("");
	const [validDays, setValidDays] = useState("");
	const [sortOrder, setSortOrder] = useState("0");
	const [active, setActive] = useState(true);
	const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

	if (programsQuery.isPending) return <LoadingState label="Loading programs..." />;
	if (programsQuery.isError) {
		return (
			<main className="p-6">
				<ErrorState
					title="Could not load loyalty programs"
					description={programsQuery.error.message}
					onRetry={() => void programsQuery.refetch()}
				/>
			</main>
		);
	}

	const programs = programsQuery.data.programs;
	const rewards = programsQuery.data.rewardOptions;
	const locations = programsQuery.data.locations;
	const selectedReward = rewards.find((reward) => reward.id === rewardId) ?? null;

	function loadProgram(programId: string) {
		setError(null);
		setSuccess(null);
		setSelectedProgramId(programId);
		const program = programs.find((row) => row.id === programId);
		if (!program) return;
		setName(program.name);
		setDescription(program.description ?? "");
		setThreshold(program.qualifyingPurchasesRequired?.toString() ?? "");
		setRewardId(program.rewardDefinitionId ?? "");
		setValidDays(program.rewardValidDays?.toString() ?? "");
		setSortOrder(String(program.sortOrder));
		setActive(program.active);
		setSelectedLocations(program.locationIds);
	}

	async function saveProgram() {
		if (!selectedProgramId) return;
		setError(null);
		setSuccess(null);
		try {
			const nextValidDays = validDays.trim() ? Number(validDays) : null;
			if (validDays.trim() && Number.isNaN(nextValidDays)) {
				throw new Error("Reward validity days must be a number.");
			}

			await updateProgram.mutateAsync({
				id: selectedProgramId,
				name: name.trim(),
				description: description.trim() || null,
				qualifyingPurchasesRequired: threshold ? Number(threshold) : null,
				rewardDefinitionId: rewardId || null,
				sortOrder: Number(sortOrder),
				active,
				locationIds: selectedLocations,
			});

			if (
				rewardId &&
				selectedReward &&
				selectedReward.validDays !== nextValidDays
			) {
				await updateReward.mutateAsync({
					id: rewardId,
					validDays: nextValidDays,
				});
			}

			await programsQuery.refetch();
			setSuccess("Program settings saved.");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not save program.");
		}
	}

	return (
		<main className="mx-auto w-full max-w-7xl p-6">
			<PageHeader
				title="Loyalty"
				subtitle="Manage program activation, thresholds, reward mapping, expiry settings, and location applicability."
			/>

			{programs.length === 0 ? (
				<EmptyState title="No loyalty programs found" />
			) : (
				<div className="grid gap-4 xl:grid-cols-[320px_1fr]">
					<AdminPanel title="Programs">
						<ul className="grid gap-2">
							{programs.map((program) => (
								<li key={program.id}>
									<button
										type="button"
										onClick={() => loadProgram(program.id)}
										className="w-full rounded-lg border border-brand-border px-3 py-2 text-left hover:bg-brand-surface-raised"
									>
										<p className="font-medium">{program.name}</p>
										<p className="text-xs text-brand-muted">
											{program.active ? "Active" : "Inactive"} | {program.programType}
										</p>
									</button>
								</li>
							))}
						</ul>
					</AdminPanel>

					<AdminPanel
						title="Program editor"
						description={
							selectedProgram
								? `Editing ${selectedProgram.name}`
								: "Select a program to edit activation, threshold, reward, and validity."
						}
					>
						{!selectedProgram ? (
							<EmptyState title="Select a program to edit" />
						) : (
							<div className="grid gap-3">
								<Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
								<Input
									label="Description"
									value={description}
									onChange={(e) => setDescription(e.target.value)}
								/>
								<Input
									label="Coffee threshold"
									type="number"
									value={threshold}
									onChange={(e) => setThreshold(e.target.value)}
								/>

								<div className="grid gap-1">
									<label className="text-sm font-medium" htmlFor="rewardDefinitionId">
										Reward definition
									</label>
									<select
										id="rewardDefinitionId"
										value={rewardId}
										onChange={(event) => {
											setRewardId(event.target.value);
											const chosen = rewards.find(
												(row) => row.id === event.target.value,
											);
											setValidDays(chosen?.validDays?.toString() ?? "");
										}}
										className="min-h-12 rounded-xl border border-brand-border bg-brand-surface px-3"
									>
										<option value="">Select reward</option>
										{rewards.map((reward) => (
											<option key={reward.id} value={reward.id}>
												{reward.name}
											</option>
										))}
									</select>
								</div>

								<Input
									label="Reward validity days"
									type="number"
									value={validDays}
									onChange={(e) => setValidDays(e.target.value)}
									hint="Updates the selected reward definition expiry."
								/>
								<Input
									label="Points cost (future points mode)"
									value={selectedReward?.pointsCost?.toString() ?? ""}
									disabled
									hint="Configured in reward definitions for points programs."
								/>
								<Input
									label="Sort order"
									type="number"
									value={sortOrder}
									onChange={(e) => setSortOrder(e.target.value)}
								/>

								<label className="inline-flex min-h-10 items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={active}
										onChange={(e) => setActive(e.target.checked)}
										className="size-4 accent-brand-primary"
									/>
									<span>Program active</span>
								</label>

								<div className="grid gap-2">
									<p className="text-sm font-medium">Location applicability</p>
									{locations.map((location) => {
										const checked = selectedLocations.includes(location.id);
										return (
											<label
												key={location.id}
												className="inline-flex min-h-10 items-center gap-2 text-sm"
											>
												<input
													type="checkbox"
													checked={checked}
													onChange={(event) => {
														setSelectedLocations((current) => {
															if (event.target.checked) {
																return [...current, location.id];
															}
															return current.filter((value) => value !== location.id);
														});
													}}
													className="size-4 accent-brand-primary"
												/>
												<span>{location.name}</span>
											</label>
										);
									})}
								</div>

								{error && <p className="text-sm text-brand-danger">{error}</p>}
								{success && <p className="text-sm text-brand-success">{success}</p>}
								<Button
									loading={updateProgram.isPending || updateReward.isPending}
									onClick={() => void saveProgram()}
								>
									Save program
								</Button>
							</div>
						)}
					</AdminPanel>
				</div>
			)}
		</main>
	);
}
