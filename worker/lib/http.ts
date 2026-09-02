import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiErrorCode, ApiFailure, ApiSuccess } from "@shared/api";

const STATUS_BY_CODE: Record<ApiErrorCode, ContentfulStatusCode> = {
	bad_request: 400,
	validation_failed: 422,
	unauthenticated: 401,
	forbidden: 403,
	not_found: 404,
	conflict: 409,
	rate_limited: 429,
	internal_error: 500,
};

export class ApiError extends Error {
	constructor(
		readonly code: ApiErrorCode,
		message: string,
		readonly details?: unknown,
	) {
		super(message);
		this.name = "ApiError";
	}

	get status(): ContentfulStatusCode {
		return STATUS_BY_CODE[this.code];
	}
}

export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
	return c.json<ApiSuccess<T>>({ success: true, data }, status);
}

export function fail(
	c: Context,
	code: ApiErrorCode,
	message: string,
	details?: unknown,
) {
	const body: ApiFailure = { success: false, error: { code, message } };
	if (details !== undefined) body.error.details = details;
	return c.json(body, STATUS_BY_CODE[code]);
}
