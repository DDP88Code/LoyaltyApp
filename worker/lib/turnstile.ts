const TURNSTILE_SITEVERIFY_URL =
	"https://challenges.cloudflare.com/turnstile/v0/siteverify";
const PRODUCTION_TURNSTILE_HOSTNAME =
	"fives-rewards-production.fives-rewards.workers.dev";
const TURNSTILE_TOKEN_TTL_MS = 5 * 60 * 1000;

const consumedTurnstileTokens = new Map<string, number>();

export type TurnstileAuthAction = "sign-in" | "sign-up";

type TurnstileVerificationResult =
	| { ok: true }
	| { ok: false; status: 400 | 503; message: string };

type TurnstileSiteverifyResponse = {
	success?: boolean;
	"error-codes"?: string[];
	action?: string;
	hostname?: string;
};

function pruneExpiredTokenFingerprints(nowMs: number) {
	for (const [fingerprint, expiresAt] of consumedTurnstileTokens) {
		if (expiresAt <= nowMs) {
			consumedTurnstileTokens.delete(fingerprint);
		}
	}
}

async function sha256Hex(value: string): Promise<string> {
	const encoded = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest("SHA-256", encoded);
	const bytes = new Uint8Array(digest);
	let hex = "";
	for (const byte of bytes) {
		hex += byte.toString(16).padStart(2, "0");
	}
	return hex;
}

function isProtectedAuthPath(pathname: string): TurnstileAuthAction | null {
	if (pathname.endsWith("/auth/sign-in/email")) return "sign-in";
	if (pathname.endsWith("/auth/sign-up/email")) return "sign-up";
	return null;
}

function shouldEnforceTurnstile(env: Env): boolean {
	const appEnv = (env as { APP_ENV?: string }).APP_ENV;
	return (
		appEnv === "production" &&
		typeof env.TURNSTILE_SECRET_KEY === "string" &&
		env.TURNSTILE_SECRET_KEY.trim().length > 0
	);
}

async function verifyTurnstileToken({
	secret,
	token,
	remoteIp,
	expectedAction,
	expectedHostname,
}: {
	secret: string;
	token: string;
	remoteIp: string | null;
	expectedAction: TurnstileAuthAction;
	expectedHostname: string | null;
}): Promise<TurnstileVerificationResult> {
	const nowMs = Date.now();
	pruneExpiredTokenFingerprints(nowMs);
	const tokenFingerprint = await sha256Hex(token);
	if (consumedTurnstileTokens.has(tokenFingerprint)) {
		console.warn("Turnstile token replay blocked", {
			expectedAction,
		});
		return {
			ok: false,
			status: 400,
			message: "We couldn't verify this request. Please try again.",
		};
	}

	const payload = new URLSearchParams({
		secret,
		response: token,
	});

	if (remoteIp && remoteIp.trim().length > 0) {
		payload.set("remoteip", remoteIp.trim());
	}

	let verifyResponse: Response;
	try {
		verifyResponse = await fetch(TURNSTILE_SITEVERIFY_URL, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: payload.toString(),
		});
	} catch (error) {
		console.error("Turnstile verification request failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return {
			ok: false,
			status: 503,
			message: "We couldn't verify this request. Please try again.",
		};
	}

	let parsed: TurnstileSiteverifyResponse | null = null;
	try {
		parsed = (await verifyResponse.json()) as TurnstileSiteverifyResponse;
	} catch {
		parsed = null;
	}

	if (!verifyResponse.ok || !parsed?.success) {
		console.warn("Turnstile rejected auth request", {
			httpStatus: verifyResponse.status,
			errorCodes: parsed?.["error-codes"] ?? [],
			expectedAction,
		});
		return {
			ok: false,
			status: 400,
			message: "We couldn't verify this request. Please try again.",
		};
	}

	if (parsed.action && parsed.action !== expectedAction) {
		console.warn("Turnstile action mismatch", {
			expectedAction,
			actualAction: parsed.action,
		});
		return {
			ok: false,
			status: 400,
			message: "We couldn't verify this request. Please try again.",
		};
	}

	if (expectedHostname && parsed.hostname !== expectedHostname) {
		console.warn("Turnstile hostname mismatch", {
			expectedHostname,
			actualHostname: parsed.hostname ?? "missing",
			expectedAction,
		});
		return {
			ok: false,
			status: 400,
			message: "We couldn't verify this request. Please try again.",
		};
	}

	consumedTurnstileTokens.set(tokenFingerprint, nowMs + TURNSTILE_TOKEN_TTL_MS);

	return { ok: true };
}

export async function verifyTurnstileForAuthRequest(
	request: Request,
	env: Env,
): Promise<TurnstileVerificationResult> {
	if (request.method !== "POST") return { ok: true };

	const requestUrl = new URL(request.url);
	const action = isProtectedAuthPath(requestUrl.pathname);
	if (!action) return { ok: true };

	if (!shouldEnforceTurnstile(env)) {
		return { ok: true };
	}

	const token = request.headers.get("cf-turnstile-response")?.trim() ?? "";
	if (!token) {
		return {
			ok: false,
			status: 400,
			message: "We couldn't verify this request. Please try again.",
		};
	}

	const expectedHostname =
		(env as { APP_ENV?: string }).APP_ENV === "production"
			? PRODUCTION_TURNSTILE_HOSTNAME
			: null;

	return verifyTurnstileToken({
		secret: env.TURNSTILE_SECRET_KEY,
		token,
		remoteIp: request.headers.get("CF-Connecting-IP"),
		expectedAction: action,
		expectedHostname,
	});
}