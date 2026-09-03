import { index, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { ROLES } from "../../../shared/roles";
import { createdAt, flag, pk, updatedAt } from "./_columns";
import { user } from "./auth";
import { businesses } from "./business";

/**
 * Application profile for a Better Auth user. Better Auth owns its own
 * `user`/`session`/`account`/`verification` tables; they are never merged into
 * this one, only linked through `auth_user_id`.
 */
export const profiles = sqliteTable(
	"profiles",
	{
		id: pk(),
		authUserId: text("auth_user_id")
			.notNull()
			.references(() => user.id),
		businessId: text("business_id")
			.notNull()
			.references(() => businesses.id, { onDelete: "cascade" }),
		fullName: text("full_name").notNull(),
		email: text("email").notNull(),
		mobileNumber: text("mobile_number"),
		// Public registration may only ever write "customer"; elevation is admin-only.
		role: text("role", { enum: ROLES }).notNull().default("customer"),
		// Date-only value as ISO `YYYY-MM-DD`; a timestamp would drift across timezones.
		birthday: text("birthday"),
		avatarUrl: text("avatar_url"),
		marketingOptIn: flag("marketing_opt_in").notNull().default(false),
		notificationOptIn: flag("notification_opt_in").notNull().default(true),
		active: flag("active").notNull().default(true),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		uniqueIndex("profiles_auth_user_unq").on(t.authUserId),
		uniqueIndex("profiles_business_email_unq").on(t.businessId, t.email),
		index("profiles_business_role_idx").on(t.businessId, t.role),
		index("profiles_mobile_idx").on(t.businessId, t.mobileNumber),
	],
);
