import type { SessionUser } from "@shared/api";
import type { Profile } from "@worker/types";

/** Better Auth needs the origin it is actually being served from. */
export function requestOrigin(url: string): string {
	return new URL(url).origin;
}

/** Maps a profile row to the reduced shape the browser is allowed to see. */
export function toSessionUser(profile: Profile): SessionUser {
	return {
		id: profile.id,
		businessId: profile.businessId,
		fullName: profile.fullName,
		email: profile.email,
		mobileNumber: profile.mobileNumber,
		role: profile.role,
		birthday: profile.birthday,
		avatarUrl: profile.avatarUrl,
		marketingOptIn: profile.marketingOptIn,
		notificationOptIn: profile.notificationOptIn,
	};
}
