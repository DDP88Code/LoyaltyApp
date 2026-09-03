import type { LocationSummary } from "@shared/api";

export function LocationPicker({
	locations,
	selectedId,
	onSelect,
}: {
	locations: LocationSummary[];
	selectedId: string | null;
	onSelect: (id: string) => void;
}) {
	return (
		<label className="flex flex-col gap-1.5 text-sm">
			<span className="font-medium">Working at</span>
			<select
				value={selectedId ?? ""}
				onChange={(event) => onSelect(event.target.value)}
				className="min-h-12 rounded-xl border border-brand-border bg-brand-surface px-4 text-base"
			>
				<option value="" disabled>
					Choose a location…
				</option>
				{locations.map((location) => (
					<option key={location.id} value={location.id}>
						{location.name}
					</option>
				))}
			</select>
		</label>
	);
}
