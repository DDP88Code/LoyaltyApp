import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
	label: string;
	error?: string;
	hint?: string;
	trailingControl?: ReactNode;
}

export function Input({
	label,
	error,
	hint,
	trailingControl,
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
			<div className="relative">
				<input
					{...props}
					id={inputId}
					aria-invalid={error ? true : undefined}
					aria-describedby={describedBy}
					className={cn(
						"min-h-12 w-full rounded-xl border bg-brand-surface px-4 text-base placeholder:text-brand-muted",
						error ? "border-brand-danger" : "border-brand-border",
						trailingControl ? "pr-12" : undefined,
						className,
					)}
				/>
				{trailingControl && (
					<div className="absolute inset-y-0 right-3 flex items-center">
						{trailingControl}
					</div>
				)}
			</div>
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
