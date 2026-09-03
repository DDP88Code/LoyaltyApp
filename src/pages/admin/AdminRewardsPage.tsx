import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import {
	useAdminRewards,
	useCreateRewardDefinition,
	useDeleteRewardDefinition,
	useUpdateRewardDefinition,
	type RewardDefinitionInput,
} from "@/features/admin/core/api";
import { AdminPanel } from "@/features/admin/core/widgets";

const EMPTY_FORM: RewardDefinitionInput = {
	name: "",
	description: null,
	rewardType: "voucher",
	valueCents: null,
	pointsCost: null,
	itemReference: null,
	validDays: null,
	welcomeReward: false,
	active: true,
	terms: null,
};

export function AdminRewardsPage() {
	const rewardsQuery = useAdminRewards();
	const createReward = useCreateRewardDefinition();
	const updateReward = useUpdateRewardDefinition();
	const deleteReward = useDeleteRewardDefinition();
	const [selectedRewardId, setSelectedRewardId] = useState("");
	const [form, setForm] = useState<RewardDefinitionInput>(EMPTY_FORM);
	const [valueRand, setValueRand] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const selectedReward = useMemo(
		() => rewardsQuery.data?.rewards.find((reward) => reward.id === selectedRewardId) ?? null,
		[rewardsQuery.data?.rewards, selectedRewardId],
	);

	if (rewardsQuery.isPending) return <LoadingState label="Loading rewards..." />;
	if (rewardsQuery.isError) {
		return (
			<main className="p-6">
				<ErrorState
					title="Could not load reward definitions"
					description={rewardsQuery.error.message}
					onRetry={() => void rewardsQuery.refetch()}
				/>
			</main>
		);
	}

	const rewards = rewardsQuery.data.rewards;

	function selectReward(rewardId: string) {
		setError(null);
		setSuccess(null);
		setSelectedRewardId(rewardId);
		const reward = rewards.find((row) => row.id === rewardId);
		if (!reward) return;
		setValueRand(
			reward.valueCents == null ? "" : (reward.valueCents / 100).toFixed(2),
		);
		setForm({
			name: reward.name,
			description: reward.description,
			rewardType: reward.rewardType,
			valueCents: reward.valueCents,
			pointsCost: reward.pointsCost,
			itemReference: reward.itemReference,
			validDays: reward.validDays,
			welcomeReward: reward.welcomeReward,
			active: reward.active,
			terms: reward.terms,
		});
	}

	async function save() {
		setError(null);
		setSuccess(null);
		try {
			const hasRandValue = valueRand.trim().length > 0;
			const parsedRand = hasRandValue ? Number(valueRand.trim()) : null;
			if (hasRandValue && (parsedRand === null || !Number.isFinite(parsedRand) || parsedRand < 0)) {
				throw new Error("Value must be a valid Rand amount, for example 50 or 50.00.");
			}
			const nextValueCents =
				parsedRand == null ? null : Math.round(parsedRand * 100);

			if (selectedRewardId) {
				await updateReward.mutateAsync({
					id: selectedRewardId,
					...form,
					valueCents: nextValueCents,
				});
				setSuccess("Reward updated.");
			} else {
				await createReward.mutateAsync({
					...form,
					valueCents: nextValueCents,
				});
				setSuccess("Reward created.");
			}
			await rewardsQuery.refetch();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not save reward.");
		}
	}

	async function remove() {
		if (!selectedRewardId) return;
		setError(null);
		setSuccess(null);
		try {
			await deleteReward.mutateAsync(selectedRewardId);
			setSelectedRewardId("");
			setForm(EMPTY_FORM);
			setValueRand("");
			setSuccess("Reward deleted.");
			await rewardsQuery.refetch();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not delete reward.");
		}
	}

	const pending = createReward.isPending || updateReward.isPending || deleteReward.isPending;

	return (
		<main className="mx-auto w-full max-w-7xl p-6">
			<PageHeader
				title="Rewards"
				subtitle="Create and maintain reward definitions, welcome reward flags, values, and validity rules."
			/>
			<div className="grid gap-4 xl:grid-cols-[320px_1fr]">
				<AdminPanel title="Reward definitions">
					<Button
						variant="outline"
						onClick={() => {
							setError(null);
							setSuccess(null);
							setSelectedRewardId("");
							setForm(EMPTY_FORM);
							setValueRand("");
						}}
					>
						New reward
					</Button>
					{rewards.length === 0 ? (
						<EmptyState title="No rewards" />
					) : (
						<ul className="mt-3 grid gap-2">
							{rewards.map((reward) => (
								<li key={reward.id}>
									<button
										type="button"
										onClick={() => selectReward(reward.id)}
										className="w-full rounded-lg border border-brand-border px-3 py-2 text-left hover:bg-brand-surface-raised"
									>
										<p className="font-medium">{reward.name}</p>
										<p className="text-xs text-brand-muted">
											{reward.rewardType} | {reward.active ? "Active" : "Inactive"}
										</p>
									</button>
								</li>
							))}
						</ul>
					)}
				</AdminPanel>

				<AdminPanel
					title={selectedReward ? "Edit reward" : "Create reward"}
					description={
						selectedReward
							? `Editing ${selectedReward.name}`
							: "Create mode: enter details and save to add a new reward."
					}
				>
					<div className="grid gap-3 md:grid-cols-2">
						<Input
							label="Name"
							value={form.name}
							onChange={(event) => setForm((v) => ({ ...v, name: event.target.value }))}
						/>
						<Input
							label="Description"
							value={form.description ?? ""}
							onChange={(event) =>
								setForm((v) => ({ ...v, description: event.target.value || null }))
							}
						/>
						<div className="grid gap-1">
							<label className="text-sm font-medium" htmlFor="rewardType">Reward type</label>
							<select
								id="rewardType"
								value={form.rewardType}
								onChange={(event) =>
									setForm((v) => ({
										...v,
										rewardType: event.target.value as RewardDefinitionInput["rewardType"],
									}))
								}
								className="min-h-12 rounded-xl border border-brand-border bg-brand-surface px-3"
							>
								<option value="free_item">free_item</option>
								<option value="voucher">voucher</option>
								<option value="discount">discount</option>
								<option value="points_reward">points_reward</option>
							</select>
						</div>
						<Input
							label="Value (Rand)"
							type="number"
							step="0.01"
							min="0"
							value={valueRand}
							onChange={(event) =>
								setValueRand(event.target.value)
							}
							hint="Example: 50.00 will be stored as 5000 cents."
						/>
						<Input
							label="Points cost"
							type="number"
							value={form.pointsCost?.toString() ?? ""}
							onChange={(event) =>
								setForm((v) => ({
									...v,
									pointsCost: event.target.value ? Number(event.target.value) : null,
								}))
							}
						/>
						<Input
							label="Item reference"
							value={form.itemReference ?? ""}
							onChange={(event) =>
								setForm((v) => ({ ...v, itemReference: event.target.value || null }))
							}
						/>
						<Input
							label="Validity days"
							type="number"
							value={form.validDays?.toString() ?? ""}
							onChange={(event) =>
								setForm((v) => ({
									...v,
									validDays: event.target.value ? Number(event.target.value) : null,
								}))
							}
						/>
						<Input
							label="Terms"
							value={form.terms ?? ""}
							onChange={(event) =>
								setForm((v) => ({ ...v, terms: event.target.value || null }))
							}
						/>
						<label className="inline-flex min-h-10 items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={form.welcomeReward}
								onChange={(event) =>
									setForm((v) => ({ ...v, welcomeReward: event.target.checked }))
								}
								className="size-4 accent-brand-primary"
							/>
							<span>Welcome reward</span>
						</label>
						<label className="inline-flex min-h-10 items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={form.active}
								onChange={(event) =>
									setForm((v) => ({ ...v, active: event.target.checked }))
								}
								className="size-4 accent-brand-primary"
							/>
							<span>Active</span>
						</label>
					</div>

					{error && <p className="mt-3 text-sm text-brand-danger">{error}</p>}
					{success && <p className="mt-3 text-sm text-brand-success">{success}</p>}
					<div className="mt-4 flex gap-2">
						<Button loading={pending} onClick={() => void save()}>
							{selectedReward ? "Save reward" : "Create reward"}
						</Button>
						{selectedReward && (
							<Button
								variant="danger"
								loading={deleteReward.isPending}
								onClick={() => void remove()}
							>
								Delete
							</Button>
						)}
					</div>
				</AdminPanel>
			</div>
		</main>
	);
}
