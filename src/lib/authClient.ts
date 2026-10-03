import { createAuthClient } from "better-auth/react";
import { clearNativeAuthToken, getNativeAuthToken, setNativeAuthToken } from "./nativeAuthToken";
import { IS_NATIVE } from "./platform";

const fallbackOrigin =
	typeof window !== "undefined" ? window.location.origin : "";

/**
 * Only issues credential calls to /api/auth. Session state for the UI comes
 * from `useSession`, which reads the Fives profile and role from /api/me.
 */
export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_API_BASE_URL || fallbackOrigin,
	basePath: "/api/auth",
	...(IS_NATIVE ? {
		fetchOptions: {
			credentials: "omit" as const,
			async onRequest(context) {
				context.credentials = "omit";
				const token = await getNativeAuthToken();
				if (token) context.headers.set("Authorization", `Bearer ${token}`);
				else context.headers.delete("Authorization");
			},
			async onSuccess({ response }) {
				const token = response.headers.get("set-auth-token");
				// Await persistence before callers load /api/me or patch the profile.
				if (token) await setNativeAuthToken(token);
			},
		},
	} : {}),
});

export async function signOut(): Promise<void> {
	try {
		await authClient.signOut();
	} finally {
		// Clear locally even when the device cannot reach the revocation endpoint.
		await clearNativeAuthToken();
	}
}
