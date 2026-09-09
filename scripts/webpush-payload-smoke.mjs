// Proves the Web Push payload race is fixed: two reward_earned notifications
// created seconds apart must each arrive as their own encrypted push payload
// (own id/title/message), never resolving to a shared "latest unread" row.
// Acts as its own fake push service so the real aes128gcm body sent by the
// Worker can be captured and decrypted here. Run: node ./scripts/webpush-payload-smoke.mjs
import { execSync } from "node:child_process";
import crypto from "node:crypto";
import http from "node:http";

const ORIGIN = "http://localhost:5173";
const PASSWORD = "CoffeeBeans2026";
const STAMP = Date.now();

function base64url(buffer) {
	return buffer
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function hmacSha256(key, data) {
	return crypto.createHmac("sha256", key).update(data).digest();
}

function hkdf(salt, ikm, info, length) {
	const prk = hmacSha256(salt, ikm);
	const t1 = hmacSha256(prk, Buffer.concat([info, Buffer.from([1])]));
	return t1.subarray(0, length);
}

/** Reverses the Worker's RFC 8291 (aes128gcm) encryption using our own subscriber keys. */
function decryptAes128Gcm(body, ecdh, authSecret) {
	const salt = body.subarray(0, 16);
	const idlen = body.readUInt8(20);
	const serverPublicKey = body.subarray(21, 21 + idlen);
	const ciphertextWithTag = body.subarray(21 + idlen);

	const ecdhSecret = ecdh.computeSecret(serverPublicKey);
	const uaPublicKey = ecdh.getPublicKey();

	const keyInfo = Buffer.concat([
		Buffer.from("WebPush: info\0", "utf8"),
		uaPublicKey,
		serverPublicKey,
	]);
	const ikm = hkdf(authSecret, ecdhSecret, keyInfo, 32);
	const cek = hkdf(salt, ikm, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
	const nonce = hkdf(salt, ikm, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);

	const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
	const encrypted = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);

	const decipher = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
	decipher.setAuthTag(tag);
	const plainWithDelimiter = Buffer.concat([decipher.update(encrypted), decipher.final()]);
	return plainWithDelimiter.subarray(0, plainWithDelimiter.length - 1);
}

function createFakePushServer() {
	const received = [];
	const server = http.createServer((req, res) => {
		const chunks = [];
		req.on("data", (chunk) => chunks.push(chunk));
		req.on("end", () => {
			received.push({
				headers: { ...req.headers },
				body: Buffer.concat(chunks),
			});
			res.statusCode = 201;
			res.end();
		});
	});
	return { server, received };
}

/** Plain http.request with a fresh connection per call — the dev server's Miniflare
 * proxy can reset pooled keep-alive sockets between requests, which breaks fetch(). */
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
			json,
		};
	}
}


async function ensureUserWithRole(email, name, role) {
	const probe = new Session();
	const login = await probe.request("POST", "/api/auth/sign-in/email", {
		email,
		password: PASSWORD,
	});
	if (!login.ok) {
		await probe.request("POST", "/api/auth/sign-up/email", { name, email, password: PASSWORD });
	}
	execSync(
		`npx wrangler d1 execute fives-rewards-db --local --command "UPDATE profiles SET role='${role}', active=1 WHERE email='${email}'"`,
		{ stdio: "ignore" },
	);

	const session = new Session();
	const relogin = await session.request("POST", "/api/auth/sign-in/email", {
		email,
		password: PASSWORD,
	});
	if (!relogin.ok) {
		throw new Error(`Failed to sign in as ${email} after role update: ${JSON.stringify(relogin.json)}`);
	}
	return session;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate, timeoutMs, intervalMs = 250) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (predicate()) return true;
		await sleep(intervalMs);
	}
	return predicate();
}

async function main() {
	const { server, received } = createFakePushServer();
	await new Promise((resolve) => server.listen(0, resolve));
	const port = server.address().port;

	try {
		await new Session().request("POST", "/api/dev/seed");

		const adminSession = await ensureUserWithRole("admin@example.test", "Admin User", "admin");
		const staffSession = await ensureUserWithRole(
			"webpush.staff@example.test",
			"WebPush Staff",
			"staff",
		);

		const customerEmail = `webpush.customer.${STAMP}@example.test`;
		const customerSession = new Session();
		const registered = await customerSession.request("POST", "/api/auth/sign-up/email", {
			name: "WebPush Customer",
			email: customerEmail,
			password: PASSWORD,
		});
		if (!registered.ok) {
			throw new Error(`Failed to register test customer: ${JSON.stringify(registered.json)}`);
		}
		const me = await customerSession.request("GET", "/api/me");
		const customerId = me.json?.data?.user?.id;
		if (!customerId) throw new Error("Could not resolve test customer id");

		const ecdh = crypto.createECDH("prime256v1");
		ecdh.generateKeys();
		const p256dhKey = base64url(ecdh.getPublicKey());
		const authSecret = crypto.randomBytes(16);
		const authKey = base64url(authSecret);

		const subscribed = await customerSession.request("POST", "/api/customer/push/subscriptions", {
			endpoint: `http://127.0.0.1:${port}/push`,
			p256dhKey,
			authKey,
			deviceLabel: "webpush-smoke",
		});
		if (!subscribed.ok) {
			throw new Error(`Failed to register push subscription: ${JSON.stringify(subscribed.json)}`);
		}

		const staffContext = await staffSession.request("GET", "/api/staff/context");
		const locationId = staffContext.json?.data?.locations?.[0]?.id;
		if (!locationId) throw new Error("No staff location available");

		const programs = await adminSession.request("GET", "/api/admin/loyalty/programs");
		const coffeeProgram = programs.json?.data?.programs?.find(
			(program) => program.currencyCode === "COFFEE",
		);
		if (!coffeeProgram) throw new Error("Coffee program not found");

		const thresholdPatch = await adminSession.request(
			"Patch",
			`/api/admin/loyalty/programs/${coffeeProgram.id}`,
			{ qualifyingPurchasesRequired: 2, active: true },
		);
		if (!thresholdPatch.ok) {
			throw new Error(`Failed to set coffee threshold: ${JSON.stringify(thresholdPatch.json)}`);
		}

		const earn1 = await staffSession.request(
			"POST",
			`/api/staff/customers/${customerId}/coffee`,
			{
				locationId,
				quantity: 2,
				billReference: "WEBPUSH-TEST-1",
				idempotencyKey: `webpush-test-1-${STAMP}`,
			},
		);
		if (!earn1.ok || earn1.json?.data?.newlyIssuedCount !== 1) {
			throw new Error(`First reward event did not issue exactly one reward: ${JSON.stringify(earn1.json)}`);
		}

		await sleep(3000);

		const earn2 = await staffSession.request(
			"POST",
			`/api/staff/customers/${customerId}/coffee`,
			{
				locationId,
				quantity: 2,
				billReference: "WEBPUSH-TEST-2",
				idempotencyKey: `webpush-test-2-${STAMP}`,
			},
		);
		if (!earn2.ok || earn2.json?.data?.newlyIssuedCount !== 1) {
			throw new Error(`Second reward event did not issue exactly one reward: ${JSON.stringify(earn2.json)}`);
		}

		await waitFor(() => received.length >= 2, 8000);
		if (received.length < 2) {
			throw new Error(`Expected at least 2 push deliveries, received ${received.length}`);
		}

		const decoded = received.slice(0, 2).map((entry) => {
			if (entry.headers["content-encoding"] !== "aes128gcm") {
				throw new Error(
					`Expected aes128gcm content-encoding, got: ${entry.headers["content-encoding"]}`,
				);
			}
			const plaintext = decryptAes128Gcm(entry.body, ecdh, authSecret);
			return JSON.parse(plaintext.toString("utf8"));
		});

		const [first, second] = decoded;
		if (!first.id || !second.id) {
			throw new Error(`Decrypted payload missing id: ${JSON.stringify(decoded)}`);
		}
		if (first.id === second.id) {
			throw new Error("Both push payloads resolved to the same notification id");
		}
		for (const payload of decoded) {
			if (payload.title !== "Free Coffee Unlocked ☕") {
				throw new Error(`Unexpected title in decrypted payload: ${JSON.stringify(payload)}`);
			}
			if (payload.message !== "Your next coffee is on us.") {
				throw new Error(`Unexpected message in decrypted payload: ${JSON.stringify(payload)}`);
			}
			if (payload.type !== "reward_earned") {
				throw new Error(`Unexpected type in decrypted payload: ${JSON.stringify(payload)}`);
			}
		}

		console.log("Web push payload smoke checks passed");
		console.log(`push1.id=${first.id} push2.id=${second.id}`);
	} finally {
		server.close();
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
