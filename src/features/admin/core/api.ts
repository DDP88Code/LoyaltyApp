import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
	AdminAuditLogsPayload,
	AdminCustomerDetailPayload,
	AdminDashboardPayload,
	AdminLookupsPayload,
	AdminLoyaltyProgramsPayload,
	AdminRewardDefinition,
	AdminRewardDefinitionsPayload,
	AdminReportsPayload,
	AdminSettingsPayload,
	AdminSettingsUpdateInput,
	AdminStaffListPayload,
	AdminTransactionsPayload,
} from "@shared/admin";
import type { AdminCustomerListPayload } from "@shared/api";
import type { AdjustmentResultPayload } from "@shared/loyalty";
import { apiFetch } from "@/lib/api";

const dashboardQueryKey = ["admin", "dashboard"] as const;
const lookupsQueryKey = ["admin", "lookups"] as const;
const customersQueryKey = ["admin", "customers"] as const;
const customerDetailQueryKey = ["admin", "customer-detail"] as const;
const loyaltyProgramsQueryKey = ["admin", "loyalty", "programs"] as const;
const rewardsQueryKey = ["admin", "rewards"] as const;
const transactionsQueryKey = ["admin", "transactions"] as const;
const staffQueryKey = ["admin", "staff"] as const;
const auditQueryKey = ["admin", "audit"] as const;
const settingsQueryKey = ["admin", "settings"] as const;
const reportsQueryKey = ["admin", "reports"] as const;

function invalidateAdminPages(queryClient: ReturnType<typeof useQueryClient>) {
	void queryClient.invalidateQueries({ queryKey: dashboardQueryKey });
	void queryClient.invalidateQueries({ queryKey: lookupsQueryKey });
	void queryClient.invalidateQueries({ queryKey: customersQueryKey });
	void queryClient.invalidateQueries({ queryKey: customerDetailQueryKey });
	void queryClient.invalidateQueries({ queryKey: loyaltyProgramsQueryKey });
	void queryClient.invalidateQueries({ queryKey: rewardsQueryKey });
	void queryClient.invalidateQueries({ queryKey: transactionsQueryKey });
	void queryClient.invalidateQueries({ queryKey: staffQueryKey });
	void queryClient.invalidateQueries({ queryKey: auditQueryKey });
	void queryClient.invalidateQueries({ queryKey: settingsQueryKey });
	void queryClient.invalidateQueries({ queryKey: reportsQueryKey });
	void queryClient.invalidateQueries({ queryKey: ["customer", "home"] });
	void queryClient.invalidateQueries({ queryKey: ["customer", "rewards"] });
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

export function useAdminDashboard(days = 30) {
	return useQuery({
		queryKey: [...dashboardQueryKey, days],
		queryFn: () =>
			apiFetch<AdminDashboardPayload>(`/api/admin/dashboard?days=${days}`),
	});
}

export function useAdminLookups() {
	return useQuery({
		queryKey: lookupsQueryKey,
		queryFn: () => apiFetch<AdminLookupsPayload>("/api/admin/lookups"),
	});
}

export interface CustomersQuery {
	search?: string;
	limit: number;
	offset: number;
}

export function useAdminCustomers(query: CustomersQuery) {
	return useQuery({
		queryKey: [...customersQueryKey, query],
		queryFn: () =>
			apiFetch<AdminCustomerListPayload>(
				`/api/admin/customers-v2${toQueryString({ ...query })}`,
			),
		placeholderData: (previous) => previous,
	});
}

export function useAdminCustomerDetail(customerId: string | null) {
	return useQuery({
		queryKey: [...customerDetailQueryKey, customerId],
		queryFn: () =>
			apiFetch<AdminCustomerDetailPayload>(`/api/admin/customers/${customerId}`),
		enabled: Boolean(customerId),
	});
}

export interface AdjustmentInput {
	customerId: string;
	programId: string;
	locationId: string;
	transactionType: "adjustment" | "reversal";
	quantity: number;
	reason: string;
	billReference: string | null;
	idempotencyKey: string;
}

export function useCreateAdminAdjustment() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ customerId, ...input }: AdjustmentInput) =>
			apiFetch<AdjustmentResultPayload>(
				`/api/admin/customers/${customerId}/adjustments`,
				{
					method: "POST",
					body: JSON.stringify(input),
				},
			),
		onSuccess: () => invalidateAdminPages(queryClient),
	});
}

export function useAdminLoyaltyPrograms() {
	return useQuery({
		queryKey: loyaltyProgramsQueryKey,
		queryFn: () =>
			apiFetch<AdminLoyaltyProgramsPayload>("/api/admin/loyalty/programs"),
	});
}

export interface UpdateLoyaltyProgramInput {
	id: string;
	name?: string;
	description?: string | null;
	qualifyingPurchasesRequired?: number | null;
	rewardDefinitionId?: string | null;
	active?: boolean;
	sortOrder?: number;
	locationIds?: string[];
}

export function useUpdateLoyaltyProgram() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, ...input }: UpdateLoyaltyProgramInput) =>
			apiFetch<{ updated: true }>(`/api/admin/loyalty/programs/${id}`, {
				method: "PATCH",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidateAdminPages(queryClient),
	});
}

export function useAdminRewards() {
	return useQuery({
		queryKey: rewardsQueryKey,
		queryFn: () => apiFetch<AdminRewardDefinitionsPayload>("/api/admin/rewards"),
	});
}

export interface RewardDefinitionInput {
	name: string;
	description: string | null;
	rewardType: "free_item" | "voucher" | "discount" | "points_reward";
	valueCents: number | null;
	pointsCost: number | null;
	itemReference: string | null;
	validDays: number | null;
	welcomeReward: boolean;
	active: boolean;
	terms: string | null;
}

export function useCreateRewardDefinition() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: RewardDefinitionInput) =>
			apiFetch<AdminRewardDefinition>("/api/admin/rewards", {
				method: "POST",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidateAdminPages(queryClient),
	});
}

export function useUpdateRewardDefinition() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({
			id,
			...input
		}: Partial<RewardDefinitionInput> & { id: string }) =>
			apiFetch<AdminRewardDefinition>(`/api/admin/rewards/${id}`, {
				method: "PATCH",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidateAdminPages(queryClient),
	});
}

export function useDeleteRewardDefinition() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) =>
			apiFetch<{ deleted: true }>(`/api/admin/rewards/${id}`, {
				method: "DELETE",
			}),
		onSuccess: () => invalidateAdminPages(queryClient),
	});
}

export interface TransactionsQuery {
	customerId?: string;
	staffId?: string;
	locationId?: string;
	programId?: string;
	type?: "earn" | "bonus" | "redeem" | "adjustment" | "reversal";
	billReference?: string;
	from?: string;
	to?: string;
	limit: number;
	offset: number;
}

export function useAdminTransactions(query: TransactionsQuery) {
	return useQuery({
		queryKey: [...transactionsQueryKey, query],
		queryFn: () =>
			apiFetch<AdminTransactionsPayload>(
				`/api/admin/transactions${toQueryString({ ...query })}`,
			),
		placeholderData: (previous) => previous,
	});
}

export interface StaffQuery {
	search?: string;
	limit: number;
	offset: number;
}

export function useAdminStaff(query: StaffQuery) {
	return useQuery({
		queryKey: [...staffQueryKey, query],
		queryFn: () =>
			apiFetch<AdminStaffListPayload>(
				`/api/admin/staff${toQueryString({ ...query })}`,
			),
		placeholderData: (previous) => previous,
	});
}

export interface StaffInput {
	fullName: string;
	email: string;
	mobileNumber: string | null;
	role: "staff" | "admin";
	assignedLocationId: string | null;
	active: boolean;
}

export function useCreateStaff() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: StaffInput) =>
			apiFetch("/api/admin/staff", {
				method: "POST",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidateAdminPages(queryClient),
	});
}

export function useUpdateStaff() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, ...input }: Partial<StaffInput> & { id: string }) =>
			apiFetch("/api/admin/staff/" + id, {
				method: "PATCH",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidateAdminPages(queryClient),
	});
}

export interface AuditQuery {
	action?: string;
	entityType?: string;
	actorRole?: "customer" | "staff" | "admin" | "owner";
	entityId?: string;
	from?: string;
	to?: string;
	limit: number;
	offset: number;
}

export function useAdminAuditLogs(query: AuditQuery) {
	return useQuery({
		queryKey: [...auditQueryKey, query],
		queryFn: () =>
			apiFetch<AdminAuditLogsPayload>(
				`/api/admin/audit${toQueryString({ ...query })}`,
			),
		placeholderData: (previous) => previous,
	});
}

export function useAdminSettings() {
	return useQuery({
		queryKey: settingsQueryKey,
		queryFn: () => apiFetch<AdminSettingsPayload>("/api/admin/settings"),
	});
}

export function useUpdateAdminSettings() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input: AdminSettingsUpdateInput) =>
			apiFetch<AdminSettingsPayload>("/api/admin/settings", {
				method: "PATCH",
				body: JSON.stringify(input),
			}),
		onSuccess: () => invalidateAdminPages(queryClient),
	});
}

export interface ReportsQuery {
	from?: string;
	to?: string;
	locationId?: string;
}

export function useAdminReports(query: ReportsQuery) {
	return useQuery({
		queryKey: [...reportsQueryKey, query],
		queryFn: () =>
			apiFetch<AdminReportsPayload>(
				`/api/admin/reports${toQueryString({ ...query })}`,
			),
	});
}
