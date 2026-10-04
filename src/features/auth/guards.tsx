import { Navigate, Outlet, useLocation } from "react-router";
import type { Role } from "@shared/roles";
import { useSession } from "@/features/auth/useSession";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { NativeWebPortalGate } from "./NativeWebPortalGate";
import { requiresNativeWebPortal, signedInDestination } from "./roleRouting";

/** Sends signed-out visitors to the sign-in page, remembering where they were headed. */
export function RequireAuth() {
	const { data: user, isPending, isError, refetch } = useSession();
	const location = useLocation();

	if (isPending) return <LoadingState label="Checking your session…" />;
	if (isError) {
		return (
			<ErrorState
				title="We could not check your session"
				description="Check your connection and try again."
				onRetry={() => void refetch()}
			/>
		);
	}
	if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
	if (requiresNativeWebPortal(user.role)) return <NativeWebPortalGate />;

	return <Outlet />;
}

/**
 * Route-level role check. This is a navigation convenience only — the Worker
 * re-checks the role on every request, because the browser can be lied to.
 */
export function RequireRole({ allow }: { allow: readonly Role[] }) {
	const { data: user, isPending } = useSession();

	if (isPending) return <LoadingState label="Checking your session…" />;
	if (!user) return <Navigate to="/login" replace />;
	if (requiresNativeWebPortal(user.role)) return <NativeWebPortalGate />;
	if (!allow.includes(user.role)) {
		return <Navigate to={signedInDestination(user.role)} replace />;
	}

	return <Outlet />;
}

/** Keeps signed-in users off the sign-in and registration pages. */
export function RedirectIfSignedIn() {
	const { data: user, isPending } = useSession();

	if (isPending) return <LoadingState label="Checking your session…" />;
	if (user) return <Navigate to={signedInDestination(user.role)} replace />;

	return <Outlet />;
}
