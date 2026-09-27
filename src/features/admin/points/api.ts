import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	AdminPointsActivityPayload,
	AdminPointsCataloguePayload,
	AdminPointsProgramPayload,
	AdminPointsPromotionPayload,
	AdminPointsReportPayload,
	CustomerPointsSummary,
} from "@shared/rewardPoints";
import { apiFetch } from "@/lib/api";

const pointsProgramQueryKey = ["admin", "points", "program"] as const;
const pointsPromotionsQueryKey = ["admin", "points", "promotions"] as const;
const pointsCatalogueQueryKey = ["admin", "points", "catalogue"] as const;
const pointsActivityQueryKey = ["admin", "points", "activity"] as const;
const pointsReportQueryKey = ["admin", "points", "report"] as const;

function invalidatePoints(queryClient: ReturnType<typeof useQueryClient>) {
	void queryClient.invalidateQueries({ queryKey: pointsProgramQueryKey });
	void queryClient.invalidateQueries({ queryKey: pointsPromotionsQueryKey });
	void queryClient.invalidateQueries({ queryKey: pointsCatalogueQueryKey });
	void queryClient.invalidateQueries({ queryKey: pointsActivityQueryKey });
	void queryClient.invalidateQueries({ queryKey: pointsReportQueryKey });
	void queryClient.invalidateQueries({ queryKey: ["customer", "home"] });
	void queryClient.invalidateQueries({ queryKey: ["customer", "rewards"] });
	void queryClient.invalidateQueries({ queryKey: ["customer", "points"] });
}

export function useAdminPointsProgram() {
	return useQuery({
		queryKey: pointsProgramQueryKey,
		queryFn: () => apiFetch<AdminPointsProgramPayload>("/api/admin/points/program"),
	});
}

export function useUpdateAdminPointsProgram() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: Partial<AdminPointsProgramPayload>) =>
			apiFetch<AdminPointsProgramPayload>("/api/admin/points/program", {
				method: "PATCH",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidatePoints(queryClient),
	});
}

export function useAdminPointsPromotions() {
	return useQuery({
		queryKey: pointsPromotionsQueryKey,
		queryFn: () => apiFetch<AdminPointsPromotionPayload[]>("/api/admin/points/promotions"),
	});
}

export interface PointsPromotionInput {
	name: string;
	description: string | null;
	promotionType: "multiplier" | "fixed_bonus";
	multiplierBp: number | null;
	fixedBonusPoints: number | null;
	minEligibleSpendCents: number | null;
	startAt: string;
	endAt: string;
	enabled: boolean;
	archived?: boolean;
}

export function useCreatePointsPromotion() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: PointsPromotionInput) =>
			apiFetch<AdminPointsPromotionPayload>("/api/admin/points/promotions", {
				method: "POST",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidatePoints(queryClient),
	});
}

export function useUpdatePointsPromotion() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			...input
		}: Partial<PointsPromotionInput> & { id: string }) =>
			apiFetch<AdminPointsPromotionPayload>(`/api/admin/points/promotions/${id}`, {
				method: "PATCH",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidatePoints(queryClient),
	});
}

export function useDeletePointsPromotion() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) =>
			apiFetch<{ deleted: true }>(`/api/admin/points/promotions/${id}`, {
				method: "DELETE",
			}),
		onSuccess: () => invalidatePoints(queryClient),
	});
}

export function useAdminPointsCatalogue() {
	return useQuery({
		queryKey: pointsCatalogueQueryKey,
		queryFn: () => apiFetch<AdminPointsCataloguePayload>("/api/admin/points/catalogue"),
	});
}

export interface PointsCatalogueInput {
	rewardDefinitionId: string;
	pointsCost: number;
	active: boolean;
	sortOrder: number;
	imageKey: string | null;
	archived?: boolean;
}

export function useCreatePointsCatalogueItem() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: PointsCatalogueInput) =>
			apiFetch("/api/admin/points/catalogue", {
				method: "POST",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidatePoints(queryClient),
	});
}

export function useUpdatePointsCatalogueItem() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			...input
		}: Partial<PointsCatalogueInput> & { id: string }) =>
			apiFetch(`/api/admin/points/catalogue/${id}`, {
				method: "PATCH",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidatePoints(queryClient),
	});
}

export function useDeletePointsCatalogueItem() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) =>
			apiFetch<{ deleted: true }>(`/api/admin/points/catalogue/${id}`, {
				method: "DELETE",
			}),
		onSuccess: () => invalidatePoints(queryClient),
	});
}

export function useAdminPointsActivity() {
	return useQuery({
		queryKey: pointsActivityQueryKey,
		queryFn: () => apiFetch<AdminPointsActivityPayload>("/api/admin/points/activity"),
	});
}

export function useAdminPointsReport() {
	return useQuery({
		queryKey: pointsReportQueryKey,
		queryFn: () => apiFetch<AdminPointsReportPayload>("/api/admin/points/report"),
	});
}

export function useReversePointsAward() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ awardId, reason }: { awardId: string; reason: string }) =>
			apiFetch<{ reversed: true }>(`/api/admin/points/awards/${awardId}/reverse`, {
				method: "POST",
				body: JSON.stringify({ reason }),
			}),
		onSuccess: () => invalidatePoints(queryClient),
	});
}

export function useCreatePointsAdjustment() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			customerId,
			locationId,
			quantity,
			reason,
			idempotencyKey,
		}: {
			customerId: string;
			locationId: string;
			quantity: number;
			reason: string;
			idempotencyKey: string;
		}) =>
			apiFetch<{ adjusted: true; summary: CustomerPointsSummary }>(
				`/api/admin/points/customers/${customerId}/adjustments`,
				{
					method: "POST",
					body: JSON.stringify({ locationId, quantity, reason, idempotencyKey }),
				},
			),
		onSuccess: () => invalidatePoints(queryClient),
	});
}
