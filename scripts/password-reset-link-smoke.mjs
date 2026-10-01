// Proves Better Auth's own GET reset-password link is served by the Worker
// (never the SPA shell) and correctly redirects to /reset-password?token=...,
// and that authClient.resetPassword() can then consume that exact token.
// Run: node ./scripts/password-reset-link-smoke.mjs
import { execSync } from "node:child_process";
import http from "node:http";

const ORIGIN = "http://localhost:5173";
const WEB_ORIGIN = "https://fivessportsbar.app";
const PASSWORD = "CoffeeBeans2026";
const NEW_PASSWORD = "NewCoffeeBeans2026";
const STAMP = Date.now();

function rawRequest(method, path, headers, bodyString) {
	return new Promise((resolve, reject) => {
		const target = new URL(`${ORIGIN}${path}`);
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
						status: res.statusCode,
						headers: res.headers,
						body: Buffer.concat(chunks).toString("utf8"),
					});
				});
			},
		);
		req.on("error", reject);
		if (bodyString !== undefined) req.write(bodyString);
		req.end();
	});
}

class Session {
	constructor() {
		this.cookies = {};
	}

	cookieHeader() {
		return Object.entries(this.cookies)
			.map(([name, value]) => `${name}=${value}`)
			.join("; ");
	}

	async request(method, path, body) {
		const headers = { Accept: "application/json", Origin: ORIGIN };
		let bodyString;
		if (body !== undefined) {
			bodyString = JSON.stringify(body);
			headers["Content-Type"] = "application/json";
			headers["Content-Length"] = Buffer.byteLength(bodyString);
		}
		const cookieHeader = this.cookieHeader();
		if (cookieHeader) headers.Cookie = cookieHeader;

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
		};
	}
}

function d1QueryLocal(sql) {
	const output = execSync(
		`npx wrangler d1 execute fives-rewards-db --local --command "${sql.replace(/"/g, '\\"')}" --json`,
		{ encoding: "utf8" },
	);
	const parsed = JSON.parse(output);
	return parsed[0]?.results ?? [];
}

async function main() {
	await new Session().request("POST", "/api/dev/seed");

	const email = `reset-link.${STAMP}@example.test`;
	const customerSession = new Session();
	const registered = await customerSession.request("POST", "/api/auth/sign-up/email", {
		name: "Reset Link Customer",
		email,
		password: PASSWORD,
	});
	if (!registered.ok) {
		throw new Error(`Failed to register test customer: ${JSON.stringify(registered.json)}`);
	}
	// Better Auth's own user id (not our profiles.id) is what verification.value stores.
	const authUserId = registered.json?.user?.id;
	if (!authUserId) throw new Error("Could not resolve Better Auth user id");

	const redirectTo = `${ORIGIN}/reset-password`;
	const requestReset = await new Session().request("POST", "/api/auth/request-password-reset", {
		email,
		redirectTo,
	});
	if (!requestReset.ok || requestReset.json?.status !== true) {
		throw new Error(`request-password-reset failed: ${JSON.stringify(requestReset.json)}`);
	}

	const rows = d1QueryLocal(
		`SELECT identifier FROM verification WHERE value='${authUserId}' AND identifier LIKE 'reset-password:%' ORDER BY created_at DESC LIMIT 1;`,
	);
	const identifier = rows[0]?.identifier;
	if (!identifier) throw new Error("No reset-password verification row was created");
	const token = identifier.replace(/^reset-password:/, "");
	if (!token) throw new Error("Could not extract reset token");

	const linkPath = `/api/auth/reset-password/${token}?callbackURL=${encodeURIComponent(redirectTo)}`;
	const linkResponse = await new Session().request("GET", linkPath);

	if (linkResponse.status < 300 || linkResponse.status >= 400) {
		throw new Error(
			`Expected the emailed reset link to redirect (3xx), got ${linkResponse.status}. This is the SPA-404 regression if status is 200/404.`,
		);
	}
	const location = linkResponse.headers.location;
	if (!location || !location.startsWith(redirectTo)) {
		throw new Error(`Reset link did not redirect to ${redirectTo}, got: ${location}`);
	}
	const redirectedToken = new URL(location).searchParams.get("token");
	if (redirectedToken !== token) {
		throw new Error(`Redirect token mismatch: expected ${token}, got ${redirectedToken}`);
	}

	const resetResult = await new Session().request("POST", "/api/auth/reset-password", {
		newPassword: NEW_PASSWORD,
		token: redirectedToken,
	});
	if (!resetResult.ok || resetResult.json?.status !== true) {
		throw new Error(`resetPassword failed to consume the token: ${JSON.stringify(resetResult.json)}`);
	}

	const replay = await new Session().request("POST", "/api/auth/reset-password", {
		newPassword: "AnotherPassword2026",
		token: redirectedToken,
	});
	if (replay.ok) {
		throw new Error("Reset token was accepted a second time; it must be single-use");
	}

	const signInWithNewPassword = await new Session().request("POST", "/api/auth/sign-in/email", {
		email,
		password: NEW_PASSWORD,
	});
	if (!signInWithNewPassword.ok) {
		throw new Error(`Sign-in with the new password failed: ${JSON.stringify(signInWithNewPassword.json)}`);
	}

	const nativeRedirectTo = `${WEB_ORIGIN}/reset-password`;
	const nativeResetRequest = await new Session().request("POST", "/api/auth/request-password-reset", {
		email,
		redirectTo: nativeRedirectTo,
	});
	if (!nativeResetRequest.ok) {
		if (nativeResetRequest.json?.code !== "INVALID_REDIRECT_URL") {
			throw new Error(
				`native redirect request-password-reset failed unexpectedly: ${JSON.stringify(nativeResetRequest.json)}`,
			);
		}
		console.log("Native reset redirect validation is constrained by local trusted-origin rules; INVALID_REDIRECT_URL confirmed.");
	} else {
		if (nativeResetRequest.json?.status !== true) {
			throw new Error(
				`native redirect request-password-reset did not succeed: ${JSON.stringify(nativeResetRequest.json)}`,
			);
		}

		const nativeRows = d1QueryLocal(
			`SELECT identifier FROM verification WHERE value='${authUserId}' AND identifier LIKE 'reset-password:%' ORDER BY created_at DESC LIMIT 1;`,
		);
		const nativeIdentifier = nativeRows[0]?.identifier;
		if (!nativeIdentifier) throw new Error("No native redirect reset-password verification row was created");
		const nativeToken = nativeIdentifier.replace(/^reset-password:/, "");
		if (!nativeToken) throw new Error("Could not extract native reset token");

		const nativeLinkPath = `/api/auth/reset-password/${nativeToken}?callbackURL=${encodeURIComponent(nativeRedirectTo)}`;
		const nativeLinkResponse = await new Session().request("GET", nativeLinkPath);
		if (nativeLinkResponse.status < 300 || nativeLinkResponse.status >= 400) {
			throw new Error(
				`Expected native redirect reset link to return 3xx, got ${nativeLinkResponse.status}`,
			);
		}
		const nativeLocation = nativeLinkResponse.headers.location;
		if (!nativeLocation || !nativeLocation.startsWith(nativeRedirectTo)) {
			throw new Error(`Native redirect did not target ${nativeRedirectTo}, got: ${nativeLocation}`);
		}
		const nativeRedirectedToken = new URL(nativeLocation).searchParams.get("token");
		if (nativeRedirectedToken !== nativeToken) {
			throw new Error(`Native redirect token mismatch: expected ${nativeToken}, got ${nativeRedirectedToken}`);
		}
	}

	console.log("Password reset link routing smoke checks passed");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
