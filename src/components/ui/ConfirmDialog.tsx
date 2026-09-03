import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button";

export interface ConfirmDialogProps {
	open: boolean;
	title: string;
	description?: ReactNode;
	confirmLabel: string;
	danger?: boolean;
	loading?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
	children?: ReactNode;
}

/**
 * Native `<dialog>` for the built-in modal semantics (focus trap, Escape-to-close,
 * top-layer stacking) without pulling in a portal/overlay library.
 */
export function ConfirmDialog({
	open,
	title,
	description,
	confirmLabel,
	danger = false,
	loading = false,
	onConfirm,
	onCancel,
	children,
}: ConfirmDialogProps) {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);

	return (
		<dialog
			ref={ref}
			onClose={onCancel}
			onCancel={onCancel}
			className="w-full max-w-sm rounded-card border border-brand-border bg-brand-surface p-5 text-brand-text backdrop:bg-black/60"
		>
			<h2 className="text-lg">{title}</h2>
			{description && (
				<p className="mt-1 text-sm text-brand-muted">{description}</p>
			)}
			{children && <div className="mt-4">{children}</div>}
			<div className="mt-5 flex gap-3">
				<Button variant="outline" fullWidth onClick={onCancel} disabled={loading}>
					Cancel
				</Button>
				<Button
					variant={danger ? "danger" : "primary"}
					fullWidth
					loading={loading}
					onClick={onConfirm}
				>
					{confirmLabel}
				</Button>
			</div>
		</dialog>
	);
}
