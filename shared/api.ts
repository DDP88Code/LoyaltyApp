/** Response envelope shared by the Worker API and the React client. */

import type { Role } from "./roles";

export type ApiErrorCode =
	| "bad_request"
	| "validation_failed"
	| "unauthenticated"
	| "forbidden"
	| "not_found"
	| "conflict"
	| "rate_limited"
	| "internal_error";

export interface ApiSuccess<T> {
	success: true;
	data: T;
}

export interface ApiFailure {
	success: false;
	error: {
		code: ApiErrorCode;
		message: string;
		details?: unknown;
	};
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface HealthPayload {
	status: "ok";
	service: "fives-rewards-api";
	environment: string;
	time: string;
}

/**
 * The signed-in user as the client is allowed to see them. `id` is the profile
 * id, which is what every other endpoint expects; the Better Auth user id is
 * deliberately not exposed.
 */
export interface SessionUser {
	id: string;
	businessId: string;
	fullName: string;
	email: string;
	mobileNumber: string | null;
	role: Role;
	birthday: string | null;
	avatarUrl: string | null;
	marketingOptIn: boolean;
	notificationOptIn: boolean;
}

export interface SessionPayload {
	user: SessionUser;
}

export interface LocationSummary {
	id: string;
	name: string;
	address: string | null;
}

/** What the staff app needs on load: who they are and where they can work. */
export interface StaffContextPayload {
	staff: SessionUser;
	locations: LocationSummary[];
	selectedLocation: LocationSummary | null;
}

export interface AdminCustomerSummary {
	id: string;
	fullName: string;
	email: string;
	mobileNumber: string | null;
	active: boolean;
	createdAt: string;
}

export interface AdminCustomerListPayload {
	customers: AdminCustomerSummary[];
	total: number;
	limit: number;
	offset: number;
}
