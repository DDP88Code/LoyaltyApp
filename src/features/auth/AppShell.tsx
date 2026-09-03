import { Outlet } from "react-router";
import { SignedInBar } from "@/features/auth/SignedInBar";

/** Wraps every authenticated area until each gets its own shell. */
export function AppShell() {
	return (
		<div className="min-h-dvh">
			<SignedInBar />
			<Outlet />
		</div>
	);
}
