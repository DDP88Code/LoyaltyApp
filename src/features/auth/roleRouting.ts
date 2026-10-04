import { ROLE_HOME, type Role } from "@shared/roles";
import { IS_NATIVE } from "@/lib/platform";

export function requiresNativeWebPortal(role: Role): boolean {
	return IS_NATIVE && role !== "customer";
}

/** Native non-customers always enter the protected gate, never a saved web route. */
export function signedInDestination(role: Role, returnPath?: string): string {
	if (requiresNativeWebPortal(role)) return "/app";
	return returnPath ?? ROLE_HOME[role];
}
