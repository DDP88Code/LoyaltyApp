import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";

export function AddCoffeeDialog({
	open,
	loading,
	onConfirm,
	onCancel,
}: {
	open: boolean;
	loading: boolean;
	onConfirm: (input: { quantity: number; billReference: string | null }) => void;
	onCancel: () => void;
}) {
	const [quantity, setQuantity] = useState(1);
	const [billReference, setBillReference] = useState("");

	return (
		<ConfirmDialog
			open={open}
			title="Add coffee"
			description="Record a qualifying coffee purchase for this customer."
			confirmLabel="Add coffee"
			loading={loading}
			onConfirm={() =>
				onConfirm({ quantity, billReference: billReference.trim() || null })
			}
			onCancel={onCancel}
		>
			<div className="flex flex-col gap-3">
				<Input
					label="Quantity"
					type="number"
					inputMode="numeric"
					min={1}
					max={20}
					value={quantity}
					onChange={(event) => setQuantity(Number(event.target.value) || 1)}
				/>
				<Input
					label="Bill reference (optional)"
					value={billReference}
					onChange={(event) => setBillReference(event.target.value)}
				/>
			</div>
		</ConfirmDialog>
	);
}
