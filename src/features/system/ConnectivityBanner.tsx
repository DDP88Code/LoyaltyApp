import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/features/system/useOnlineStatus";

export function ConnectivityBanner() {
	const isOnline = useOnlineStatus();
	if (isOnline) return null;

	return (
		<div className="fixed inset-x-0 top-0 z-50 border-b border-brand-danger/50 bg-brand-danger/15 px-4 py-2 text-center text-xs text-brand-text">
			<div className="mx-auto flex max-w-4xl items-center justify-center gap-2">
				<WifiOff className="size-4 text-brand-danger" aria-hidden />
				<p>
					You are offline. Internet is required for loyalty code generation,
					add coffee, reward redemption, and admin adjustments.
				</p>
			</div>
		</div>
	);
}
