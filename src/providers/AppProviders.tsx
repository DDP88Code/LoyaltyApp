import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ConnectivityBanner } from "@/features/system/ConnectivityBanner";
import { NotificationProvider } from "@/features/system/notifications";
import { PwaInstallPrompt } from "@/features/system/PwaInstallPrompt";
import { queryClient } from "@/lib/queryClient";

export function AppProviders({ children }: { children: ReactNode }) {
	return (
		<QueryClientProvider client={queryClient}>
			<NotificationProvider>
				<ConnectivityBanner />
				<PwaInstallPrompt />
				{children}
			</NotificationProvider>
		</QueryClientProvider>
	);
}
