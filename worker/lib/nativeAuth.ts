const DEFAULT_NATIVE_APP_ORIGINS = ["https://app.fivessportsbar.app"] as const;
const DEFAULT_TURNSTILE_HOSTNAMES = [
	"fivessportsbar.app",
	"app.fivessportsbar.app",
] as const;

function csvList(value: string | undefined): string[] {
	if (!value) return [];
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

function normalizeOrigin(value: string): string | null {
	try {
		const parsed = new URL(value);
		if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
			return null;
		}
		return parsed.origin;
	} catch {
		return null;
	}
}

function normalizeHostname(value: string): string | null {
	const hostname = value.trim().toLowerCase();
	if (!hostname) return null;
	if (/[^a-z0-9.-]/.test(hostname)) return null;
	if (!hostname.includes(".")) return null;
	return hostname;
}

function unique(values: readonly string[]): string[] {
	return Array.from(new Set(values));
}

export function getApprovedNativeOrigins(env: Env): string[] {
	const configured = csvList(env.NATIVE_APP_ORIGINS)
		.map((entry) => normalizeOrigin(entry))
		.filter((entry): entry is string => Boolean(entry));

	if (configured.length > 0) {
		return unique(configured);
	}

	return [...DEFAULT_NATIVE_APP_ORIGINS];
}

export function getTrustedAuthOrigins(env: Env, baseURL: string): string[] {
	const trusted = [baseURL, ...getApprovedNativeOrigins(env)];
	return unique(trusted);
}

export function isApprovedNativeOrigin(env: Env, origin: string | null): boolean {
	if (!origin) return false;
	const normalizedOrigin = normalizeOrigin(origin);
	if (!normalizedOrigin) return false;
	return getApprovedNativeOrigins(env).includes(normalizedOrigin);
}

export function getNativeOriginFromRequest(env: Env, origin: string | null): string | null {
	if (!origin) {
		return null;
	}

	const normalizedOrigin = normalizeOrigin(origin);
	if (!normalizedOrigin) {
		return null;
	}

	if (!isApprovedNativeOrigin(env, normalizedOrigin)) {
		return null;
	}

	return normalizedOrigin;
}

export function getExpectedTurnstileHostnames(env: Env): string[] {
	const configuredHostnames = csvList(env.TURNSTILE_ALLOWED_HOSTNAMES)
		.map((entry) => normalizeHostname(entry))
		.filter((entry): entry is string => Boolean(entry));

	const fromOrigins = getApprovedNativeOrigins(env)
		.map((origin) => {
			try {
				return new URL(origin).hostname;
			} catch {
				return null;
			}
		})
		.filter((hostname): hostname is string => Boolean(hostname))
		.map((hostname) => hostname.toLowerCase());

	const hostnames =
		configuredHostnames.length > 0
			? configuredHostnames
			: [...DEFAULT_TURNSTILE_HOSTNAMES];

	return unique([...hostnames, ...fromOrigins]);
}

export function stripAuthTokenForNonNativeOrigin(
	env: Env,
	requestOrigin: string | null,
	response: Response,
): Response {
	if (isApprovedNativeOrigin(env, requestOrigin)) {
		return response;
	}

	if (!response.headers.has("set-auth-token")) {
		return response;
	}

	const headers = new Headers(response.headers);
	headers.delete("set-auth-token");

	const expose = headers.get("access-control-expose-headers");
	if (expose) {
		const keep = expose
			.split(",")
			.map((value) => value.trim())
			.filter((value) => value.length > 0)
			.filter((value) => value.toLowerCase() !== "set-auth-token");
		if (keep.length > 0) {
			headers.set("access-control-expose-headers", keep.join(", "));
		} else {
			headers.delete("access-control-expose-headers");
		}
	}

	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
