import { createAuthClient } from "better-auth/react";

const fallbackOrigin =
	typeof window !== "undefined" ? window.location.origin : "";

/**
 * Only issues credential calls to /api/auth. Session state for the UI comes
 * from `useSession`, which reads the Fives profile and role from /api/me.
 */
export const authClient = createAuthClient({
	baseURL: import.meta.env.VITE_API_BASE_URL || fallbackOrigin,
	basePath: "/api/auth",
});
