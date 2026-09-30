import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	AdminItemCampaignActivityPayload,
	AdminItemCampaignPayload,
	AdminItemCampaignReportPayload,
	AdminItemCampaignsPayload,
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
const itemCampaignsQueryKey = ["admin", "points", "campaigns"] as const;
const itemCampaignActivityQueryKey = ["admin", "points", "campaigns", "activity"] as const;
const itemCampaignReportQueryKey = ["admin", "points", "campaigns", "report"] as const;

function invalidatePoints(queryClient: ReturnType<typeof useQueryClient>) {
	void queryClient.invalidateQueries({ queryKey: pointsProgramQueryKey });
	void queryClient.invalidateQueries({ queryKey: pointsPromotionsQueryKey });
	void queryClient.invalidateQueries({ queryKey: pointsCatalogueQueryKey });
	void queryClient.invalidateQueries({ queryKey: pointsActivityQueryKey });
	void queryClient.invalidateQueries({ queryKey: pointsReportQueryKey });
	void queryClient.invalidateQueries({ queryKey: itemCampaignsQueryKey });
	void queryClient.invalidateQueries({ queryKey: itemCampaignActivityQueryKey });
	void queryClient.invalidateQueries({ queryKey: itemCampaignReportQueryKey });
	void queryClient.invalidateQueries({ queryKey: ["customer", "home"] });
	void queryClient.invalidateQueries({ queryKey: ["customer", "rewards"] });
	void queryClient.invalidateQueries({ queryKey: ["customer", "points"] });
}

function toQueryString(params: Record<string, string | number | undefined>) {
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === "") continue;
		query.set(key, String(value));
	}
	const value = query.toString();
	return value ? `?${value}` : "";
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

export function useAdminItemCampaigns() {
	return useQuery({
		queryKey: itemCampaignsQueryKey,
		queryFn: () => apiFetch<AdminItemCampaignsPayload>("/api/admin/points/campaigns"),
	});
}

export interface ItemCampaignInput {
	name: string;
	description: string | null;
	itemReference: string;
	unitPriceCents: number;
	targetQuantity: number;
	rewardDefinitionId: string;
	earnsRewardPoints: boolean;
	status: "active" | "disabled" | "archived";
	startAt: string | null;
	endAt: string | null;
	maxQuantityPerBill: number | null;
	sortOrder: number;
}

export function useCreateAdminItemCampaign() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: ItemCampaignInput) =>
			apiFetch<AdminItemCampaignPayload>("/api/admin/points/campaigns", {
				method: "POST",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidatePoints(queryClient),
	});
}

export function useUpdateAdminItemCampaign() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			...input
		}: Partial<ItemCampaignInput> & { id: string }) =>
			apiFetch<AdminItemCampaignPayload>(`/api/admin/points/campaigns/${id}`, {
				method: "PATCH",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidatePoints(queryClient),
	});
}

export function useAdminItemCampaignActivity(query: {
	campaignId?: string;
	from?: string;
	to?: string;
	limit: number;
	offset: number;
}) {
	return useQuery({
		queryKey: [...itemCampaignActivityQueryKey, query],
		queryFn: () =>
			apiFetch<AdminItemCampaignActivityPayload>(
				`/api/admin/points/campaigns/activity${toQueryString({
					campaignId: query.campaignId,
					from: query.from,
					to: query.to,
					limit: query.limit,
					offset: query.offset,
				})}`,
			),
	});
}

export function useAdminItemCampaignReport(query: { from?: string; to?: string }) {
	return useQuery({
		queryKey: [...itemCampaignReportQueryKey, query],
		queryFn: () =>
			apiFetch<AdminItemCampaignReportPayload>(
				`/api/admin/points/campaigns/report${toQueryString({
					from: query.from,
					to: query.to,
				})}`,
			),
	});
}

export function useReverseBillEvent() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ billEventId, reason }: { billEventId: string; reason: string }) =>
			apiFetch<{ reversed: true; pointsReversed: boolean }>(
				`/api/admin/points/bills/${billEventId}/reverse`,
				{
					method: "POST",
					body: JSON.stringify({ reason }),
				},
			),
		onSuccess: () => invalidatePoints(queryClient),
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
