/** Application roles. Public registration may only ever produce `customer`. */
export const ROLES = ["customer", "staff", "admin", "owner"] as const;

export type Role = (typeof ROLES)[number];

/** Landing route for each role after sign-in. */
export const ROLE_HOME: Record<Role, string> = {
	customer: "/app",
	staff: "/staff",
	admin: "/admin",
	owner: "/admin",
};
