/** Formats integer cents as a South African Rand amount, e.g. 5000 -> "R50.00". */
export function formatCents(cents: number): string {
	return `R${(cents / 100).toFixed(2)}`;
}
