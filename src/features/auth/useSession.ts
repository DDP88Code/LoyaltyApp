import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type { SessionPayload, SessionUser } from "@shared/api";
import { ApiClientError, apiFetch } from "@/lib/api";
import { authClient } from "@/lib/authClient";

export const sessionQueryKey = ["session"] as const;

/** `null` means signed out, which is a normal state rather than an error. */
async function fetchSession(): Promise<SessionUser | null> {
	try {
		const { user } = await apiFetch<SessionPayload>("/api/me");
		return user;
	} catch (error) {
		if (error instanceof ApiClientError && error.code === "unauthenticated") {
			return null;
		}
		throw error;
	}
}

export function useSession() {
	return useQuery({
		queryKey: sessionQueryKey,
		queryFn: fetchSession,
		staleTime: 60_000,
		retry: false,
	});
}

/** Better Auth returns errors in its own shape, so unwrap them into one message. */
function readAuthMessage(value: unknown): string | null {
	if (!value || typeof value !== "object") return null;
	const message = (value as { message?: unknown }).message;
	if (typeof message === "string" && message.trim().length > 0) {
		return message;
	}
	const statusText = (value as { statusText?: unknown }).statusText;
	if (typeof statusText === "string" && statusText.trim().length > 0) {
		return statusText;
	}
	return null;
}

function assertOk(result: unknown) {
	if (!result || typeof result !== "object") return;
	const error = (result as { error?: unknown }).error;
	if (!error) return;
	throw new Error(
		readAuthMessage(error) ??
			"Something went wrong. Please try again.",
	);
}

/**
 * Reads the profile straight after authenticating so the caller can route by
 * role. `staleTime: 0` is required: the client-wide default would otherwise
 * hand back the cached signed-out result.
 */
async function loadSessionAfterAuth(
	queryClient: QueryClient,
): Promise<SessionUser> {
	const user = await queryClient.fetchQuery({
		queryKey: sessionQueryKey,
		queryFn: fetchSession,
		staleTime: 0,
	});
	if (!user) {
		throw new Error(
			"You are signed in, but your profile could not be loaded. Please try again.",
		);
	}
	return user;
}

export function useSignIn() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: {
			email: string;
			password: string;
			turnstileToken?: string;
		}) => {
			const { turnstileToken, ...credentials } = input;
			assertOk(
				await authClient.signIn.email({
					...credentials,
					fetchOptions: turnstileToken
						? {
								headers: { "cf-turnstile-response": turnstileToken },
							}
						: undefined,
				}),
			);
			return loadSessionAfterAuth(queryClient);
		},
	});
}

export function useRegister() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (input: {
			name: string;
			email: string;
			password: string;
			mobileNumber: string;
			birthday?: string;
			turnstileToken?: string;
		}) => {
			const { turnstileToken, mobileNumber, birthday, ...registration } = input;
			// No role is sent. The Worker assigns "customer" server-side.
			assertOk(
				await authClient.signUp.email({
					...registration,
					fetchOptions: turnstileToken
						? {
								headers: { "cf-turnstile-response": turnstileToken },
							}
						: undefined,
				}),
			);
			await loadSessionAfterAuth(queryClient);
			// Mobile/birthday live on the existing profile row, saved through the same
			// PATCH route (and reward/anti-abuse reconciliation) a later profile edit uses.
			const { user } = await apiFetch<SessionPayload>("/api/customer/profile", {
				method: "PATCH",
				body: JSON.stringify({
					mobileNumber,
					...(birthday ? { birthday } : {}),
				}),
			});
			queryClient.setQueryData(sessionQueryKey, user);
			return user;
		},
	});
}

export function useSignOut() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			await authClient.signOut();
		},
		onSettled: () => {
			// Publish the signed-out session first: this notifies the mounted route
			// guards, which redirect. Removing the query instead would destroy it and
			// orphan its observers, leaving the guards showing the previous screen.
			queryClient.setQueryData(sessionQueryKey, null);
			// Everything else cached belongs to the account that just left.
			void queryClient.invalidateQueries({
				predicate: (query) => query.queryKey[0] !== sessionQueryKey[0],
			});
		},
	});
}

/** Better Auth's authenticated password-change endpoint; requires the current password. */
export function useChangePassword() {
	return useMutation({
		mutationFn: async (input: {
			currentPassword: string;
			newPassword: string;
		}) => {
			assertOk(await authClient.changePassword(input));
		},
	});
}

/**
 * Kicks off Better Auth's native reset-password email flow. The server
 * always replies with the same generic outcome whether or not the email
 * exists, so nothing here should branch on success/failure content.
 */
export function useRequestPasswordReset() {
	return useMutation({
		mutationFn: async (input: { email: string; turnstileToken?: string }) => {
			const { turnstileToken, email } = input;
			assertOk(
				await authClient.requestPasswordReset({
					email,
					redirectTo: `${window.location.origin}/reset-password`,
					fetchOptions: turnstileToken
						? { headers: { "cf-turnstile-response": turnstileToken } }
						: undefined,
				}),
			);
		},
	});
}

/** Consumes the single-use reset token from the emailed link to set a new password. */
export function useResetPassword() {
	return useMutation({
		mutationFn: async (input: { newPassword: string; token: string }) => {
			assertOk(await authClient.resetPassword(input));
		},
	});
}
