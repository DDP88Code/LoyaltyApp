const PUSH_TTL_SECONDS = 120;
const PUSH_URGENCY = "normal";
const VAPID_JWT_TTL_SECONDS = 12 * 60 * 60;
const PUSH_RESPONSE_BODY_LOG_LIMIT = 240;

export interface PushSubscriptionRecord {
	id: string;
	endpoint: string;
	p256dhKey: string;
	authKey: string;
	deviceLabel: string | null;
}

export interface PushNotificationPayload {
	notificationId: string;
	type: string;
	title: string;
	message: string;
	actionUrl: string | null;
}

export interface PushDeliveryResult {
	ok: boolean;
	gone: boolean;
	status: number;
}

export interface PushProvider {
	send(
		subscription: PushSubscriptionRecord,
		payload: PushNotificationPayload,
	): Promise<PushDeliveryResult>;
}

export function isWebPushConfigured(env: Env): boolean {
	return Boolean(env.WEB_PUSH_VAPID_PUBLIC_KEY && env.WEB_PUSH_VAPID_PRIVATE_KEY);
}

function base64UrlEncode(input: Uint8Array): string {
	let binary = "";
	for (const value of input) {
		binary += String.fromCharCode(value);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string): Uint8Array {
	const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

function splitPublicKey(publicKey: string): { x: string; y: string } {
	const raw = base64UrlDecode(publicKey);
	if (raw.length !== 65 || raw[0] !== 4) {
		throw new Error("WEB_PUSH_VAPID_PUBLIC_KEY must be an uncompressed P-256 key.");
	}
	const x = raw.slice(1, 33);
	const y = raw.slice(33, 65);
	return { x: base64UrlEncode(x), y: base64UrlEncode(y) };
}

function isLikelyValidVapidSubject(subject: string): boolean {
	const trimmed = subject.trim();
	if (trimmed.length === 0) return false;
	if (trimmed.startsWith("mailto:")) return trimmed.length > "mailto:".length;
	if (trimmed.startsWith("https://")) return true;
	return false;
}

function isLikelyValidEndpoint(endpoint: string): boolean {
	try {
		const value = new URL(endpoint);
		return value.protocol === "https:";
	} catch {
		return false;
	}
}

function isLikelyValidP256dhKey(value: string): boolean {
	try {
		const decoded = base64UrlDecode(value);
		return decoded.length === 65 && decoded[0] === 4;
	} catch {
		return false;
	}
}

function isLikelyValidAuthKey(value: string): boolean {
	try {
		const decoded = base64UrlDecode(value);
		return decoded.length >= 16;
	} catch {
		return false;
	}
}

let cachedPairVerification:
	| {
		publicKey: string;
		privateKey: string;
		verified: Promise<boolean>;
	}
	| undefined;

async function verifyVapidPair(
	publicKey: string,
	privateKey: string,
): Promise<boolean> {
	if (
		cachedPairVerification &&
		cachedPairVerification.publicKey === publicKey &&
		cachedPairVerification.privateKey === privateKey
	) {
		return cachedPairVerification.verified;
	}

	const verified = (async () => {
		try {
			const { x, y } = splitPublicKey(publicKey);
			const verifyKey = await crypto.subtle.importKey(
				"jwk",
				{ kty: "EC", crv: "P-256", x, y, ext: false },
				{ name: "ECDSA", namedCurve: "P-256" },
				false,
				["verify"],
			);

			const signingKey = await getSigningKey(publicKey, privateKey);
			const data = new TextEncoder().encode("fives-web-push-vapid-self-check");
			const signature = await crypto.subtle.sign(
				{ name: "ECDSA", hash: "SHA-256" },
				signingKey,
				data,
			);

			return await crypto.subtle.verify(
				{ name: "ECDSA", hash: "SHA-256" },
				verifyKey,
				signature,
				data,
			);
		} catch {
			return false;
		}
	})();

	cachedPairVerification = {
		publicKey,
		privateKey,
		verified,
	};
	return verified;
}

let cachedKeyMaterial:
	| {
		publicKey: string;
		privateKey: string;
		signingKey: Promise<CryptoKey>;
	}
	| undefined;

function getSigningKey(publicKey: string, privateKey: string): Promise<CryptoKey> {
	if (
		cachedKeyMaterial &&
		cachedKeyMaterial.publicKey === publicKey &&
		cachedKeyMaterial.privateKey === privateKey
	) {
		return cachedKeyMaterial.signingKey;
	}

	const { x, y } = splitPublicKey(publicKey);
	const jwk: JsonWebKey = {
		kty: "EC",
		crv: "P-256",
		x,
		y,
		d: privateKey,
		ext: false,
	};

	const signingKey = crypto.subtle.importKey(
		"jwk",
		jwk,
		{ name: "ECDSA", namedCurve: "P-256" },
		false,
		["sign"],
	);

	cachedKeyMaterial = {
		publicKey,
		privateKey,
		signingKey,
	};
	return signingKey;
}

async function createVapidJwt(
	audience: string,
	subject: string,
	publicKey: string,
	privateKey: string,
): Promise<{ token: string; signatureBytes: number }> {
	const now = Math.floor(Date.now() / 1000);
	const header = { alg: "ES256", typ: "JWT" };
	const payload = {
		aud: audience,
		exp: now + VAPID_JWT_TTL_SECONDS,
		sub: subject,
	};

	const encodedHeader = base64UrlEncode(
		new TextEncoder().encode(JSON.stringify(header)),
	);
	const encodedPayload = base64UrlEncode(
		new TextEncoder().encode(JSON.stringify(payload)),
	);
	const unsigned = `${encodedHeader}.${encodedPayload}`;

	const signingKey = await getSigningKey(publicKey, privateKey);
	const signature = await crypto.subtle.sign(
		{ name: "ECDSA", hash: "SHA-256" },
		signingKey,
		new TextEncoder().encode(unsigned),
	);

	return {
		token: `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`,
		signatureBytes: signature.byteLength,
	};
}

class WebPushProvider implements PushProvider {
	constructor(private readonly env: Env) {}

	async send(
		subscription: PushSubscriptionRecord,
		_payload: PushNotificationPayload,
	): Promise<PushDeliveryResult> {
		if (!isWebPushConfigured(this.env)) {
			return { ok: false, gone: false, status: 0 };
		}

		const endpoint = new URL(subscription.endpoint);
		const audience = `${endpoint.protocol}//${endpoint.host}`;
		const publicKey = this.env.WEB_PUSH_VAPID_PUBLIC_KEY;
		const privateKey = this.env.WEB_PUSH_VAPID_PRIVATE_KEY;
		if (!publicKey || !privateKey) {
			return { ok: false, gone: false, status: 0 };
		}
		const subject = this.env.WEB_PUSH_VAPID_SUBJECT ?? "mailto:notifications@fives.invalid";
		const vapidPairValid = await verifyVapidPair(publicKey, privateKey);
		const jwt = await createVapidJwt(audience, subject, publicKey, privateKey);

		const endpointValid = isLikelyValidEndpoint(subscription.endpoint);
		const p256dhValid = isLikelyValidP256dhKey(subscription.p256dhKey);
		const authValid = isLikelyValidAuthKey(subscription.authKey);
		if (!endpointValid || !p256dhValid || !authValid) {
			console.warn("Web push subscription format looks invalid", {
				subscriptionId: subscription.id,
				endpointHost: endpoint.host,
				endpointValid,
				p256dhValid,
				authValid,
			});
		}

		let response: Response;
		try {
			response = await fetch(subscription.endpoint, {
				method: "POST",
				headers: {
					Authorization: `vapid t=${jwt.token}, k=${publicKey}`,
					TTL: String(PUSH_TTL_SECONDS),
					Urgency: PUSH_URGENCY,
					"Content-Length": "0",
				},
			});
		} catch {
			console.warn("Web push network error", {
				subscriptionId: subscription.id,
				endpointHost: endpoint.host,
				vapidPairValid,
				jwtSignatureBytes: jwt.signatureBytes,
				subjectValid: isLikelyValidVapidSubject(subject),
			});
			return { ok: false, gone: false, status: 0 };
		}

		if (!response.ok) {
			let body: string | null = null;
			try {
				const text = await response.text();
				if (text.trim().length > 0) {
					body = text.slice(0, PUSH_RESPONSE_BODY_LOG_LIMIT);
				}
			} catch {
				body = null;
			}

			console.warn("Web push rejected by push service", {
				subscriptionId: subscription.id,
				endpointHost: endpoint.host,
				status: response.status,
				responseBody: body,
				vapidPairValid,
				jwtSignatureBytes: jwt.signatureBytes,
				subjectConfigured: Boolean(this.env.WEB_PUSH_VAPID_SUBJECT),
				subjectValid: isLikelyValidVapidSubject(subject),
			});
		}

		return {
			ok: response.ok,
			gone: response.status === 404 || response.status === 410,
			status: response.status,
		};
	}
}

export function createPushProvider(env: Env): PushProvider {
	return new WebPushProvider(env);
}
