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
	CustomerMarkAllNotificationsReadPayload,
	CustomerMarkNotificationReadPayload,
	CustomerNotificationsPayload,
	CustomerPushConfigPayload,
	CustomerPushSubscriptionStatusPayload,
	CustomerUnreadNotificationsPayload,
	PushSubscriptionDeleteInput,
	PushSubscriptionUpsertInput,
} from "@shared/notifications";
import type {
	AccountDeletionPayload,
	UpdateProfileInput,
} from "@shared/profile";
import { ApiClientError, apiFetch } from "@/lib/api";
import { getStoredJson, setStoredJson } from "@/lib/storage";
import { sessionQueryKey } from "@/features/auth/useSession";

const MENU_CACHE_KEY = "fives:customer:menu:v2";

export const customerUnreadNotificationsQueryKey = [
	"customer",
	"notifications",
	"unread",
] as const;
export const customerNotificationsQueryKey = [
	"customer",
	"notifications",
	"list",
] as const;
export const customerPushConfigQueryKey = [
	"customer",
	"push",
	"config",
] as const;

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

export function useCustomerNotifications(page: { limit: number; offset: number }) {
	return useQuery({
		queryKey: [...customerNotificationsQueryKey, page],
		queryFn: () =>
			apiFetch<CustomerNotificationsPayload>(
				`/api/customer/notifications?limit=${page.limit}&offset=${page.offset}`,
			),
		placeholderData: (previous) => previous,
	});
}

export function useCustomerUnreadNotifications() {
	return useQuery({
		queryKey: customerUnreadNotificationsQueryKey,
		queryFn: () =>
			apiFetch<CustomerUnreadNotificationsPayload>(
				"/api/customer/notifications/unread-count",
			),
		staleTime: 15_000,
		refetchInterval: 30_000,
	});
}

export function useMarkCustomerNotificationRead() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (notificationId: string) =>
			apiFetch<CustomerMarkNotificationReadPayload>(
				`/api/customer/notifications/${notificationId}/read`,
				{
					method: "POST",
				},
			),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: customerUnreadNotificationsQueryKey,
			});
			void queryClient.invalidateQueries({
				queryKey: customerNotificationsQueryKey,
				exact: false,
			});
		},
	});
}

export function useMarkAllCustomerNotificationsRead() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () =>
			apiFetch<CustomerMarkAllNotificationsReadPayload>(
				"/api/customer/notifications/read-all",
				{
					method: "POST",
				},
			),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: customerUnreadNotificationsQueryKey,
			});
			void queryClient.invalidateQueries({
				queryKey: customerNotificationsQueryKey,
				exact: false,
			});
		},
	});
}

export function useCustomerPushConfig() {
	return useQuery({
		queryKey: customerPushConfigQueryKey,
		queryFn: () => apiFetch<CustomerPushConfigPayload>("/api/customer/push/config"),
		staleTime: 15_000,
	});
}

export function useSaveCustomerPushSubscription() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: PushSubscriptionUpsertInput) =>
			apiFetch<CustomerPushSubscriptionStatusPayload>(
				"/api/customer/push/subscriptions",
				{
					method: "POST",
					body: JSON.stringify(input),
				},
			),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: customerPushConfigQueryKey,
			});
		},
	});
}

export function useDeleteCustomerPushSubscription() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: PushSubscriptionDeleteInput) =>
			apiFetch<CustomerPushSubscriptionStatusPayload>(
				"/api/customer/push/subscriptions/delete",
				{
					method: "POST",
					body: JSON.stringify(input),
				},
			),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: customerPushConfigQueryKey,
			});
		},
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
			void queryClient.invalidateQueries({ queryKey: customerPushConfigQueryKey });
		},
	});
}


export function useDeleteAccount() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () =>
			apiFetch<AccountDeletionPayload>("/api/customer/account", {
				method: "DELETE",
			}),
		onSuccess: () => {
			queryClient.setQueryData(sessionQueryKey, null);
			void queryClient.invalidateQueries({
				predicate: (query) => query.queryKey[0] !== sessionQueryKey[0],
			});
		},
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
