import { createContext, useContext } from "react";
import type { ReactNode } from "react";

export interface NotificationProviderService {
	sendLoyaltyCode(input: { expiresAt: string }): Promise<void>;
	sendWelcomeReward(input: { rewardName: string }): Promise<void>;
	sendRewardUnlocked(input: { rewardName: string }): Promise<void>;
}

class DevelopmentNotificationProvider implements NotificationProviderService {
	async sendLoyaltyCode(input: { expiresAt: string }): Promise<void> {
		console.info("[notifications] loyalty code issued", input);
	}

	async sendWelcomeReward(input: { rewardName: string }): Promise<void> {
		console.info("[notifications] welcome reward", input);
	}

	async sendRewardUnlocked(input: { rewardName: string }): Promise<void> {
		console.info("[notifications] reward unlocked", input);
	}
}

const notificationProvider = new DevelopmentNotificationProvider();

const NotificationProviderContext =
	createContext<NotificationProviderService>(notificationProvider);

export function NotificationProvider({ children }: { children: ReactNode }) {
	return (
		<NotificationProviderContext.Provider value={notificationProvider}>
			{children}
		</NotificationProviderContext.Provider>
	);
}

export function useNotificationProvider(): NotificationProviderService {
	return useContext(NotificationProviderContext);
}
