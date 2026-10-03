import { Capacitor } from "@capacitor/core";
import { IS_NATIVE } from "./platform";

const TOKEN_KEY = "fives.auth.session";

async function storage() {
	// The plugin's browser fallback uses localStorage. Never allow it for auth.
	if (!Capacitor.isNativePlatform()) {
		throw new Error("Secure sign-in storage requires the native app.");
	}
	// Return the module, not the Capacitor proxy: its synthetic `then` method
	// would make an async return wait forever for a nonexistent native method.
	return import("@aparajita/capacitor-secure-storage");
}

export async function getNativeAuthToken(): Promise<string | null> {
	if (!IS_NATIVE) return null;
	try {
		const { SecureStorage } = await storage();
		const token = await SecureStorage.get(TOKEN_KEY, false, false);
		return typeof token === "string" && token.length > 0 ? token : null;
	} catch {
		throw new Error("Could not read secure sign-in storage. Please restart the app.");
	}
}

export async function setNativeAuthToken(token: string): Promise<void> {
	if (!IS_NATIVE) return;
	try {
		const { SecureStorage } = await storage();
		await SecureStorage.set(TOKEN_KEY, token, false, false);
	} catch {
		throw new Error("Could not save your sign-in securely. Please try again.");
	}
}

export async function clearNativeAuthToken(): Promise<void> {
	if (!IS_NATIVE) return;
	try {
		const { SecureStorage } = await storage();
		await SecureStorage.remove(TOKEN_KEY, false);
	} catch {
		throw new Error("Could not clear secure sign-in storage. Please try again.");
	}
}
