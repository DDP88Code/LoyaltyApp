import { useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label: string;
	error?: string;
	hint?: string;
}

export function Input({
	label,
	error,
	hint,
	className,
	id,
	...props
}: InputProps) {
	const generatedId = useId();
	const inputId = id ?? generatedId;
	const describedBy = error
		? `${inputId}-error`
		: hint
			? `${inputId}-hint`
			: undefined;

	return (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={inputId} className="text-sm font-medium">
				{label}
			</label>
			<input
				{...props}
				id={inputId}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy}
				className={cn(
					"min-h-12 rounded-xl border bg-brand-surface px-4 text-base placeholder:text-brand-muted",
					error ? "border-brand-danger" : "border-brand-border",
					className,
				)}
			/>
			{hint && !error && (
				<p id={`${inputId}-hint`} className="text-xs text-brand-muted">
					{hint}
				</p>
			)}
			{error && (
				<p id={`${inputId}-error`} className="text-xs text-brand-danger">
					{error}
				</p>
			)}
		</div>
	);
}
