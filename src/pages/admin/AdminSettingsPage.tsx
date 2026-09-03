import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useAdminSettings } from "@/features/admin/core/api";
import { AdminPanel } from "@/features/admin/core/widgets";

export function AdminSettingsPage() {
	const settings = useAdminSettings();

	if (settings.isPending) return <LoadingState label="Loading settings..." />;
	if (settings.isError) {
		return (
			<main className="p-6">
				<ErrorState
					title="Could not load settings"
					description={settings.error.message}
					onRetry={() => void settings.refetch()}
				/>
			</main>
		);
	}

	return (
		<main className="mx-auto w-full max-w-4xl p-6">
			<PageHeader
				title="Settings"
				subtitle="Operational settings currently configured in app settings."
			/>
			<AdminPanel title="Current values">
				<div className="grid gap-2 text-sm">
					<p>Welcome reward enabled: {settings.data.welcomeRewardEnabled ? "Yes" : "No"}</p>
					<p>Loyalty code TTL: {settings.data.loyaltyCodeTtlSeconds} seconds</p>
				</div>
			</AdminPanel>
		</main>
	);
}
