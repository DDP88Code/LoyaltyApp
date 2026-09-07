import { useEffect, useState } from "react";
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
	onConfirm: (input: {
		billReference: string | null;
		billTotalRand: number | null;
	}) => void;
	onCancel: () => void;
}) {
	const [billReference, setBillReference] = useState("");
	const [billTotalRand, setBillTotalRand] = useState("");

	useEffect(() => {
		if (reward) {
			setBillReference("");
			setBillTotalRand("");
		}
	}, [reward]);

	const minimumBillRand =
		reward?.minBillCents != null ? reward.minBillCents / 100 : null;
	const parsedBillTotal = Number(billTotalRand);
	const hasBillTotal = billTotalRand.trim().length > 0;
	const billTotalValid =
		!hasBillTotal || (Number.isFinite(parsedBillTotal) && parsedBillTotal >= 0);
	const meetsMinimum =
		minimumBillRand == null ||
		(hasBillTotal && billTotalValid && parsedBillTotal >= minimumBillRand);
	const canConfirm = billTotalValid && meetsMinimum;

	return (
		<ConfirmDialog
			open={reward !== null}
			title={`Redeem ${reward?.name ?? ""}`}
			description="This cannot be undone."
			confirmLabel="Redeem"
			danger
			confirmDisabled={!canConfirm}
			loading={loading}
			onConfirm={() =>
				onConfirm({
					billReference: billReference.trim() || null,
					billTotalRand:
						hasBillTotal && billTotalValid ? parsedBillTotal : null,
				})
			}
			onCancel={onCancel}
		>
			<Input
				label="Bill reference (optional)"
				value={billReference}
				onChange={(event) => setBillReference(event.target.value)}
			/>
			{minimumBillRand != null && (
				<Input
					label={`Bill total (Rand) - minimum ${minimumBillRand.toFixed(2)}`}
					type="number"
					min={0}
					step="0.01"
					value={billTotalRand}
					onChange={(event) => setBillTotalRand(event.target.value)}
					error={
						!billTotalValid
							? "Enter a valid non-negative bill total."
							: !meetsMinimum
								? `Minimum bill is R${minimumBillRand.toFixed(2)} for this voucher.`
								: undefined
					}
					hint="Used to validate minimum spend before voucher redemption."
				/>
			)}
		</ConfirmDialog>
	);
}
