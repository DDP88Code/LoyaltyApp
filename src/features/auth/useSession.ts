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
		mutationFn: async (input: { email: string; password: string }) => {
			assertOk(await authClient.signIn.email(input));
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
		}) => {
			// No role is sent. The Worker assigns "customer" server-side.
			assertOk(await authClient.signUp.email(input));
			return loadSessionAfterAuth(queryClient);
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
