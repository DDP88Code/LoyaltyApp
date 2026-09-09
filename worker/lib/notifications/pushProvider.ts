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

const WEB_PUSH_MAX_PAYLOAD_BYTES = 3800;

function concatBytes(...parts: Uint8Array[]): Uint8Array {
	const total = parts.reduce((sum, part) => sum + part.length, 0);
	const result = new Uint8Array(total);
	let offset = 0;
	for (const part of parts) {
		result.set(part, offset);
		offset += part.length;
	}
	return result;
}

async function hmacSha256(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		"raw",
		keyBytes,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, data);
	return new Uint8Array(signature);
}

/** HKDF-Extract-then-Expand for outputs no longer than one SHA-256 block (32 bytes). */
async function hkdf(
	salt: Uint8Array,
	ikm: Uint8Array,
	info: Uint8Array,
	length: number,
): Promise<Uint8Array> {
	const prk = await hmacSha256(salt, ikm);
	const t1 = await hmacSha256(prk, concatBytes(info, new Uint8Array([1])));
	return t1.slice(0, length);
}

/**
 * Encrypts a Web Push message body per RFC 8291 (aes128gcm) so the browser's
 * Push API can decrypt it and hand the service worker a real `event.data`
 * payload, instead of the service worker having to guess the notification by
 * fetching "the latest unread" one.
 */
async function encryptWebPushPayload(
	plaintext: Uint8Array,
	p256dhKey: string,
	authKey: string,
): Promise<Uint8Array> {
	const subscriberPublicKeyBytes = base64UrlDecode(p256dhKey);
	const authSecret = base64UrlDecode(authKey);

	const subscriberPublicKey = await crypto.subtle.importKey(
		"raw",
		subscriberPublicKeyBytes,
		{ name: "ECDH", namedCurve: "P-256" },
		true,
		[],
	);

	const localKeyPair = (await crypto.subtle.generateKey(
		{ name: "ECDH", namedCurve: "P-256" },
		true,
		["deriveBits"],
	)) as CryptoKeyPair;
	const localPublicKey = new Uint8Array(
		(await crypto.subtle.exportKey("raw", localKeyPair.publicKey)) as ArrayBuffer,
	);

	const sharedSecret = new Uint8Array(
		await crypto.subtle.deriveBits(
			// The generated Workers types mislabel this WebCrypto field as
			// `$public`; the runtime still expects the standard `public` key.
			{ name: "ECDH", public: subscriberPublicKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
			localKeyPair.privateKey,
			256,
		),
	);

	const textEncoder = new TextEncoder();
	const keyInfo = concatBytes(
		textEncoder.encode("WebPush: info\0"),
		subscriberPublicKeyBytes,
		localPublicKey,
	);
	const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32);

	const salt = crypto.getRandomValues(new Uint8Array(16));
	const contentEncryptionKey = await hkdf(
		salt,
		ikm,
		textEncoder.encode("Content-Encoding: aes128gcm\0"),
		16,
	);
	const nonce = await hkdf(salt, ikm, textEncoder.encode("Content-Encoding: nonce\0"), 12);

	// A single record: the 0x02 delimiter marks it as the final (only) record.
	const recordPlaintext = concatBytes(plaintext, new Uint8Array([2]));

	const aesKey = await crypto.subtle.importKey(
		"raw",
		contentEncryptionKey,
		{ name: "AES-GCM" },
		false,
		["encrypt"],
	);
	const ciphertext = new Uint8Array(
		await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, recordPlaintext),
	);

	const header = new Uint8Array(16 + 4 + 1 + localPublicKey.length);
	header.set(salt, 0);
	new DataView(header.buffer).setUint32(16, ciphertext.length, false);
	header[20] = localPublicKey.length;
	header.set(localPublicKey, 21);

	return concatBytes(header, ciphertext);
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
		payload: PushNotificationPayload,
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

		let encryptedBody: Uint8Array | null = null;
		if (p256dhValid && authValid) {
			try {
				const plaintext = new TextEncoder().encode(
					JSON.stringify({
						id: payload.notificationId,
						type: payload.type,
						title: payload.title,
						message: payload.message,
						actionUrl: payload.actionUrl,
					}),
				);
				if (plaintext.length <= WEB_PUSH_MAX_PAYLOAD_BYTES) {
					encryptedBody = await encryptWebPushPayload(
						plaintext,
						subscription.p256dhKey,
						subscription.authKey,
					);
				} else {
					console.warn("Web push payload too large, sending silent push", {
						subscriptionId: subscription.id,
						payloadBytes: plaintext.length,
					});
				}
			} catch (error) {
				console.warn("Web push payload encryption failed, sending silent push", {
					subscriptionId: subscription.id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		let response: Response;
		try {
			response = await fetch(subscription.endpoint, {
				method: "POST",
				headers: {
					Authorization: `vapid t=${jwt.token}, k=${publicKey}`,
					TTL: String(PUSH_TTL_SECONDS),
					Urgency: PUSH_URGENCY,
					...(encryptedBody
						? {
							"Content-Encoding": "aes128gcm",
							"Content-Type": "application/octet-stream",
							"Content-Length": String(encryptedBody.length),
						}
						: { "Content-Length": "0" }),
				},
				body: encryptedBody ?? undefined,
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
