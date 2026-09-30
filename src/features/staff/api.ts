import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StaffContextPayload } from "@shared/api";
import type {
	CoffeeEarnResultPayload,
	ResolveLoyaltyCodeInput,
	StaffResolvedCustomerPayload,
} from "@shared/loyaltyCode";
import type {
	StaffCampaignBillCommitPayload,
	StaffCampaignBillLineInput,
	StaffCampaignBillQuotePayload,
	StaffPointsAwardPayload,
	StaffPointsQuotePayload,
} from "@shared/rewardPoints";
import { apiFetch } from "@/lib/api";

export function useStaffContext(locationId: string | null) {
	return useQuery({
		queryKey: ["staff", "context", locationId],
		queryFn: () =>
			apiFetch<StaffContextPayload>(
				`/api/staff/context${locationId ? `?locationId=${locationId}` : ""}`,
			),
	});
}

export function useResolveLoyaltyCode() {
	return useMutation({
		mutationFn: (input: ResolveLoyaltyCodeInput) =>
			apiFetch<StaffResolvedCustomerPayload>(
				"/api/staff/loyalty-code/resolve",
				{ method: "POST", body: JSON.stringify(input) },
			),
	});
}

export interface AddCoffeeInput {
	customerId: string;
	locationId: string;
	quantity: number;
	billReference: string | null;
	idempotencyKey: string;
}

export function useAddCoffee() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ customerId, ...body }: AddCoffeeInput) =>
			apiFetch<CoffeeEarnResultPayload>(
				`/api/staff/customers/${customerId}/coffee`,
				{ method: "POST", body: JSON.stringify(body) },
			),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["staff", "context"] });
		},
	});
}

export interface RedeemRewardInput {
	customerId: string;
	rewardId: string;
	locationId: string;
	billReference: string | null;
	billTotalRand: number | null;
}

export interface StaffPointsQuoteInput {
	customerId: string;
	locationId: string;
	eligibleSpendRand: string;
	billReference: string;
}

export interface StaffPointsAwardInput extends StaffPointsQuoteInput {
	requestIdempotencyKey: string;
	duplicateOverrideReason?: string | null;
}

export interface StaffCampaignBillQuoteInput {
	customerId: string;
	locationId: string;
	billTotalRand: string;
	otherExcludedSpendRand: string;
	campaignLines: StaffCampaignBillLineInput[];
}

export interface StaffCampaignBillCommitInput extends StaffCampaignBillQuoteInput {
	billReference: string;
	requestIdempotencyKey: string;
	duplicateOverrideReason?: string | null;
}

export function useRedeemReward() {
	return useMutation({
		mutationFn: ({ customerId, rewardId, ...body }: RedeemRewardInput) =>
			apiFetch<StaffResolvedCustomerPayload>(
				`/api/staff/customers/${customerId}/rewards/${rewardId}/redeem`,
				{ method: "POST", body: JSON.stringify(body) },
			),
	});
}

export function useQuoteStaffPoints() {
	return useMutation({
		mutationFn: ({ customerId, ...body }: StaffPointsQuoteInput) =>
			apiFetch<StaffPointsQuotePayload>(`/api/staff/points/customers/${customerId}/quote`, {
				method: "POST",
				body: JSON.stringify(body),
			}),
	});
}

export function useAwardStaffPoints() {
	return useMutation({
		mutationFn: ({ customerId, ...body }: StaffPointsAwardInput) =>
			apiFetch<StaffPointsAwardPayload>(`/api/staff/points/customers/${customerId}/award`, {
				method: "POST",
				body: JSON.stringify(body),
			}),
	});
}

export function useQuoteStaffCampaignBill() {
	return useMutation({
		mutationFn: ({ customerId, ...body }: StaffCampaignBillQuoteInput) =>
			apiFetch<StaffCampaignBillQuotePayload>(
				`/api/staff/points/customers/${customerId}/bill/quote`,
				{
					method: "POST",
					body: JSON.stringify(body),
				},
			),
	});
}

export function useCommitStaffCampaignBill() {
	return useMutation({
		mutationFn: ({ customerId, ...body }: StaffCampaignBillCommitInput) =>
			apiFetch<StaffCampaignBillCommitPayload>(
				`/api/staff/points/customers/${customerId}/bill`,
				{
					method: "POST",
					body: JSON.stringify(body),
				},
			),
	});
}
