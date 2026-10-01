import http from "node:http";

const API_BASE_URL = process.env.NATIVE_API_SMOKE_BASE_URL ?? "http://localhost:5173";
const WEB_ORIGIN = new URL(API_BASE_URL).origin;
const APPROVED_NATIVE_ORIGIN = "https://app.fivessportsbar.app";
const BLOCKED_ORIGIN = "https://evil.example.test";
const PASSWORD = "CoffeeBeans2026";
const STAMP = Date.now();

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function asHeaderString(value) {
	if (Array.isArray(value)) {
		return value.join(", ");
	}
	if (typeof value === "string") {
		return value;
	}
	return "";
}

function headerIncludes(value, expected) {
	const lower = asHeaderString(value).toLowerCase();
	return lower.includes(expected.toLowerCase());
}

function rawRequest(method, path, headers, bodyString) {
	return new Promise((resolve, reject) => {
		const target = new URL(path, API_BASE_URL);
		const req = http.request(
			{
				method,
				hostname: target.hostname,
				port: target.port,
				path: `${target.pathname}${target.search}`,
				headers,
				agent: false,
			},
			(res) => {
				const chunks = [];
				res.on("data", (chunk) => chunks.push(chunk));
				res.on("end", () => {
					resolve({
						status: res.statusCode ?? 0,
						headers: res.headers,
						body: Buffer.concat(chunks).toString("utf8"),
					});
				});
			},
		);
		req.on("error", reject);
		if (bodyString !== undefined) {
			req.write(bodyString);
		}
		req.end();
	});
}

class Session {
	constructor(origin) {
		this.origin = origin;
		this.cookies = {};
	}

	cookieHeader() {
		return Object.entries(this.cookies)
			.map(([name, value]) => `${name}=${value}`)
			.join("; ");
	}

	async request(method, path, body, extraHeaders = {}) {
		const headers = {
			Accept: "application/json",
			Origin: this.origin,
			...extraHeaders,
		};
		let bodyString;
		if (body !== undefined) {
			bodyString = JSON.stringify(body);
			headers["Content-Type"] = "application/json";
			headers["Content-Length"] = Buffer.byteLength(bodyString);
		}
		const cookieHeader = this.cookieHeader();
		if (cookieHeader) {
			headers.Cookie = cookieHeader;
		}

		const response = await rawRequest(method, path, headers, bodyString);
		const setCookies = response.headers["set-cookie"];
		if (Array.isArray(setCookies)) {
			for (const raw of setCookies) {
				const pair = raw.split(";")[0];
				const eqIndex = pair.indexOf("=");
				if (eqIndex === -1) continue;
				this.cookies[pair.slice(0, eqIndex).trim()] = pair.slice(eqIndex + 1).trim();
			}
		}

		let json = null;
		try {
			json = JSON.parse(response.body);
		} catch {
			json = null;
		}

		return {
			status: response.status,
			ok: response.status >= 200 && response.status < 300,
			headers: response.headers,
			json,
			body: response.body,
		};
	}
}

function describe(step) {
	console.log(`[native-api-smoke] ${step}`);
}

async function ensureCustomer(nativeSession, email) {
	const signUp = await nativeSession.request("POST", "/api/auth/sign-up/email", {
		name: "Native API Customer",
		email,
		password: PASSWORD,
	});
	if (signUp.ok) {
		return;
	}

	const signIn = await nativeSession.request("POST", "/api/auth/sign-in/email", {
		email,
		password: PASSWORD,
	});
	assert(signIn.ok, `Failed to register or sign in native customer: ${JSON.stringify(signIn.json)}`);
}

async function main() {
	describe("A: approved native preflight succeeds");
	const approvedPreflight = await rawRequest(
		"OPTIONS",
		"/api/auth/sign-in/email",
		{
			Origin: APPROVED_NATIVE_ORIGIN,
			"Access-Control-Request-Method": "POST",
			"Access-Control-Request-Headers":
				"Content-Type,Authorization,cf-turnstile-response,Accept",
		},
	);
	assert(
		approvedPreflight.status >= 200 && approvedPreflight.status < 300,
		`Expected approved preflight success, got ${approvedPreflight.status}`,
	);
	assert(
		asHeaderString(approvedPreflight.headers["access-control-allow-origin"]) === APPROVED_NATIVE_ORIGIN,
		"Approved preflight did not return exact Access-Control-Allow-Origin",
	);
	assert(
		headerIncludes(approvedPreflight.headers["access-control-allow-methods"], "POST"),
		"Approved preflight missing POST in Access-Control-Allow-Methods",
	);
	for (const requiredHeader of ["content-type", "authorization", "cf-turnstile-response", "accept"]) {
		assert(
			headerIncludes(approvedPreflight.headers["access-control-allow-headers"], requiredHeader),
			`Approved preflight missing ${requiredHeader} in Access-Control-Allow-Headers`,
		);
	}

	describe("B: unknown origin preflight is rejected");
	const blockedPreflight = await rawRequest(
		"OPTIONS",
		"/api/auth/sign-in/email",
		{
			Origin: BLOCKED_ORIGIN,
			"Access-Control-Request-Method": "POST",
			"Access-Control-Request-Headers": "Content-Type,Authorization",
		},
	);
	assert(
		blockedPreflight.status === 403 ||
			asHeaderString(blockedPreflight.headers["access-control-allow-origin"]) !== BLOCKED_ORIGIN,
		`Unknown-origin preflight was not rejected (status ${blockedPreflight.status})`,
	);

	const email = `native.api.${STAMP}@example.test`;
	const nativeSession = new Session(APPROVED_NATIVE_ORIGIN);
	await ensureCustomer(nativeSession, email);

	describe("C: native sign-in returns bearer token");
	const nativeSignIn = await nativeSession.request("POST", "/api/auth/sign-in/email", {
		email,
		password: PASSWORD,
	});
	assert(nativeSignIn.ok, `Native sign-in failed: ${JSON.stringify(nativeSignIn.json)}`);
	const nativeToken = asHeaderString(nativeSignIn.headers["set-auth-token"]);
	assert(nativeToken.length > 0, "Native sign-in did not return set-auth-token header");
	assert(
		headerIncludes(nativeSignIn.headers["access-control-expose-headers"], "set-auth-token"),
		"Native sign-in did not expose set-auth-token via Access-Control-Expose-Headers",
	);

	describe("D: bearer token can call /api/me");
	const nativeMe = await rawRequest(
		"GET",
		"/api/me",
		{
			Origin: APPROVED_NATIVE_ORIGIN,
			Accept: "application/json",
			Authorization: `Bearer ${nativeToken}`,
		},
	);
	assert(nativeMe.status === 200, `Bearer /api/me failed with ${nativeMe.status}`);

	describe("E/F: web login remains cookie-based and cannot read set-auth-token");
	const webSession = new Session(WEB_ORIGIN);
	const webSignIn = await webSession.request("POST", "/api/auth/sign-in/email", {
		email,
		password: PASSWORD,
	});
	assert(webSignIn.ok, `Web sign-in failed: ${JSON.stringify(webSignIn.json)}`);
	assert(
		Array.isArray(webSignIn.headers["set-cookie"]) && webSignIn.headers["set-cookie"].length > 0,
		"Web sign-in did not return session cookies",
	);
	assert(
		asHeaderString(webSignIn.headers["set-auth-token"]).length === 0,
		"Web sign-in unexpectedly exposed set-auth-token",
	);
	assert(
		!headerIncludes(webSignIn.headers["access-control-expose-headers"], "set-auth-token"),
		"Web sign-in unexpectedly exposed set-auth-token in Access-Control-Expose-Headers",
	);
	const webMe = await webSession.request("GET", "/api/me");
	assert(webMe.status === 200, `Web cookie session /api/me failed with ${webMe.status}`);

	describe("G: invalid bearer token is rejected");
	const invalidBearer = await rawRequest(
		"GET",
		"/api/me",
		{
			Origin: APPROVED_NATIVE_ORIGIN,
			Accept: "application/json",
			Authorization: "Bearer not-a-valid-token",
		},
	);
	assert(invalidBearer.status === 401, `Invalid bearer token expected 401, got ${invalidBearer.status}`);

	describe("H: logout revokes native bearer session");
	const signOut = await nativeSession.request(
		"POST",
		"/api/auth/sign-out",
		{},
		{ Authorization: `Bearer ${nativeToken}` },
	);
	assert(signOut.status >= 200 && signOut.status < 300, `Native sign-out failed with ${signOut.status}`);
	const meAfterSignOut = await rawRequest(
		"GET",
		"/api/me",
		{
			Origin: APPROVED_NATIVE_ORIGIN,
			Accept: "application/json",
			Authorization: `Bearer ${nativeToken}`,
		},
	);
	assert(
		meAfterSignOut.status === 401,
		`Expected revoked bearer token to fail with 401, got ${meAfterSignOut.status}`,
	);

	describe("I/J: Turnstile remains enforced in production");
	const health = await rawRequest("GET", "/api/health", {
		Accept: "application/json",
		Origin: WEB_ORIGIN,
	});
	let healthJson = null;
	try {
		healthJson = JSON.parse(health.body);
	} catch {
		healthJson = null;
	}
	const environment = healthJson?.data?.environment ?? "unknown";
	if (environment === "production") {
		const turnstileAttempt = await nativeSession.request("POST", "/api/auth/sign-in/email", {
			email,
			password: PASSWORD,
		});
		assert(
			turnstileAttempt.status === 400 && turnstileAttempt.json?.error?.code === "turnstile_verification_failed",
			`Expected Turnstile enforcement failure in production, got ${turnstileAttempt.status}: ${JSON.stringify(turnstileAttempt.json)}`,
		);
	} else {
		console.log("[native-api-smoke] Turnstile enforcement check skipped outside production");
	}

	console.log("native-api-smoke passed");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
