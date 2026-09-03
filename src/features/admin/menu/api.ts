import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	AdminMenuCategoriesPayload,
	AdminMenuCategory,
	AdminMenuItem,
	AdminMenuItemVariant,
	AdminMenuItemsPayload,
	MenuGroup,
	MenuImageDeletePayload,
	MenuImageUploadPayload,
} from "@shared/menu";
import { apiFetch } from "@/lib/api";

const categoriesQueryKey = ["admin", "menu", "categories"] as const;
const itemsQueryKey = ["admin", "menu", "items"] as const;

interface CategoryInput {
	name: string;
	description: string | null;
	menuGroup: MenuGroup;
	imageKey: string | null;
	sortOrder: number;
	active: boolean;
}

interface ItemInput {
	categoryId: string;
	name: string;
	description: string;
	optionNotes: string | null;
	priceCents: number;
	imageKey: string | null;
	active: boolean;
	available: boolean;
	popular: boolean;
	vegetarian: boolean;
	spicy: boolean;
	isNew: boolean;
	subjectToAvailability: boolean;
	variants: Array<
		Pick<AdminMenuItemVariant, "name" | "priceCents" | "sortOrder" | "active">
	>;
	sortOrder: number;
}

function invalidateMenuQueries(queryClient: ReturnType<typeof useQueryClient>) {
	void queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
	void queryClient.invalidateQueries({ queryKey: itemsQueryKey });
	void queryClient.invalidateQueries({ queryKey: ["customer", "menu"] });
}

export function useAdminMenuCategories() {
	return useQuery({
		queryKey: categoriesQueryKey,
		queryFn: () =>
			apiFetch<AdminMenuCategoriesPayload>("/api/admin/menu/categories"),
	});
}

export function useAdminMenuItems(categoryId?: string) {
	return useQuery({
		queryKey: [...itemsQueryKey, categoryId ?? "all"],
		queryFn: () =>
			apiFetch<AdminMenuItemsPayload>(
				`/api/admin/menu/items${categoryId ? `?categoryId=${categoryId}` : ""}`,
			),
	});
}

export function useCreateMenuCategory() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: CategoryInput) =>
			apiFetch<AdminMenuCategory>("/api/admin/menu/categories", {
				method: "POST",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidateMenuQueries(queryClient),
	});
}

export function useUpdateMenuCategory() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, ...input }: Partial<CategoryInput> & { id: string }) =>
			apiFetch<AdminMenuCategory>(`/api/admin/menu/categories/${id}`, {
				method: "PATCH",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidateMenuQueries(queryClient),
	});
}

export function useCreateMenuItem() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: ItemInput) =>
			apiFetch<AdminMenuItem>("/api/admin/menu/items", {
				method: "POST",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidateMenuQueries(queryClient),
	});
}

export function useUpdateMenuItem() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, ...input }: Partial<ItemInput> & { id: string }) =>
			apiFetch<AdminMenuItem>(`/api/admin/menu/items/${id}`, {
				method: "PATCH",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidateMenuQueries(queryClient),
	});
}

export function useUploadMenuImage() {
	return useMutation({
		mutationFn: async (file: File) => {
			const formData = new FormData();
			formData.append("file", file);
			return apiFetch<MenuImageUploadPayload>("/api/admin/menu/media/upload", {
				method: "POST",
				body: formData,
			});
		},
	});
}

export function useDeleteMenuImage() {
	return useMutation({
		mutationFn: (imageKey: string) =>
			apiFetch<MenuImageDeletePayload>("/api/admin/menu/media/delete", {
				method: "POST",
				body: JSON.stringify({ imageKey }),
			}),
	});
}