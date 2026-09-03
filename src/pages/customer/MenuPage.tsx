import { useEffect, useMemo, useState } from "react";
import {
	AlertTriangle,
	ChevronUp,
	Flame,
	Leaf,
	Sparkles,
	UtensilsCrossed,
} from "lucide-react";
import type { MenuGroup } from "@shared/menu";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useCustomerMenu } from "@/features/customer/api";
import { useOnlineStatus } from "@/features/system/useOnlineStatus";
import { mediaObjectUrl } from "@/lib/media";
import { formatCents } from "@/lib/money";

const VISUAL_FOOD_CATEGORIES = new Set([
	"light meals",
	"mains",
	"burgers",
	"wraps",
	"pizzas",
]);

function normalize(value: string) {
	return value.trim().toLowerCase();
}

function isVisualCategory(menuGroup: MenuGroup, categoryName: string): boolean {
	if (menuGroup !== "food") return false;
	return VISUAL_FOOD_CATEGORIES.has(normalize(categoryName));
}

function displayPrice(item: {
	priceCents: number;
	variants: { priceCents: number }[];
}) {
	if (item.variants.length === 0) return formatCents(item.priceCents);
	const min = Math.min(...item.variants.map((variant) => variant.priceCents));
	return `From ${formatCents(min)}`;
}

export function MenuPage() {
	const menu = useCustomerMenu();
	const isOnline = useOnlineStatus();
	const [menuGroup, setMenuGroup] = useState<MenuGroup>("food");
	const [search, setSearch] = useState("");
	const [activeCategoryId, setActiveCategoryId] = useState<string>("");
	const [detail, setDetail] = useState<{
		categoryName: string;
		item: {
			id: string;
			name: string;
			description: string;
			optionNotes: string;
			priceCents: number;
			imageKey: string | null;
			popular: boolean;
			vegetarian: boolean;
			spicy: boolean;
			isNew: boolean;
			subjectToAvailability: boolean;
			available: boolean;
			variants: { id: string; name: string; priceCents: number }[];
		};
	} | null>(null);
	const [showBackToTop, setShowBackToTop] = useState(false);

	const categories = useMemo(() => {
		if (!menu.data) return [];
		const term = search.trim().toLowerCase();

		return menu.data.categories
			.filter((category) => category.menuGroup === menuGroup)
			.map((category) => ({
				...category,
				items: !term
					? category.items
					: category.items.filter((item) => {
						if (category.name.toLowerCase().includes(term)) return true;
						if (item.name.toLowerCase().includes(term)) return true;
						if (item.description.toLowerCase().includes(term)) return true;
						return item.variants.some((variant) =>
							variant.name.toLowerCase().includes(term),
						);
					}),
			}))
			.filter((category) => category.items.length > 0);
	}, [menu.data, search, menuGroup]);

	useEffect(() => {
		setActiveCategoryId(categories[0]?.id ?? "");
	}, [categories]);

	useEffect(() => {
		const onScroll = () => setShowBackToTop(window.scrollY > 520);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	function jumpToCategory(categoryId: string) {
		setActiveCategoryId(categoryId);
		const target = document.getElementById(`menu-category-${categoryId}`);
		if (target) {
			target.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	}

	return (
		<div className="relative p-5 pb-28">
			<section className="rounded-[1.4rem] border border-brand-border bg-[linear-gradient(140deg,rgba(201,123,60,0.16),rgba(20,17,15,0.88)_45%,rgba(31,26,22,0.94))] p-5">
				<p className="text-xs tracking-[0.45em] text-brand-secondary uppercase">Fives</p>
				<h1 className="mt-2 text-3xl font-semibold">Menu</h1>
				<p className="mt-1 text-sm text-brand-muted">Good food. Cold drinks. Good times.</p>

				<div className="mt-4 inline-flex rounded-full border border-brand-border bg-brand-background p-1">
					<button
						type="button"
						onClick={() => setMenuGroup("food")}
						className={`min-w-24 rounded-full px-4 py-2 text-sm font-semibold transition ${menuGroup === "food" ? "bg-brand-primary text-brand-on-primary" : "text-brand-muted"}`}
					>
						FOOD
					</button>
					<button
						type="button"
						onClick={() => setMenuGroup("drinks")}
						className={`min-w-24 rounded-full px-4 py-2 text-sm font-semibold transition ${menuGroup === "drinks" ? "bg-brand-primary text-brand-on-primary" : "text-brand-muted"}`}
					>
						DRINKS
					</button>
				</div>
			</section>

			<div className="mt-4">
				<Input
					label="Search the menu"
					placeholder="Search the menu..."
					value={search}
					onChange={(event) => setSearch(event.target.value)}
				/>
			</div>

			{!isOnline && (
				<p className="mt-3 rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-muted">
					Offline mode: if this menu was loaded before, cached results remain browsable.
				</p>
			)}

			{menu.isPending && <LoadingState label="Loading the menu..." />}
			{menu.isError && !menu.data && (
				<ErrorState description={menu.error.message} onRetry={() => void menu.refetch()} />
			)}

			{menu.data && (
				<>
					{categories.length > 0 && (
						<div className="sticky top-0 z-10 mt-4 border-y border-brand-border bg-brand-background/95 py-2 backdrop-blur">
							<div className="no-scrollbar flex gap-2 overflow-x-auto px-1">
								{categories.map((category) => (
									<button
										key={category.id}
										type="button"
										onClick={() => jumpToCategory(category.id)}
										className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${activeCategoryId === category.id ? "border-brand-secondary bg-brand-surface-raised text-brand-text" : "border-brand-border text-brand-muted"}`}
									>
										{category.name}
									</button>
								))}
							</div>
						</div>
					)}

					<div className="mt-5 space-y-8">
						{categories.length === 0 ? (
							<EmptyState title="No menu items found" description="Try a different search term." />
						) : (
							categories.map((category) => {
								const visual = isVisualCategory(menuGroup, category.name);
								return (
									<section id={`menu-category-${category.id}`} key={category.id} className="scroll-mt-28">
										<div className="mb-3 flex items-baseline justify-between gap-2">
											<h2 className="text-xl">{category.name}</h2>
											<p className="text-xs tracking-[0.3em] text-brand-secondary uppercase">{category.menuGroup}</p>
										</div>
										{category.description && (
											<p className="mb-3 text-sm text-brand-muted">{category.description}</p>
										)}

										{visual ? (
											<div className="grid gap-4 sm:grid-cols-2">
												{category.items.map((item) => (
													<button
														type="button"
														key={item.id}
														onClick={() => setDetail({ categoryName: category.name, item })}
														className={`overflow-hidden rounded-card border bg-brand-surface text-left transition active:scale-[0.99] ${item.available ? "border-brand-border" : "border-brand-border opacity-70"}`}
													>
														{item.imageKey ? (
															<img
																src={mediaObjectUrl(item.imageKey)}
																alt={item.name}
																className="h-44 w-full object-cover"
																loading="lazy"
															/>
														) : (
															<div className="flex h-44 items-center justify-center bg-[radial-gradient(circle_at_top_right,rgba(201,123,60,0.28),rgba(31,26,22,0.95)_48%)] text-brand-muted">
																<UtensilsCrossed className="size-12" aria-hidden />
															</div>
														)}
														<div className="p-4">
															<div className="flex items-start justify-between gap-2">
																<p className="text-lg font-semibold leading-tight">{item.name}</p>
																<p className="shrink-0 text-lg font-semibold text-brand-secondary">{displayPrice(item)}</p>
															</div>
															{item.description && (
																<p className="mt-2 line-clamp-3 text-sm text-brand-muted">{item.description}</p>
															)}
															<div className="mt-3 flex flex-wrap gap-1.5">
																{item.isNew && <Badge tone="primary">New</Badge>}
																{item.popular && (
																	<Badge tone="primary">
																		<Sparkles className="size-3" aria-hidden />
																		Popular
																	</Badge>
																)}
																{item.vegetarian && (
																	<Badge tone="success">
																		<Leaf className="size-3" aria-hidden />
																		Vegetarian
																	</Badge>
																)}
																{item.spicy && (
																	<Badge tone="danger">
																		<Flame className="size-3" aria-hidden />
																		Spicy
																	</Badge>
																)}
																{item.subjectToAvailability && (
																	<Badge>
																		<AlertTriangle className="size-3" aria-hidden />
																		Subject to availability
																	</Badge>
																)}
																{!item.available && <Badge tone="danger">Sold out</Badge>}
															</div>
														</div>
													</button>
												))}
											</div>
										) : (
											<div className="overflow-hidden rounded-card border border-brand-border bg-brand-surface">
												{category.items.map((item) => (
													<div key={item.id} className="border-b border-brand-border px-4 py-3 last:border-b-0">
														<div className="flex items-start justify-between gap-3">
															<div className="min-w-0">
																<p className={`font-medium ${!item.available ? "text-brand-muted" : ""}`}>{item.name}</p>
																{item.description && <p className="mt-1 text-sm text-brand-muted">{item.description}</p>}
																{item.variants.length > 0 && (
																	<p className="mt-1 text-xs text-brand-muted">
																		{item.variants.map((variant) => `${variant.name} ${formatCents(variant.priceCents)}`).join(" | ")}
																	</p>
																)}
															</div>
															<p className="shrink-0 text-right font-semibold text-brand-secondary">{displayPrice(item)}</p>
														</div>
														<div className="mt-2 flex flex-wrap gap-1.5">
															{item.isNew && <Badge tone="primary">New</Badge>}
															{item.subjectToAvailability && <Badge>Subject to availability</Badge>}
															{!item.available && <Badge tone="danger">Sold out</Badge>}
														</div>
													</div>
												))}
											</div>
										)}
									</section>
								);
							})
						)}
					</div>

					<section className="mt-10 rounded-card border border-brand-border bg-brand-surface p-4">
						<h3 className="text-lg">Menu Information</h3>
						<details className="mt-3 rounded-xl border border-brand-border bg-brand-background px-3 py-2 text-sm">
							<summary className="cursor-pointer font-medium">Allergens & Important Information</summary>
							<div className="mt-2 space-y-2 text-brand-muted">
								<p>Food is prepared fresh from scratch. During busy periods, service may take longer.</p>
								<p>Some menu items are subject to availability.</p>
								<p>If you have food allergies, please tell staff before placing your request.</p>
								<p>A discretionary gratuity service charge may be added.</p>
							</div>
						</details>
					</section>
				</>
			)}

			{detail && (
				<div className="fixed inset-0 z-40">
					<button
						type="button"
						onClick={() => setDetail(null)}
						className="absolute inset-0 bg-black/65"
						aria-label="Close item detail"
					/>
					<section className="absolute inset-x-0 bottom-0 max-h-[84vh] overflow-y-auto rounded-t-[1.8rem] border-t border-brand-border bg-brand-surface p-5 pb-8">
						<div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-brand-border" />
						{detail.item.imageKey ? (
							<img
								src={mediaObjectUrl(detail.item.imageKey)}
								alt={detail.item.name}
								className="h-52 w-full rounded-2xl object-cover"
								loading="lazy"
							/>
						) : (
							<div className="flex h-52 items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_top_right,rgba(201,123,60,0.28),rgba(31,26,22,0.95)_48%)] text-brand-muted">
								<UtensilsCrossed className="size-16" aria-hidden />
							</div>
						)}
						<div className="mt-4 flex items-start justify-between gap-3">
							<div>
								<p className="text-xs tracking-[0.3em] text-brand-secondary uppercase">{detail.categoryName}</p>
								<h3 className="text-2xl">{detail.item.name}</h3>
							</div>
							<p className="text-xl font-semibold text-brand-secondary">{displayPrice(detail.item)}</p>
						</div>
						{detail.item.description && <p className="mt-2 text-brand-muted">{detail.item.description}</p>}
						{detail.item.optionNotes && (
							<p className="mt-2 rounded-lg border border-brand-border px-3 py-2 text-sm text-brand-muted">
								Options: {detail.item.optionNotes}
							</p>
						)}
						{detail.item.variants.length > 0 && (
							<div className="mt-4 rounded-xl border border-brand-border bg-brand-background/40 p-3">
								<p className="text-sm font-semibold">Variants</p>
								<div className="mt-2 grid gap-2">
									{detail.item.variants.map((variant) => (
										<div key={variant.id} className="flex items-center justify-between text-sm">
											<span>{variant.name}</span>
											<span className="font-semibold text-brand-secondary">{formatCents(variant.priceCents)}</span>
										</div>
									))}
								</div>
							</div>
						)}
						<div className="mt-4 flex flex-wrap gap-1.5">
							{detail.item.isNew && <Badge tone="primary">New</Badge>}
							{detail.item.popular && <Badge tone="primary">Popular</Badge>}
							{detail.item.vegetarian && <Badge tone="success">Vegetarian</Badge>}
							{detail.item.spicy && <Badge tone="danger">Spicy</Badge>}
							{detail.item.subjectToAvailability && <Badge>Subject to availability</Badge>}
							{!detail.item.available && <Badge tone="danger">Currently unavailable</Badge>}
						</div>
					</section>
				</div>
			)}

			{showBackToTop && (
				<button
					type="button"
					onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
					className="fixed right-4 bottom-24 z-20 inline-flex items-center gap-1 rounded-full border border-brand-border bg-brand-surface px-3 py-2 text-xs font-semibold"
				>
					<ChevronUp className="size-4" aria-hidden />
					Top
				</button>
			)}
		</div>
	);
}
