import { Coffee } from "lucide-react";
import type { CoffeeProgress } from "@shared/loyalty";
import { cn } from "@/lib/cn";

/** Filled dots for stamps already earned, outlined dots for what remains. */
export function CoffeeStampGrid({
	coffee,
	compact = false,
}: {
	coffee: CoffeeProgress;
	compact?: boolean;
}) {
	const threshold = coffee.threshold ?? coffee.current;
	const slots = Array.from({ length: Math.max(threshold, 1) }, (_, i) => i);

	return (
		<div
			role="img"
			aria-label={`${coffee.current} of ${threshold} coffees towards your next reward`}
			className={cn("grid grid-cols-5", compact ? "gap-1.5" : "gap-2")}
		>
			{slots.map((slot) => (
				<div
					key={slot}
					className={cn(
						"flex aspect-square items-center justify-center rounded-full",
						compact ? "border" : "border-2",
						slot < coffee.current
							? "border-brand-primary bg-brand-primary/20 text-brand-primary"
							: "border-brand-border text-brand-border",
					)}
				>
					<Coffee className={compact ? "size-3" : "size-4"} aria-hidden />
				</div>
			))}
		</div>
	);
}
