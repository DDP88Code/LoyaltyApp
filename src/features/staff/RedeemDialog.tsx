import { useState } from "react";
import type { RewardSummary } from "@shared/loyalty";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";

export function RedeemDialog({
	reward,
	loading,
	onConfirm,
	onCancel,
}: {
	reward: RewardSummary | null;
	loading: boolean;
	onConfirm: (input: { billReference: string | null }) => void;
	onCancel: () => void;
}) {
	const [billReference, setBillReference] = useState("");

	return (
		<ConfirmDialog
			open={reward !== null}
			title={`Redeem ${reward?.name ?? ""}`}
			description="This cannot be undone."
			confirmLabel="Redeem"
			danger
			loading={loading}
			onConfirm={() => onConfirm({ billReference: billReference.trim() || null })}
			onCancel={onCancel}
		>
			<Input
				label="Bill reference (optional)"
				value={billReference}
				onChange={(event) => setBillReference(event.target.value)}
			/>
		</ConfirmDialog>
	);
}
