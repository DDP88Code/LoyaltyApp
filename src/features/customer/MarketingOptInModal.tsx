import { BRAND } from "@shared/branding";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useSession } from "@/features/auth/useSession";
import {
	useCustomerPushConfig,
	useSaveCustomerPushSubscription,
	useUpdateProfile,
} from "@/features/customer/api";
import { ensureBrowserPushSubscription, supportsWebPush } from "@/features/system/webPush";

/** One-time post-registration prompt; `profile.marketingPromptShown` gates it for good. */
export function MarketingOptInModal() {
	const { data: user } = useSession();
	const updateProfile = useUpdateProfile();
	const pushConfig = useCustomerPushConfig();
	const savePushSubscription = useSaveCustomerPushSubscription();

	if (!user || user.marketingPromptShown) return null;

	const handleNotNow = () => {
		updateProfile.mutate({ marketingPromptShown: true });
	};

	const handleYes = () => {
		updateProfile.mutate({ marketingOptIn: true, marketingPromptShown: true });

		void (async () => {
			if (!supportsWebPush()) return;
			const publicKey = pushConfig.data?.publicKey;
			if (!pushConfig.data?.configured || !publicKey) return;
			try {
				const subscription = await ensureBrowserPushSubscription(publicKey);
				await savePushSubscription.mutateAsync({
					endpoint: subscription.endpoint,
					p256dhKey: subscription.p256dhKey,
					authKey: subscription.authKey,
					deviceLabel: "PWA",
				});
			} catch {
				// Permission denied or unsupported browser — the opt-in itself still stands.
			}
		})();
	};

	return (
		<ConfirmDialog
			open
			title="Stay in the loop 🍔🍻"
			description={`Would you like to receive notifications about specials, promotions and offers at ${BRAND.fullName}?`}
			confirmLabel="Yes, keep me updated"
			cancelLabel="Not now"
			onConfirm={handleYes}
			onCancel={handleNotNow}
		/>
	);
}
