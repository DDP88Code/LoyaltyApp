export interface BrowserPushSubscription {
	endpoint: string;
	p256dhKey: string;
	authKey: string;
}

function toBase64Url(value: ArrayBuffer): string {
	const bytes = new Uint8Array(value);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function toUint8Array(base64Url: string): Uint8Array {
	const normalized = base64Url.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

function hasSameBytes(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	for (let index = 0; index < a.length; index += 1) {
		if (a[index] !== b[index]) return false;
	}
	return true;
}

function extractApplicationServerKey(
	subscription: PushSubscription,
): Uint8Array | null {
	const key = subscription.options?.applicationServerKey;
	if (!key) return null;
	return new Uint8Array(key);
}

function resolvePushKeys(subscription: PushSubscription): {
	p256dhKey: string;
	authKey: string;
} {
	const p256dh = subscription.getKey("p256dh");
	const auth = subscription.getKey("auth");
	if (!p256dh || !auth) {
		throw new Error("This browser did not provide complete push keys.");
	}
	return {
		p256dhKey: toBase64Url(p256dh),
		authKey: toBase64Url(auth),
	};
}

export function supportsWebPush(): boolean {
	if (typeof window === "undefined") return false;
	return "serviceWorker" in navigator && "PushManager" in window;
}

export async function ensurePushPermission(): Promise<void> {
	if (typeof Notification === "undefined") {
		throw new Error("Notifications are not supported in this browser.");
	}

	if (Notification.permission === "granted") return;
	if (Notification.permission === "denied") {
		throw new Error(
			"Notifications are blocked in your browser settings for this site.",
		);
	}

	const permission = await Notification.requestPermission();
	if (permission !== "granted") {
		throw new Error("Notification permission was not granted.");
	}
}

export async function ensureBrowserPushSubscription(
	publicKey: string,
): Promise<BrowserPushSubscription> {
	if (!supportsWebPush()) {
		throw new Error("Web push is not supported by this browser.");
	}

	await ensurePushPermission();

	const registration = await navigator.serviceWorker.ready;
	const expectedKey = toUint8Array(publicKey);
	let existing = await registration.pushManager.getSubscription();

	if (existing) {
		const currentKey = extractApplicationServerKey(existing);
		const keyMatches = currentKey ? hasSameBytes(currentKey, expectedKey) : false;
		if (!keyMatches) {
			await existing.unsubscribe();
			existing = null;
		}
	}

	const subscription =
		existing ??
		(await registration.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: expectedKey as unknown as BufferSource,
		}));

	const keys = resolvePushKeys(subscription);
	return {
		endpoint: subscription.endpoint,
		p256dhKey: keys.p256dhKey,
		authKey: keys.authKey,
	};
}

export async function removeBrowserPushSubscription(): Promise<string | null> {
	if (!supportsWebPush()) return null;

	const registration = await navigator.serviceWorker.ready;
	const existing = await registration.pushManager.getSubscription();
	if (!existing) return null;

	const endpoint = existing.endpoint;
	await existing.unsubscribe();
	return endpoint;
}
