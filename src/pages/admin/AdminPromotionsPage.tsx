import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import {
	useAdminPromotions,
	useCreatePromotion,
	useDeletePromotion,
	useDeletePromotionImage,
	type PromotionInput,
	useUpdatePromotion,
	useUploadPromotionImage,
} from "@/features/admin/promotions/api";
import { mediaObjectUrl } from "@/lib/media";

interface PromotionFormState {
	title: string;
	subtitle: string;
	description: string;
	startAt: string;
	endAt: string;
	active: boolean;
	ctaText: string;
	ctaUrl: string;
	imageKey: string | null;
}

const EMPTY_FORM: PromotionFormState = {
	title: "",
	subtitle: "",
	description: "",
	startAt: "",
	endAt: "",
	active: true,
	ctaText: "",
	ctaUrl: "",
	imageKey: null,
};

function toLocalDateTimeInput(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	const pad = (value: number) => value.toString().padStart(2, "0");
	const year = date.getFullYear();
	const month = pad(date.getMonth() + 1);
	const day = pad(date.getDate());
	const hour = pad(date.getHours());
	const minute = pad(date.getMinutes());
	return `${year}-${month}-${day}T${hour}:${minute}`;
}

function nowPlus(minutes: number): string {
	const date = new Date(Date.now() + minutes * 60_000);
	return toLocalDateTimeInput(date.toISOString());
}

function toPayload(form: PromotionFormState): PromotionInput {
	return {
		title: form.title.trim(),
		subtitle: form.subtitle.trim() || null,
		description: form.description.trim() || null,
		imageKey: form.imageKey,
		startAt: new Date(form.startAt).toISOString(),
		endAt: new Date(form.endAt).toISOString(),
		active: form.active,
		ctaText: form.ctaText.trim() || null,
		ctaUrl: form.ctaUrl.trim() || null,
	};
}

function messageFromError(error: unknown): string {
	if (error instanceof Error) return error.message;
	return "Something went wrong. Please try again.";
}

function StatusBadge({ startAt, endAt, active }: { startAt: string; endAt: string; active: boolean }) {
	if (!active) return <Badge tone="danger">Inactive</Badge>;
	const now = Date.now();
	const start = new Date(startAt).getTime();
	const end = new Date(endAt).getTime();
	if (start > now) return <Badge tone="primary">Scheduled</Badge>;
	if (end < now) return <Badge tone="danger">Expired</Badge>;
	return <Badge tone="success">Live</Badge>;
}

export function AdminPromotionsPage() {
	const promotionsQuery = useAdminPromotions();
	const createPromotion = useCreatePromotion();
	const updatePromotion = useUpdatePromotion();
	const deletePromotion = useDeletePromotion();
	const uploadPromotionImage = useUploadPromotionImage();
	const deletePromotionImage = useDeletePromotionImage();

	const promotions = promotionsQuery.data?.promotions ?? [];

	const [selectedPromotionId, setSelectedPromotionId] = useState<string>("");
	const [form, setForm] = useState<PromotionFormState>(EMPTY_FORM);
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [removeImage, setRemoveImage] = useState(false);
	const [formError, setFormError] = useState<string | null>(null);

	const selectedPromotion = useMemo(
		() =>
			promotions.find((promotion) => promotion.id === selectedPromotionId) ?? null,
		[promotions, selectedPromotionId],
	);

	useEffect(() => {
		if (!selectedPromotion) {
			setForm({
				...EMPTY_FORM,
				startAt: nowPlus(-15),
				endAt: nowPlus(60 * 24 * 7),
			});
			setImageFile(null);
			setRemoveImage(false);
			return;
		}
		setForm({
			title: selectedPromotion.title,
			subtitle: selectedPromotion.subtitle ?? "",
			description: selectedPromotion.description ?? "",
			startAt: toLocalDateTimeInput(selectedPromotion.startAt),
			endAt: toLocalDateTimeInput(selectedPromotion.endAt),
			active: selectedPromotion.active,
			ctaText: selectedPromotion.ctaText ?? "",
			ctaUrl: selectedPromotion.ctaUrl ?? "",
			imageKey: selectedPromotion.imageKey,
		});
		setImageFile(null);
		setRemoveImage(false);
	}, [selectedPromotion]);

	async function maybeUploadImage(file: File | null): Promise<string | null> {
		if (!file) return null;
		const uploaded = await uploadPromotionImage.mutateAsync(file);
		return uploaded.imageKey;
	}

	async function onSavePromotion() {
		setFormError(null);
		if (!form.title.trim()) {
			setFormError("Title is required.");
			return;
		}
		if (!form.startAt || !form.endAt) {
			setFormError("Start and end times are required.");
			return;
		}

		let uploadedKey: string | null = null;
		try {
			uploadedKey = await maybeUploadImage(imageFile);
			const nextImageKey = uploadedKey
				? uploadedKey
				: removeImage
					? null
					: form.imageKey;
			const payload = toPayload({ ...form, imageKey: nextImageKey });

			if (selectedPromotionId) {
				await updatePromotion.mutateAsync({ id: selectedPromotionId, ...payload });
			} else {
				const created = await createPromotion.mutateAsync(payload);
				setSelectedPromotionId(created.id);
			}

			setImageFile(null);
			setRemoveImage(false);
		} catch (error) {
			if (uploadedKey) {
				await deletePromotionImage.mutateAsync(uploadedKey).catch(() => undefined);
			}
			setFormError(messageFromError(error));
		}
	}

	async function onDeletePromotion() {
		if (!selectedPromotionId) return;
		setFormError(null);
		try {
			await deletePromotion.mutateAsync(selectedPromotionId);
			setSelectedPromotionId("");
		} catch (error) {
			setFormError(messageFromError(error));
		}
	}

	const loadingMutation =
		createPromotion.isPending ||
		updatePromotion.isPending ||
		deletePromotion.isPending ||
		uploadPromotionImage.isPending;

	return (
		<main className="mx-auto w-full max-w-6xl p-6">
			<PageHeader
				title="Promotions"
				subtitle="Schedule, activate, and retire promotions safely."
				actions={
					<Link to="/admin/menu" className="text-sm text-brand-secondary underline">
						Go to menu
					</Link>
				}
			/>

			{promotionsQuery.isPending && <LoadingState label="Loading promotions..." />}
			{promotionsQuery.isError && (
				<ErrorState
					title="Could not load promotions"
					description={promotionsQuery.error.message}
					onRetry={() => void promotionsQuery.refetch()}
				/>
			)}

			{!promotionsQuery.isPending && !promotionsQuery.isError && (
				<div className="grid gap-6 lg:grid-cols-2">
					<Card>
						<CardTitle>Promotion Editor</CardTitle>
						<CardDescription>
							Create, edit, schedule, deactivate, and delete promotions.
						</CardDescription>

						<div className="mt-4 flex flex-col gap-3">
							<label className="text-sm font-medium" htmlFor="promotionSelect">
								Edit existing promotion
							</label>
							<select
								id="promotionSelect"
								className="min-h-12 rounded-xl border border-brand-border bg-brand-surface px-3"
								value={selectedPromotionId}
								onChange={(event) => setSelectedPromotionId(event.target.value)}
							>
								<option value="">Create new promotion</option>
								{promotions.map((promotion) => (
									<option key={promotion.id} value={promotion.id}>
										{promotion.title}
									</option>
								))}
							</select>

							<Input
								label="Title"
								value={form.title}
								onChange={(event) =>
									setForm((current) => ({ ...current, title: event.target.value }))
								}
							/>
							<Input
								label="Subtitle"
								value={form.subtitle}
								onChange={(event) =>
									setForm((current) => ({ ...current, subtitle: event.target.value }))
								}
							/>
							<Input
								label="Description"
								value={form.description}
								onChange={(event) =>
									setForm((current) => ({
										...current,
										description: event.target.value,
									}))
								}
							/>
							<Input
								label="Start"
								type="datetime-local"
								value={form.startAt}
								onChange={(event) =>
									setForm((current) => ({ ...current, startAt: event.target.value }))
								}
							/>
							<Input
								label="End"
								type="datetime-local"
								value={form.endAt}
								onChange={(event) =>
									setForm((current) => ({ ...current, endAt: event.target.value }))
								}
							/>
							<label className="inline-flex min-h-10 items-center gap-2 text-sm">
								<input
									type="checkbox"
									checked={form.active}
									onChange={(event) =>
										setForm((current) => ({
											...current,
											active: event.target.checked,
										}))
									}
									className="size-4 accent-brand-primary"
								/>
								<span>Active</span>
							</label>

							<Input
								label="CTA text"
								value={form.ctaText}
								hint="Leave CTA text and URL blank to hide the action button."
								onChange={(event) =>
									setForm((current) => ({ ...current, ctaText: event.target.value }))
								}
							/>
							<Input
								label="CTA URL"
								value={form.ctaUrl}
								onChange={(event) =>
									setForm((current) => ({ ...current, ctaUrl: event.target.value }))
								}
							/>

							{form.imageKey && !removeImage && !imageFile && (
								<img
									src={mediaObjectUrl(form.imageKey)}
									alt={form.title || "Promotion image"}
									className="h-36 w-full rounded-xl object-cover"
								/>
							)}

							<label className="text-sm font-medium" htmlFor="promotionImage">
								Promotion image
							</label>
							<input
								id="promotionImage"
								type="file"
								accept="image/png,image/jpeg,image/webp"
								onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
								className="text-sm"
							/>

							{form.imageKey && (
								<label className="inline-flex min-h-10 items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={removeImage}
										onChange={(event) => setRemoveImage(event.target.checked)}
										className="size-4 accent-brand-primary"
									/>
									<span>Remove existing image</span>
								</label>
							)}

							<div className="flex flex-wrap gap-3">
								<Button onClick={() => void onSavePromotion()} loading={loadingMutation}>
									{selectedPromotionId ? "Save promotion" : "Create promotion"}
								</Button>
								<Button
									variant="outline"
									onClick={() => setSelectedPromotionId("")}
								>
									New
								</Button>
								{selectedPromotionId && (
									<Button
										variant="danger"
										onClick={() => void onDeletePromotion()}
										loading={deletePromotion.isPending}
									>
										Delete
									</Button>
								)}
							</div>
						</div>
					</Card>

					<Card>
						<CardTitle>Scheduled Promotions</CardTitle>
						<CardDescription>
							Only active promotions within the current time window appear to customers.
						</CardDescription>
						{promotions.length === 0 ? (
							<EmptyState
								title="No promotions yet"
								description="Create your first promotion to feature on customer home."
							/>
						) : (
							<div className="mt-4 flex flex-col gap-3">
								{promotions.map((promotion) => (
									<button
										type="button"
										key={promotion.id}
										onClick={() => setSelectedPromotionId(promotion.id)}
										className="rounded-xl border border-brand-border p-3 text-left transition-colors hover:bg-brand-surface-raised"
									>
										<div className="flex items-center justify-between gap-3">
											<p className="font-medium">{promotion.title}</p>
											<StatusBadge
												startAt={promotion.startAt}
												endAt={promotion.endAt}
												active={promotion.active}
											/>
										</div>
										<p className="mt-1 text-xs text-brand-muted">
											{new Date(promotion.startAt).toLocaleString()} to {" "}
											{new Date(promotion.endAt).toLocaleString()}
										</p>
									</button>
								))}
							</div>
						)}
					</Card>
				</div>
			)}

			{formError && (
				<p role="alert" className="mt-4 text-sm text-brand-danger">
					{formError}
				</p>
			)}
		</main>
	);
}