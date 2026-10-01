import { BRAND } from "@shared/branding";

export type AppTarget = "web" | "native";

const appTargetEnv = import.meta.env.VITE_APP_TARGET?.toLowerCase();

export const APP_TARGET: AppTarget = appTargetEnv === "native" ? "native" : "web";
export const IS_NATIVE = APP_TARGET === "native";
export const WEB_ORIGIN = BRAND.website;

function currentWebOrigin(): string {
	if (typeof window === "undefined") {
		return WEB_ORIGIN;
	}
	return window.location.origin;
}

export function buildPasswordResetRedirectUrl(): string {
	const origin = IS_NATIVE ? WEB_ORIGIN : currentWebOrigin();
	return `${origin}/reset-password`;
}
