import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useSession, useSignOut } from "@/features/auth/useSession";

/**
 * Temporary signed-in shell. Each area gets its own layout in a later phase;
 * until then this proves the session, role and sign-out all work.
 */
export function SignedInBar() {
	const { data: user } = useSession();
	const signOut = useSignOut();

	if (!user) return null;

	return (
		<div className="flex items-center justify-between gap-3 border-b border-brand-border px-6 py-3">
			<div className="min-w-0">
				<p className="truncate text-sm font-medium">{user.fullName}</p>
				<p className="text-xs text-brand-muted capitalize">{user.role}</p>
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
		</div>
	);
}
