import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { StaffContextPayload } from "@shared/api";
import type {
	CoffeeEarnResultPayload,
	ResolveLoyaltyCodeInput,
	StaffResolvedCustomerPayload,
} from "@shared/loyaltyCode";
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
