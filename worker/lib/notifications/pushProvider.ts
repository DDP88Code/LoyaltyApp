const PUSH_TTL_SECONDS = 120;
const PUSH_URGENCY = "normal";
const VAPID_JWT_TTL_SECONDS = 12 * 60 * 60;

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
): Promise<string> {
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

	return `${unsigned}.${base64UrlEncode(new Uint8Array(signature))}`;
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
		const jwt = await createVapidJwt(audience, subject, publicKey, privateKey);

		let response: Response;
		try {
			response = await fetch(subscription.endpoint, {
				method: "POST",
				headers: {
					Authorization: `vapid t=${jwt}, k=${publicKey}`,
					TTL: String(PUSH_TTL_SECONDS),
					Urgency: PUSH_URGENCY,
					"Content-Length": "0",
				},
			});
		} catch {
			return { ok: false, gone: false, status: 0 };
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
