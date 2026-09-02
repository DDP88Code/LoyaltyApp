import type { ApiErrorCode, ApiResponse } from "@shared/api";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiClientError extends Error {
	constructor(
		readonly code: ApiErrorCode,
		message: string,
		readonly status: number,
		readonly details?: unknown,
	) {
		super(message);
		this.name = "ApiClientError";
	}
}

export async function apiFetch<T>(
	path: string,
	init: RequestInit = {},
): Promise<T> {
	let response: Response;

	try {
		response = await fetch(`${BASE_URL}${path}`, {
			// Better Auth session cookies must travel with every API call.
			credentials: "include",
			...init,
			headers: {
				Accept: "application/json",
				...(init.body ? { "Content-Type": "application/json" } : {}),
				...init.headers,
			},
		});
	} catch {
		throw new ApiClientError(
			"internal_error",
			"You appear to be offline. Check your connection and try again.",
			0,
		);
	}

	let body: ApiResponse<T>;
	try {
		body = (await response.json()) as ApiResponse<T>;
	} catch {
		throw new ApiClientError(
			"internal_error",
			"The server returned an unexpected response.",
			response.status,
		);
	}

	if (!body.success) {
		throw new ApiClientError(
			body.error.code,
			body.error.message,
			response.status,
			body.error.details,
		);
	}

	return body.data;
}
