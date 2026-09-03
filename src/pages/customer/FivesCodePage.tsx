import { QrCode } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/States";

/** QR/OTP generation is Phase 6 — Loyalty-code service. */
export function FivesCodePage() {
	return (
		<div className="p-5">
			<PageHeader title="My Fives Code" />
			<EmptyState
				icon={<QrCode className="size-8" />}
				title="Coming soon"
				description="Your temporary QR code and 6-digit code for staff to scan will appear here."
			/>
		</div>
	);
}
