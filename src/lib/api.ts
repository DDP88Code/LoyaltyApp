import type { ApiErrorCode, ApiResponse } from "@shared/api";
import { getNativeAuthToken } from "./nativeAuthToken";
import { IS_NATIVE } from "./platform";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

function isMutationMethod(method: string): boolean {
	return method !== "GET" && method !== "HEAD";
}

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
	const method = (init.method ?? "GET").toUpperCase();
	const isFormData =
		typeof FormData !== "undefined" && init.body instanceof FormData;

	if (
		isMutationMethod(method) &&
		typeof navigator !== "undefined" &&
		navigator.onLine === false
	) {
		throw new ApiClientError(
			"internal_error",
			"You are offline. Connect to the internet before trying this action.",
			0,
		);
	}

	const headers = new Headers({
		Accept: "application/json",
		...(init.body && !isFormData ? { "Content-Type": "application/json" } : {}),
	});
	new Headers(init.headers).forEach((value, key) => headers.set(key, value));
	if (IS_NATIVE) {
		const token = await getNativeAuthToken();
		if (token) headers.set("Authorization", `Bearer ${token}`);
		else headers.delete("Authorization");
	}

	try {
		response = await fetch(`${BASE_URL}${path}`, {
			credentials: "include",
			...init,
			...(IS_NATIVE ? { credentials: "omit" as const } : {}),
			headers,
		});
	} catch {
		throw new ApiClientError(
			"internal_error",
			"You are offline. Connect to the internet before trying this action.",
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
