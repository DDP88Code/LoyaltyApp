/** Response envelope shared by the Worker API and the React client. */

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
