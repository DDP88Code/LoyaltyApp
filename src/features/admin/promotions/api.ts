import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	AdminPromotion,
	AdminPromotionsPayload,
	PromotionImageDeletePayload,
	PromotionImageUploadPayload,
} from "@shared/promotions";
import { apiFetch } from "@/lib/api";

const promotionsQueryKey = ["admin", "promotions"] as const;

export interface PromotionInput {
	title: string;
	subtitle: string | null;
	description: string | null;
	imageKey: string | null;
	startAt: string;
	endAt: string;
	active: boolean;
	ctaText: string | null;
	ctaUrl: string | null;
}

function invalidatePromotionQueries(
	queryClient: ReturnType<typeof useQueryClient>,
) {
	void queryClient.invalidateQueries({ queryKey: promotionsQueryKey });
	void queryClient.invalidateQueries({ queryKey: ["customer", "home"] });
}

export function useAdminPromotions() {
	return useQuery({
		queryKey: promotionsQueryKey,
		queryFn: () => apiFetch<AdminPromotionsPayload>("/api/admin/promotions"),
	});
}

export function useCreatePromotion() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: PromotionInput) =>
			apiFetch<AdminPromotion>("/api/admin/promotions", {
				method: "POST",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidatePromotionQueries(queryClient),
	});
}

export function useUpdatePromotion() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, ...input }: Partial<PromotionInput> & { id: string }) =>
			apiFetch<AdminPromotion>(`/api/admin/promotions/${id}`, {
				method: "PATCH",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidatePromotionQueries(queryClient),
	});
}

export function useDeletePromotion() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) =>
			apiFetch<{ deleted: true }>(`/api/admin/promotions/${id}`, {
				method: "DELETE",
			}),
		onSuccess: () => invalidatePromotionQueries(queryClient),
	});
}

export function useUploadPromotionImage() {
	return useMutation({
		mutationFn: async (file: File) => {
			const formData = new FormData();
			formData.append("file", file);
			return apiFetch<PromotionImageUploadPayload>(
				"/api/admin/promotions/media/upload",
				{
					method: "POST",
					body: formData,
				},
			);
		},
	});
}

export function useDeletePromotionImage() {
	return useMutation({
		mutationFn: (imageKey: string) =>
			apiFetch<PromotionImageDeletePayload>("/api/admin/promotions/media/delete", {
				method: "POST",
				body: JSON.stringify({ imageKey }),
			}),
	});
}