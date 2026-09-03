import { LogOut } from "lucide-react";
import { Outlet } from "react-router";
import { Button } from "@/components/ui/Button";
import { useSession, useSignOut } from "@/features/auth/useSession";

/** Optimised for a low-cost Android device behind the bar — one screen, few taps. */
export function StaffLayout() {
	const { data: user } = useSession();
	const signOut = useSignOut();

	return (
		<div className="min-h-dvh">
			<header className="flex items-center justify-between border-b border-brand-border px-5 py-4">
				<div>
					<p className="text-xs tracking-[0.3em] text-brand-secondary uppercase">
						Fives Staff
					</p>
					{user && <p className="text-sm text-brand-muted">{user.fullName}</p>}
				</div>
				<Button
					variant="outline"
					size="sm"
					loading={signOut.isPending}
					leadingIcon={<LogOut className="size-4" aria-hidden />}
					onClick={() => signOut.mutate()}
				>
					Sign out
				</Button>
			</header>
			<Outlet />
		</div>
	);
}
