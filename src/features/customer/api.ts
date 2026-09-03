import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SessionPayload } from "@shared/api";
import type {
	CustomerHomePayload,
	CustomerMenuPayload,
	CustomerRewardsPayload,
	CustomerTransactionsPayload,
} from "@shared/loyalty";
import type { LoyaltyCodePayload } from "@shared/loyaltyCode";
import type {
	AccountDeletionRequestPayload,
	UpdateProfileInput,
} from "@shared/profile";
import { ApiClientError, apiFetch } from "@/lib/api";
import { getStoredJson, setStoredJson } from "@/lib/storage";
import { sessionQueryKey } from "@/features/auth/useSession";

const MENU_CACHE_KEY = "fives:customer:menu:v2";

interface CachedMenuRecord {
	fetchedAt: number;
	data: CustomerMenuPayload;
}

async function fetchCustomerMenuWithCache(): Promise<CustomerMenuPayload> {
	try {
		const data = await apiFetch<CustomerMenuPayload>("/api/customer/menu");
		setStoredJson<CachedMenuRecord>(MENU_CACHE_KEY, {
			fetchedAt: Date.now(),
			data,
		});
		return data;
	} catch (error) {
		if (error instanceof ApiClientError && error.status === 0) {
			const cached = getStoredJson<CachedMenuRecord>(MENU_CACHE_KEY);
			if (cached?.data) {
				return cached.data;
			}
		}
		throw error;
	}
}

export function useCustomerHome() {
	return useQuery({
		queryKey: ["customer", "home"],
		queryFn: () => apiFetch<CustomerHomePayload>("/api/customer/home"),
	});
}

export function useCustomerRewards() {
	return useQuery({
		queryKey: ["customer", "rewards"],
		queryFn: () => apiFetch<CustomerRewardsPayload>("/api/customer/rewards"),
	});
}

export function useCustomerTransactions(page: { limit: number; offset: number }) {
	return useQuery({
		queryKey: ["customer", "transactions", page],
		queryFn: () =>
			apiFetch<CustomerTransactionsPayload>(
				`/api/customer/transactions?limit=${page.limit}&offset=${page.offset}`,
			),
		placeholderData: (previous) => previous,
	});
}

export function useCustomerMenu() {
	return useQuery({
		queryKey: ["customer", "menu"],
		queryFn: fetchCustomerMenuWithCache,
		// The menu rarely changes intra-session; avoid refetching on every tab visit.
		staleTime: 5 * 60_000,
	});
}

export function useUpdateProfile() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: UpdateProfileInput) =>
			apiFetch<SessionPayload>("/api/customer/profile", {
				method: "PATCH",
				body: JSON.stringify(input),
			}),
		onSuccess: (data) => {
			queryClient.setQueryData(sessionQueryKey, data.user);
		},
	});
}

export function useRequestAccountDeletion() {
	return useMutation({
		mutationFn: () =>
			apiFetch<AccountDeletionRequestPayload>(
				"/api/customer/account/deletion-request",
				{ method: "POST" },
			),
	});
}

export function useGenerateLoyaltyCode() {
	return useMutation({
		mutationFn: () =>
			apiFetch<LoyaltyCodePayload>("/api/customer/loyalty-code", {
				method: "POST",
			}),
	});
}
