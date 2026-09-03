import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useAdminSettings, useUpdateAdminSettings } from "@/features/admin/core/api";
import { AdminPanel } from "@/features/admin/core/widgets";

export function AdminSettingsPage() {
	const settings = useAdminSettings();
	const updateSettings = useUpdateAdminSettings();
	const [welcomeRewardEnabled, setWelcomeRewardEnabled] = useState(true);
	const [ttlMinutes, setTtlMinutes] = useState("10");
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	useEffect(() => {
		if (!settings.data) return;
		setWelcomeRewardEnabled(settings.data.welcomeRewardEnabled);
		setTtlMinutes(String(Math.round(settings.data.loyaltyCodeTtlSeconds / 60)));
	}, [settings.data]);

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

	async function saveSettings() {
		setError(null);
		setSuccess(null);

		const minutes = Number(ttlMinutes);
		if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) {
			setError("Loyalty code validity must be a whole number between 1 and 60 minutes.");
			return;
		}

		try {
			const next = await updateSettings.mutateAsync({
				welcomeRewardEnabled,
				loyaltyCodeTtlSeconds: minutes * 60,
			});
			setWelcomeRewardEnabled(next.welcomeRewardEnabled);
			setTtlMinutes(String(Math.round(next.loyaltyCodeTtlSeconds / 60)));
			setSuccess("Settings saved.");
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not save settings.");
		}
	}

	return (
		<main className="mx-auto w-full max-w-4xl p-6">
			<PageHeader
				title="Settings"
				subtitle="Manage operational controls for welcome rewards and loyalty code validity."
			/>
			<AdminPanel title="Operational settings" description="Changes are saved to D1 and audited.">
				<div className="grid gap-3 md:max-w-md">
					<label className="inline-flex min-h-10 items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={welcomeRewardEnabled}
							onChange={(event) => setWelcomeRewardEnabled(event.target.checked)}
							className="size-4 accent-brand-primary"
						/>
						<span>Welcome reward enabled</span>
					</label>
					<Input
						label="Loyalty code validity (minutes)"
						type="number"
						min={1}
						max={60}
						step={1}
						value={ttlMinutes}
						onChange={(event) => setTtlMinutes(event.target.value)}
						hint="Allowed range: 1 to 60 minutes."
					/>
					<p className="text-xs text-brand-muted">
						Current value: {Number(ttlMinutes) * 60 || settings.data.loyaltyCodeTtlSeconds} seconds
					</p>
				</div>

				{error && <p className="mt-3 text-sm text-brand-danger">{error}</p>}
				{success && <p className="mt-3 text-sm text-brand-success">{success}</p>}

				<div className="mt-4">
					<Button loading={updateSettings.isPending} onClick={() => void saveSettings()}>
						Save settings
					</Button>
				</div>
			</AdminPanel>
		</main>
	);
}
