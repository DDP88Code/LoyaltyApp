import type { LocationSummary } from "./api";
import type {
	ProgramType,
	RewardType,
	TransactionType,
} from "./domain";
import type { CoffeeProgress, RewardSummary } from "./loyalty";
import type { Role } from "./roles";

export interface DashboardMetricSummary {
	totalMembers: number;
	activeMembers: number;
	newMembersThisMonth: number;
	coffeesPurchased: number;
	freeCoffeesIssued: number;
	freeCoffeesRedeemed: number;
	outstandingRewards: number;
	redemptionRatePercent: number;
}

export interface DayValuePoint {
	date: string;
	value: number;
}

export interface RewardTrendPoint {
	date: string;
	issued: number;
	redeemed: number;
}

export interface AdminDashboardPayload {
	metrics: DashboardMetricSummary;
	newMembersOverTime: DayValuePoint[];
	coffeePurchasesOverTime: DayValuePoint[];
	rewardsEarnedVsRedeemed: RewardTrendPoint[];
}

export interface AdminLookupCustomer {
	id: string;
	fullName: string;
	email: string;
}

export interface AdminLookupStaff {
	id: string;
	fullName: string;
	email: string;
	role: Role;
}

export interface AdminLookupProgram {
	id: string;
	name: string;
	programType: ProgramType;
}

export interface AdminLookupsPayload {
	customers: AdminLookupCustomer[];
	staff: AdminLookupStaff[];
	locations: LocationSummary[];
	programs: AdminLookupProgram[];
}

export interface AdminTransactionRecord {
	id: string;
	transactionType: TransactionType;
	quantity: number;
	billReference: string | null;
	notes: string | null;
	reason: string | null;
	createdAt: string;
	customerId: string;
	customerName: string;
	staffId: string | null;
	staffName: string | null;
	approvedById: string | null;
	approvedByName: string | null;
	locationId: string;
	locationName: string;
	programId: string | null;
	programName: string | null;
}

export interface AdminTransactionsPayload {
	transactions: AdminTransactionRecord[];
	total: number;
	limit: number;
	offset: number;
}

export interface AdminCustomerDetail {
	id: string;
	fullName: string;
	email: string;
	mobileNumber: string | null;
	active: boolean;
	createdAt: string;
	reference: string;
}

export interface AdminCustomerDetailPayload {
	customer: AdminCustomerDetail;
	coffee: CoffeeProgress | null;
	rewards: RewardSummary[];
	transactions: AdminTransactionRecord[];
}

export interface AdminRewardDefinition {
	id: string;
	businessId: string;
	name: string;
	description: string | null;
	rewardType: RewardType;
	valueCents: number | null;
	pointsCost: number | null;
	itemReference: string | null;
	validDays: number | null;
	welcomeReward: boolean;
	active: boolean;
	terms: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface AdminRewardDefinitionsPayload {
	rewards: AdminRewardDefinition[];
}

export interface AdminLoyaltyProgram {
	id: string;
	businessId: string;
	name: string;
	description: string | null;
	programType: ProgramType;
	currencyCode: string;
	qualifyingPurchasesRequired: number | null;
	rewardDefinitionId: string | null;
	rewardName: string | null;
	rewardValidDays: number | null;
	active: boolean;
	sortOrder: number;
	locationIds: string[];
	updatedAt: string;
}

export interface AdminLoyaltyProgramsPayload {
	programs: AdminLoyaltyProgram[];
	locations: LocationSummary[];
	rewardOptions: AdminRewardDefinition[];
}

export interface AdminStaffMember {
	id: string;
	fullName: string;
	email: string;
	mobileNumber: string | null;
	role: Role;
	active: boolean;
	assignedLocationId: string | null;
	assignedLocationName: string | null;
	createdAt: string;
}

export interface AdminStaffListPayload {
	staff: AdminStaffMember[];
	total: number;
	limit: number;
	offset: number;
	locations: LocationSummary[];
}

export interface AdminAuditLogEntry {
	id: string;
	createdAt: string;
	actorUserId: string;
	actorName: string | null;
	actorRole: Role;
	action: string;
	entityType: string;
	entityId: string | null;
	oldValueJson: unknown;
	newValueJson: unknown;
	metadataJson: unknown;
}

export interface AdminAuditLogsPayload {
	entries: AdminAuditLogEntry[];
	total: number;
	limit: number;
	offset: number;
}

export interface AdminSettingsPayload {
	welcomeRewardEnabled: boolean;
	loyaltyCodeTtlSeconds: number;
}
