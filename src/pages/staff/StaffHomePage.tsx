import { useState } from "react";
import { Keyboard, ScanLine } from "lucide-react";
import type { StaffResolvedCustomerPayload } from "@shared/loyaltyCode";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useStaffContext, useResolveLoyaltyCode } from "@/features/staff/api";
import { LocationPicker } from "@/features/staff/LocationPicker";
import { ManualCodeEntry } from "@/features/staff/ManualCodeEntry";
import { QrScanner } from "@/features/staff/QrScanner";
import { ResolvedCustomerView } from "@/features/staff/ResolvedCustomerView";

const LOCATION_STORAGE_KEY = "fives:staff:locationId";

function useSelectedLocationId(): [string | null, (id: string) => void] {
	const [locationId, setLocationIdState] = useState<string | null>(() =>
		localStorage.getItem(LOCATION_STORAGE_KEY),
	);
	const setLocationId = (id: string) => {
		localStorage.setItem(LOCATION_STORAGE_KEY, id);
		setLocationIdState(id);
	};
	return [locationId, setLocationId];
}

type Mode = "home" | "scan" | "manual" | "resolved";

export function StaffHomePage() {
	const [locationId, setLocationId] = useSelectedLocationId();
	const context = useStaffContext(locationId);
	const resolve = useResolveLoyaltyCode();
	const [mode, setMode] = useState<Mode>("home");
	const [customer, setCustomer] = useState<StaffResolvedCustomerPayload | null>(null);

	if (context.isPending) return <LoadingState label="Loading…" />;
	if (context.isError) {
		return (
			<ErrorState
				description={context.error.message}
				onRetry={() => void context.refetch()}
			/>
		);
	}

	const locations = context.data.locations;
	// A single location is chosen automatically; more than one needs a pick first.
	const effectiveLocationId: string | null =
		locationId ?? (locations.length === 1 ? (locations[0]?.id ?? null) : null);

	if (!effectiveLocationId) {
		return (
			<div className="flex flex-col gap-4 p-5">
				<PageHeader title="Fives Staff" subtitle="Choose where you're working." />
				<LocationPicker
					locations={locations}
					selectedId={locationId}
					onSelect={setLocationId}
				/>
			</div>
		);
	}

	if (mode === "resolved" && customer) {
		return (
			<ResolvedCustomerView
				customer={customer}
				locationId={effectiveLocationId}
				onUpdated={setCustomer}
				onDone={() => {
					setCustomer(null);
					resolve.reset();
					setMode("home");
				}}
			/>
		);
	}

	if (mode === "scan") {
		return (
			<div className="flex flex-col gap-4 p-5">
				<PageHeader title="Scan Customer QR" />
				<QrScanner
					onDecode={(qrToken) =>
						resolve.mutate(
							{ qrToken },
							{ onSuccess: (result) => { setCustomer(result); setMode("resolved"); } },
						)
					}
				/>
				{resolve.isError && (
					<p role="alert" className="text-sm text-brand-danger">
						{resolve.error.message}
					</p>
				)}
				<Button variant="outline" fullWidth onClick={() => setMode("home")}>
					Cancel
				</Button>
			</div>
		);
	}

	if (mode === "manual") {
		return (
			<div className="flex flex-col gap-4 p-5">
				<PageHeader title="Enter Customer Code" />
				<ManualCodeEntry
					loading={resolve.isPending}
					error={resolve.error?.message}
					onSubmit={(otp) =>
						resolve.mutate(
							{ otp },
							{ onSuccess: (result) => { setCustomer(result); setMode("resolved"); } },
						)
					}
				/>
				<Button variant="outline" fullWidth onClick={() => { resolve.reset(); setMode("home"); }}>
					Cancel
				</Button>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 p-5">
			<PageHeader title="Fives Staff" />
			{locations.length > 1 && (
				<LocationPicker
					locations={locations}
					selectedId={effectiveLocationId}
					onSelect={setLocationId}
				/>
			)}
			<Button
				size="lg"
				fullWidth
				leadingIcon={<ScanLine className="size-5" aria-hidden />}
				onClick={() => setMode("scan")}
			>
				Scan Customer QR
			</Button>
			<Button
				size="lg"
				variant="outline"
				fullWidth
				leadingIcon={<Keyboard className="size-5" aria-hidden />}
				onClick={() => setMode("manual")}
			>
				Enter Customer Code
			</Button>
		</div>
	);
}
