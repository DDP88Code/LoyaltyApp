import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import {
	useAdminMenuCategories,
	useAdminMenuItems,
	useCreateMenuCategory,
	useCreateMenuItem,
	useDeleteMenuImage,
	useUpdateMenuCategory,
	useUpdateMenuItem,
	useUploadMenuImage,
} from "@/features/admin/menu/api";
import { mediaObjectUrl } from "@/lib/media";
import { formatCents } from "@/lib/money";

interface CategoryFormState {
	name: string;
	description: string;
	sortOrder: number;
	active: boolean;
	imageKey: string | null;
}

interface ItemFormState {
	categoryId: string;
	name: string;
	description: string;
	priceCents: number;
	sortOrder: number;
	active: boolean;
	available: boolean;
	popular: boolean;
	vegetarian: boolean;
	spicy: boolean;
	imageKey: string | null;
}

const EMPTY_CATEGORY_FORM: CategoryFormState = {
	name: "",
	description: "",
	sortOrder: 0,
	active: true,
	imageKey: null,
};

const EMPTY_ITEM_FORM: ItemFormState = {
	categoryId: "",
	name: "",
	description: "",
	priceCents: 0,
	sortOrder: 0,
	active: true,
	available: true,
	popular: false,
	vegetarian: false,
	spicy: false,
	imageKey: null,
};

function messageFromError(error: unknown): string {
	if (error instanceof Error) return error.message;
	return "Something went wrong. Please try again.";
}

function ToggleRow({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label className="inline-flex min-h-10 items-center gap-2 text-sm">
			<input
				type="checkbox"
				checked={checked}
				onChange={(event) => onChange(event.target.checked)}
				className="size-4 accent-brand-primary"
			/>
			<span>{label}</span>
		</label>
	);
}

export function AdminMenuPage() {
	const categoriesQuery = useAdminMenuCategories();
	const itemsQuery = useAdminMenuItems();

	const createCategory = useCreateMenuCategory();
	const updateCategory = useUpdateMenuCategory();
	const createItem = useCreateMenuItem();
	const updateItem = useUpdateMenuItem();
	const uploadImage = useUploadMenuImage();
	const deleteImage = useDeleteMenuImage();

	const categories = categoriesQuery.data?.categories ?? [];
	const items = itemsQuery.data?.items ?? [];

	const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
	const [selectedItemId, setSelectedItemId] = useState<string>("");

	const [categoryForm, setCategoryForm] =
		useState<CategoryFormState>(EMPTY_CATEGORY_FORM);
	const [itemForm, setItemForm] = useState<ItemFormState>(EMPTY_ITEM_FORM);

	const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);
	const [itemImageFile, setItemImageFile] = useState<File | null>(null);
	const [removeCategoryImage, setRemoveCategoryImage] = useState(false);
	const [removeItemImage, setRemoveItemImage] = useState(false);

	const [formError, setFormError] = useState<string | null>(null);

	const selectedCategory = useMemo(
		() => categories.find((category) => category.id === selectedCategoryId) ?? null,
		[categories, selectedCategoryId],
	);
	const selectedItem = useMemo(
		() => items.find((item) => item.id === selectedItemId) ?? null,
		[items, selectedItemId],
	);

	useEffect(() => {
		if (!selectedCategory) {
			setCategoryForm(EMPTY_CATEGORY_FORM);
			setCategoryImageFile(null);
			setRemoveCategoryImage(false);
			return;
		}
		setCategoryForm({
			name: selectedCategory.name,
			description: selectedCategory.description ?? "",
			sortOrder: selectedCategory.sortOrder,
			active: selectedCategory.active,
			imageKey: selectedCategory.imageKey,
		});
		setCategoryImageFile(null);
		setRemoveCategoryImage(false);
	}, [selectedCategory]);

	useEffect(() => {
		if (!selectedItem) {
			setItemForm((current) => ({
				...EMPTY_ITEM_FORM,
				categoryId: categories[0]?.id ?? current.categoryId,
			}));
			setItemImageFile(null);
			setRemoveItemImage(false);
			return;
		}
		setItemForm({
			categoryId: selectedItem.categoryId,
			name: selectedItem.name,
			description: selectedItem.description,
			priceCents: selectedItem.priceCents,
			sortOrder: selectedItem.sortOrder,
			active: selectedItem.active,
			available: selectedItem.available,
			popular: selectedItem.popular,
			vegetarian: selectedItem.vegetarian,
			spicy: selectedItem.spicy,
			imageKey: selectedItem.imageKey,
		});
		setItemImageFile(null);
		setRemoveItemImage(false);
	}, [selectedItem, categories]);

	useEffect(() => {
		const firstCategory = categories[0];
		if (!itemForm.categoryId && firstCategory?.id) {
			setItemForm((current) => ({ ...current, categoryId: firstCategory.id }));
		}
	}, [categories, itemForm.categoryId]);

	async function maybeUploadImage(file: File | null): Promise<string | null> {
		if (!file) return null;
		const uploaded = await uploadImage.mutateAsync(file);
		return uploaded.imageKey;
	}

	async function onSaveCategory() {
		setFormError(null);
		if (!categoryForm.name.trim()) {
			setFormError("Category name is required.");
			return;
		}

		let uploadedKey: string | null = null;
		try {
			uploadedKey = await maybeUploadImage(categoryImageFile);
			const nextImageKey = uploadedKey
				? uploadedKey
				: removeCategoryImage
					? null
					: categoryForm.imageKey;

			const payload = {
				name: categoryForm.name.trim(),
				description: categoryForm.description.trim() || null,
				sortOrder: categoryForm.sortOrder,
				active: categoryForm.active,
				imageKey: nextImageKey,
			};

			if (selectedCategoryId) {
				await updateCategory.mutateAsync({ id: selectedCategoryId, ...payload });
			} else {
				const created = await createCategory.mutateAsync(payload);
				setSelectedCategoryId(created.id);
			}

			setCategoryImageFile(null);
			setRemoveCategoryImage(false);
		} catch (error) {
			if (uploadedKey) {
				await deleteImage.mutateAsync(uploadedKey).catch(() => undefined);
			}
			setFormError(messageFromError(error));
		}
	}

	async function onSaveItem() {
		setFormError(null);
		if (!itemForm.categoryId) {
			setFormError("Select a category for this item.");
			return;
		}
		if (!itemForm.name.trim()) {
			setFormError("Item name is required.");
			return;
		}

		let uploadedKey: string | null = null;
		try {
			uploadedKey = await maybeUploadImage(itemImageFile);
			const nextImageKey = uploadedKey
				? uploadedKey
				: removeItemImage
					? null
					: itemForm.imageKey;

			const payload = {
				categoryId: itemForm.categoryId,
				name: itemForm.name.trim(),
				description: itemForm.description.trim(),
				priceCents: itemForm.priceCents,
				sortOrder: itemForm.sortOrder,
				active: itemForm.active,
				available: itemForm.available,
				popular: itemForm.popular,
				vegetarian: itemForm.vegetarian,
				spicy: itemForm.spicy,
				imageKey: nextImageKey,
			};

			if (selectedItemId) {
				await updateItem.mutateAsync({ id: selectedItemId, ...payload });
			} else {
				const created = await createItem.mutateAsync(payload);
				setSelectedItemId(created.id);
			}

			setItemImageFile(null);
			setRemoveItemImage(false);
		} catch (error) {
			if (uploadedKey) {
				await deleteImage.mutateAsync(uploadedKey).catch(() => undefined);
			}
			setFormError(messageFromError(error));
		}
	}

	const loadingInitial = categoriesQuery.isPending || itemsQuery.isPending;
	const loadingMutation =
		createCategory.isPending ||
		updateCategory.isPending ||
		createItem.isPending ||
		updateItem.isPending ||
		uploadImage.isPending;

	return (
		<main className="mx-auto w-full max-w-6xl p-6">
			<PageHeader
				title="Menu Management"
				subtitle="Categories, items, sold-out status, and secure menu image uploads."
				actions={
					<Link
						to="/admin/promotions"
						className="text-sm text-brand-secondary underline"
					>
						Go to promotions
					</Link>
				}
			/>

			{loadingInitial && <LoadingState label="Loading menu management data..." />}
			{(categoriesQuery.isError || itemsQuery.isError) && (
				<ErrorState
					title="Could not load menu data"
					description={
						categoriesQuery.error?.message ?? itemsQuery.error?.message
					}
					onRetry={() => {
						void categoriesQuery.refetch();
						void itemsQuery.refetch();
					}}
				/>
			)}

			{!loadingInitial && !categoriesQuery.isError && !itemsQuery.isError && (
				<div className="grid gap-6 lg:grid-cols-2">
					<Card>
						<CardTitle>Category Editor</CardTitle>
						<CardDescription>
							Create, rename, reorder, and activate or deactivate categories.
						</CardDescription>

						<div className="mt-4 flex flex-col gap-3">
							<label className="text-sm font-medium" htmlFor="categorySelect">
								Edit existing category
							</label>
							<select
								id="categorySelect"
								className="min-h-12 rounded-xl border border-brand-border bg-brand-surface px-3"
								value={selectedCategoryId}
								onChange={(event) => setSelectedCategoryId(event.target.value)}
							>
								<option value="">Create new category</option>
								{categories.map((category) => (
									<option key={category.id} value={category.id}>
										{category.name}
									</option>
								))}
							</select>

							<Input
								label="Name"
								value={categoryForm.name}
								onChange={(event) =>
									setCategoryForm((current) => ({
										...current,
										name: event.target.value,
									}))
								}
							/>
							<Input
								label="Description"
								value={categoryForm.description}
								onChange={(event) =>
									setCategoryForm((current) => ({
										...current,
										description: event.target.value,
									}))
								}
							/>
							<Input
								label="Sort order"
								type="number"
								value={categoryForm.sortOrder}
								onChange={(event) =>
									setCategoryForm((current) => ({
										...current,
										sortOrder: Number(event.target.value || 0),
									}))
								}
							/>

							<ToggleRow
								label="Active"
								checked={categoryForm.active}
								onChange={(checked) =>
									setCategoryForm((current) => ({ ...current, active: checked }))
								}
							/>

							{categoryForm.imageKey && !removeCategoryImage && !categoryImageFile && (
								<img
									src={mediaObjectUrl(categoryForm.imageKey)}
									alt={categoryForm.name || "Category image"}
									className="h-28 w-full rounded-xl object-cover"
								/>
							)}

							<label className="text-sm font-medium" htmlFor="categoryImage">
								Category image
							</label>
							<input
								id="categoryImage"
								type="file"
								accept="image/png,image/jpeg,image/webp"
								onChange={(event) =>
									setCategoryImageFile(event.target.files?.[0] ?? null)
								}
								className="text-sm"
							/>

							{categoryForm.imageKey && (
								<ToggleRow
									label="Remove existing image"
									checked={removeCategoryImage}
									onChange={setRemoveCategoryImage}
								/>
							)}

							<div className="flex gap-3">
								<Button
									onClick={() => void onSaveCategory()}
									loading={loadingMutation}
								>
									{selectedCategoryId ? "Save category" : "Create category"}
								</Button>
								<Button
									variant="outline"
									onClick={() => setSelectedCategoryId("")}
								>
									New
								</Button>
							</div>
						</div>
					</Card>

					<Card>
						<CardTitle>Item Editor</CardTitle>
						<CardDescription>
							Create, edit, sort, and control sold-out availability.
						</CardDescription>

						{categories.length === 0 ? (
							<EmptyState
								title="Create a category first"
								description="Items must belong to a category."
							/>
						) : (
							<div className="mt-4 flex flex-col gap-3">
								<label className="text-sm font-medium" htmlFor="itemSelect">
									Edit existing item
								</label>
								<select
									id="itemSelect"
									className="min-h-12 rounded-xl border border-brand-border bg-brand-surface px-3"
									value={selectedItemId}
									onChange={(event) => setSelectedItemId(event.target.value)}
								>
									<option value="">Create new item</option>
									{items.map((item) => (
										<option key={item.id} value={item.id}>
											{item.name}
										</option>
									))}
								</select>

								<label className="text-sm font-medium" htmlFor="itemCategory">
									Category
								</label>
								<select
									id="itemCategory"
									className="min-h-12 rounded-xl border border-brand-border bg-brand-surface px-3"
									value={itemForm.categoryId}
									onChange={(event) =>
										setItemForm((current) => ({
											...current,
											categoryId: event.target.value,
										}))
									}
								>
									{categories.map((category) => (
										<option key={category.id} value={category.id}>
											{category.name}
										</option>
									))}
								</select>

								<Input
									label="Name"
									value={itemForm.name}
									onChange={(event) =>
										setItemForm((current) => ({
											...current,
											name: event.target.value,
										}))
									}
								/>
								<Input
									label="Description"
									value={itemForm.description}
									onChange={(event) =>
										setItemForm((current) => ({
											...current,
											description: event.target.value,
										}))
									}
								/>
								<Input
									label="Price (cents)"
									type="number"
									value={itemForm.priceCents}
									onChange={(event) =>
										setItemForm((current) => ({
											...current,
											priceCents: Number(event.target.value || 0),
										}))
									}
								/>
								<Input
									label="Sort order"
									type="number"
									value={itemForm.sortOrder}
									onChange={(event) =>
										setItemForm((current) => ({
											...current,
											sortOrder: Number(event.target.value || 0),
										}))
									}
								/>

								<div className="grid grid-cols-2 gap-2">
									<ToggleRow
										label="Active"
										checked={itemForm.active}
										onChange={(checked) =>
											setItemForm((current) => ({ ...current, active: checked }))
										}
									/>
									<ToggleRow
										label="Available (sold-out off)"
										checked={itemForm.available}
										onChange={(checked) =>
											setItemForm((current) => ({ ...current, available: checked }))
										}
									/>
									<ToggleRow
										label="Popular"
										checked={itemForm.popular}
										onChange={(checked) =>
											setItemForm((current) => ({ ...current, popular: checked }))
										}
									/>
									<ToggleRow
										label="Vegetarian"
										checked={itemForm.vegetarian}
										onChange={(checked) =>
											setItemForm((current) => ({ ...current, vegetarian: checked }))
										}
									/>
									<ToggleRow
										label="Spicy"
										checked={itemForm.spicy}
										onChange={(checked) =>
											setItemForm((current) => ({ ...current, spicy: checked }))
										}
									/>
								</div>

								{itemForm.imageKey && !removeItemImage && !itemImageFile && (
									<img
										src={mediaObjectUrl(itemForm.imageKey)}
										alt={itemForm.name || "Menu item image"}
										className="h-28 w-full rounded-xl object-cover"
									/>
								)}

								<label className="text-sm font-medium" htmlFor="itemImage">
									Item image
								</label>
								<input
									id="itemImage"
									type="file"
									accept="image/png,image/jpeg,image/webp"
									onChange={(event) =>
										setItemImageFile(event.target.files?.[0] ?? null)
									}
									className="text-sm"
								/>

								{itemForm.imageKey && (
									<ToggleRow
										label="Remove existing image"
										checked={removeItemImage}
										onChange={setRemoveItemImage}
									/>
								)}

								<div className="flex gap-3">
									<Button
										onClick={() => void onSaveItem()}
										loading={loadingMutation}
									>
										{selectedItemId ? "Save item" : "Create item"}
									</Button>
									<Button
										variant="outline"
										onClick={() => setSelectedItemId("")}
									>
										New
									</Button>
								</div>
							</div>
						)}
					</Card>

					<Card className="lg:col-span-2">
						<CardTitle>Live Menu Snapshot</CardTitle>
						<CardDescription>
							This list reflects current category and item status, including sold-out.
						</CardDescription>

						{categories.length === 0 ? (
							<EmptyState
								title="No categories yet"
								description="Create your first menu category above."
							/>
						) : (
							<div className="mt-4 space-y-6">
								{categories.map((category) => (
									<section key={category.id}>
										<div className="mb-2 flex items-center gap-2">
											<p className="font-semibold">{category.name}</p>
											{!category.active && <Badge tone="danger">Inactive</Badge>}
										</div>
										<div className="grid gap-2 md:grid-cols-2">
											{items
												.filter((item) => item.categoryId === category.id)
												.map((item) => (
													<div
														key={item.id}
														className="rounded-xl border border-brand-border p-3"
													>
														<div className="flex items-center justify-between gap-3">
															<p className="font-medium">{item.name}</p>
															<p className="text-sm text-brand-muted">
																{formatCents(item.priceCents)}
															</p>
														</div>
														<div className="mt-2 flex flex-wrap gap-1.5">
															{!item.active && <Badge tone="danger">Inactive</Badge>}
															{!item.available && <Badge tone="danger">Sold out</Badge>}
															{item.popular && <Badge tone="primary">Popular</Badge>}
															{item.vegetarian && (
																<Badge tone="success">Vegetarian</Badge>
															)}
															{item.spicy && <Badge tone="danger">Spicy</Badge>}
														</div>
													</div>
												))}
										</div>
									</section>
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