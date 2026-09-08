import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { AdminMenuCategory, AdminMenuItem } from "@shared/menu";
import { cn } from "@/lib/cn";

type PickerOption =
	| {
		kind: "create";
		id: "";
		itemName: "Create new item";
		categoryName: "";
		menuGroup: "food";
	}
	| {
		kind: "item";
		id: string;
		itemName: string;
		categoryName: string;
		menuGroup: "food" | "drinks";
	};

interface GroupedCategory {
	categoryId: string;
	categoryName: string;
	menuGroup: "food" | "drinks";
	items: Array<{
		id: string;
		name: string;
	}>;
}

function sortByConfiguredOrderThenName(
	a: { sortOrder: number; name: string },
	b: { sortOrder: number; name: string },
) {
	if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
	return a.name.localeCompare(b.name);
}

function groupLabel(group: "food" | "drinks") {
	return group === "food" ? "FOOD" : "DRINKS";
}

function groupMetaLabel(group: "food" | "drinks") {
	return group === "food" ? "Food" : "Drinks";
}

export function AdminMenuItemPicker({
	items,
	categories,
	selectedItemId,
	onSelectItem,
}: {
	items: AdminMenuItem[];
	categories: AdminMenuCategory[];
	selectedItemId: string;
	onSelectItem: (itemId: string) => void;
}) {
	const labelId = useId();
	const rootRef = useRef<HTMLDivElement | null>(null);
	const triggerRef = useRef<HTMLButtonElement | null>(null);
	const searchInputRef = useRef<HTMLInputElement | null>(null);
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const [panelPlacement, setPanelPlacement] = useState<"bottom" | "top">(
		"bottom",
	);
	const [panelMaxHeight, setPanelMaxHeight] = useState(352);

	const normalizedQuery = query.trim().toLowerCase();

	const grouped = useMemo(() => {
		const sortedCategories = [...categories].sort(sortByConfiguredOrderThenName);
		const categoriesById = new Map(sortedCategories.map((category) => [category.id, category]));

		const byGroup: Record<"food" | "drinks", GroupedCategory[]> = {
			food: [],
			drinks: [],
		};

		for (const category of sortedCategories) {
			const filteredItems = items
				.filter((item) => item.categoryId === category.id)
				.filter((item) => {
					if (!normalizedQuery) return true;
					const itemMatch = item.name.toLowerCase().includes(normalizedQuery);
					const categoryMatch = category.name
						.toLowerCase()
						.includes(normalizedQuery);
					return itemMatch || categoryMatch;
				})
				.sort(sortByConfiguredOrderThenName)
				.map((item) => ({ id: item.id, name: item.name }));

			if (filteredItems.length === 0) continue;

			byGroup[category.menuGroup].push({
				categoryId: category.id,
				categoryName: category.name,
				menuGroup: category.menuGroup,
				items: filteredItems,
			});
		}

		const selected = selectedItemId
			? items.find((item) => item.id === selectedItemId) ?? null
			: null;
		const selectedCategory = selected
			? categoriesById.get(selected.categoryId) ?? null
			: null;

		return {
			groups: ["food", "drinks"] as const,
			byGroup,
			selected,
			selectedCategory,
		};
	}, [categories, items, normalizedQuery, selectedItemId]);

	const options = useMemo<PickerOption[]>(() => {
		const flat: PickerOption[] = [
			{
				kind: "create",
				id: "",
				itemName: "Create new item",
				categoryName: "",
				menuGroup: "food",
			},
		];

		for (const group of grouped.groups) {
			for (const category of grouped.byGroup[group]) {
				for (const item of category.items) {
					flat.push({
						kind: "item",
						id: item.id,
						itemName: item.name,
						categoryName: category.categoryName,
						menuGroup: category.menuGroup,
					});
				}
			}
		}

		return flat;
	}, [grouped]);

	useEffect(() => {
		if (!isOpen) return;
		setTimeout(() => searchInputRef.current?.focus(), 0);
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;

		const preferredMaxHeight = 352;
		const minimumUsableHeight = 180;
		const viewportPadding = 12;

		const updatePlacement = () => {
			if (!triggerRef.current) return;
			const rect = triggerRef.current.getBoundingClientRect();
			const availableBelow = window.innerHeight - rect.bottom - viewportPadding;
			const availableAbove = rect.top - viewportPadding;
			const placeAbove =
				availableBelow < minimumUsableHeight && availableAbove > availableBelow;
			const chosenSpace = placeAbove ? availableAbove : availableBelow;
			setPanelPlacement(placeAbove ? "top" : "bottom");
			setPanelMaxHeight(
				Math.max(
					minimumUsableHeight,
					Math.min(preferredMaxHeight, Math.floor(chosenSpace)),
				),
			);
		};

		updatePlacement();
		window.addEventListener("resize", updatePlacement);
		window.addEventListener("scroll", updatePlacement, true);
		return () => {
			window.removeEventListener("resize", updatePlacement);
			window.removeEventListener("scroll", updatePlacement, true);
		};
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;
		const onOutsidePointer = (event: MouseEvent | TouchEvent) => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (!rootRef.current?.contains(target)) {
				setIsOpen(false);
				setQuery("");
			}
		};
		document.addEventListener("mousedown", onOutsidePointer);
		document.addEventListener("touchstart", onOutsidePointer);
		return () => {
			document.removeEventListener("mousedown", onOutsidePointer);
			document.removeEventListener("touchstart", onOutsidePointer);
		};
	}, [isOpen]);

	useEffect(() => {
		if (activeIndex < options.length) return;
		setActiveIndex(Math.max(0, options.length - 1));
	}, [activeIndex, options.length]);

	function openPicker() {
		const selectedIndex = options.findIndex((option) => option.id === selectedItemId);
		setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
		setIsOpen(true);
	}

	function closePicker() {
		setIsOpen(false);
		setQuery("");
	}

	function selectOption(option: PickerOption) {
		onSelectItem(option.id);
		closePicker();
	}

	function onListKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((current) =>
				options.length === 0 ? 0 : Math.min(current + 1, options.length - 1),
			);
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((current) => Math.max(0, current - 1));
			return;
		}

		if (event.key === "Enter") {
			event.preventDefault();
			const option = options[activeIndex];
			if (option) {
				selectOption(option);
			}
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			closePicker();
		}
	}

	const listboxId = `${labelId}-listbox`;
	const activeOption = options[activeIndex];

	return (
		<div className="flex flex-col gap-2" ref={rootRef}>
			<label className="text-sm font-medium" id={labelId}>
				Edit existing item
			</label>

			<div className="relative">
				<button
					type="button"
					ref={triggerRef}
					className={cn(
						"w-full rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-left transition-colors",
						isOpen && "border-brand-secondary",
					)}
					onClick={() => (isOpen ? closePicker() : openPicker())}
					onKeyDown={(event) => {
						if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							openPicker();
						}
						if (event.key === "Escape") {
							event.preventDefault();
							closePicker();
						}
					}}
					aria-labelledby={labelId}
					aria-haspopup="listbox"
					aria-expanded={isOpen}
					aria-controls={listboxId}
				>
					<div className="pr-8">
						<p className="truncate font-medium">
							{grouped.selected?.name ?? "Create new item"}
						</p>
						<p className="mt-1 text-xs text-brand-muted">
							{grouped.selectedCategory
								? `${grouped.selectedCategory.name} · ${groupMetaLabel(grouped.selectedCategory.menuGroup)}`
								: "Select an existing menu item to edit"}
						</p>
					</div>
					<ChevronDown
						className={cn(
							"absolute top-1/2 right-3 size-4 -translate-y-1/2 text-brand-muted transition-transform",
							isOpen && "rotate-180",
						)}
						aria-hidden
					/>
				</button>

				{isOpen && (
					<div
						className={cn(
							"absolute z-30 w-full overflow-hidden rounded-xl border border-brand-border bg-brand-surface-raised shadow-2xl shadow-black/50",
							panelPlacement === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
						)}
					>
						<div className="border-b border-brand-border px-3 py-2">
							<div className="relative">
								<Search
									className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-brand-muted"
									aria-hidden
								/>
								<input
									ref={searchInputRef}
									type="text"
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									onKeyDown={onListKeyDown}
									placeholder="Search items or categories"
									className="min-h-10 w-full rounded-lg border border-brand-border bg-brand-surface pl-9 pr-3 text-sm"
									role="combobox"
									aria-expanded={isOpen}
									aria-controls={listboxId}
									aria-activedescendant={activeOption ? `${listboxId}-${activeOption.id || "create"}` : undefined}
								/>
							</div>
						</div>

						<div
							id={listboxId}
							role="listbox"
							className="gold-scrollbar overflow-y-auto p-2"
							style={{ maxHeight: `${panelMaxHeight}px` }}
						>
							<button
								type="button"
								id={`${listboxId}-create`}
								role="option"
								aria-selected={selectedItemId === ""}
								onMouseEnter={() => setActiveIndex(0)}
								onClick={() =>
									selectOption({
										kind: "create",
										id: "",
										itemName: "Create new item",
										categoryName: "",
										menuGroup: "food",
									})
								}
								className={cn(
									"mb-2 w-full rounded-lg px-3 py-2 text-left text-sm",
									activeIndex === 0 && "bg-brand-primary/20 text-brand-secondary",
									selectedItemId === "" && "bg-brand-primary/15",
								)}
							>
								Create new item
							</button>

							{grouped.groups.every((group) => grouped.byGroup[group].length === 0) ? (
								<p className="px-3 py-5 text-sm text-brand-muted">No menu items found</p>
							) : (
								grouped.groups.map((group) => {
									if (grouped.byGroup[group].length === 0) return null;
									return (
										<div key={group} className="mb-2">
											<p className="px-2 py-1 text-[11px] tracking-[0.24em] text-brand-muted uppercase">
												{groupLabel(group)}
											</p>
											{grouped.byGroup[group].map((category) => (
												<div key={category.categoryId} className="mb-1">
													<p className="px-2 py-1 text-xs font-semibold text-brand-muted">
														{category.categoryName}
													</p>
													<div className="grid gap-1">
														{category.items.map((item) => {
															const optionIndex = options.findIndex(
																(option) => option.id === item.id,
															);
															const isSelected = selectedItemId === item.id;
															const isActive = activeIndex === optionIndex;
															return (
																<button
																	type="button"
																	key={item.id}
																	id={`${listboxId}-${item.id}`}
																	role="option"
																	aria-selected={isSelected}
																	onMouseEnter={() => setActiveIndex(optionIndex)}
																	onClick={() =>
																		selectOption({
																			kind: "item",
																			id: item.id,
																			itemName: item.name,
																			categoryName: category.categoryName,
																			menuGroup: category.menuGroup,
																		})
																	}
																	className={cn(
																		"w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
																		isActive && "bg-brand-primary/20 text-brand-secondary",
																		isSelected && "border border-brand-primary/40 bg-brand-primary/15",
																	)}
																>
																	{item.name}
																</button>
															);
														})}
													</div>
												</div>
											))}
										</div>
									);
								})
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}