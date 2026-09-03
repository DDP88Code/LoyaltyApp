import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

/** Six-digit numeric entry with a clear, obvious error state for a mistyped code. */
export function ManualCodeEntry({
	loading,
	error,
	onSubmit,
}: {
	loading: boolean;
	error?: string;
	onSubmit: (otp: string) => void;
}) {
	const [value, setValue] = useState("");

	const handleSubmit = (event: React.FormEvent) => {
		event.preventDefault();
		if (value.length === 6) onSubmit(value);
	};

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
			<Input
				label="Customer's 6-digit code"
				inputMode="numeric"
				autoComplete="one-time-code"
				pattern="\d*"
				maxLength={6}
				value={value}
				error={error}
				onChange={(event) =>
					setValue(event.target.value.replace(/\D/g, "").slice(0, 6))
				}
				className="text-center text-2xl tracking-[0.4em]"
			/>
			<Button type="submit" fullWidth loading={loading} disabled={value.length !== 6}>
				Look up customer
			</Button>
		</form>
	);
}
