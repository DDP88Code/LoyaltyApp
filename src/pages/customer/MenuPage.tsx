import { useMemo, useState } from "react";
import { Flame, Leaf, Sparkles, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useCustomerMenu } from "@/features/customer/api";
import { formatCents } from "@/lib/money";

export function MenuPage() {
	const menu = useCustomerMenu();
	const [search, setSearch] = useState("");

	const categories = useMemo(() => {
		if (!menu.data) return [];
		const term = search.trim().toLowerCase();
		if (!term) return menu.data.categories;

		return menu.data.categories
			.map((category) => ({
				...category,
				items: category.items.filter(
					(item) =>
						item.name.toLowerCase().includes(term) ||
						item.description.toLowerCase().includes(term),
				),
			}))
			.filter((category) => category.items.length > 0);
	}, [menu.data, search]);

	return (
		<div className="p-5">
			<PageHeader title="Menu" subtitle="Browsing only — order and pay with staff." />

			<Input
				label="Search the menu"
				placeholder="Search dishes…"
				value={search}
				onChange={(event) => setSearch(event.target.value)}
			/>

			<div className="mt-5 flex flex-col gap-6">
				{menu.isPending && <LoadingState label="Loading the menu…" />}
				{menu.isError && (
					<ErrorState
						description={menu.error.message}
						onRetry={() => void menu.refetch()}
					/>
				)}
				{menu.data && categories.length === 0 && (
					<EmptyState
						title="No dishes found"
						description="Try a different search."
					/>
				)}

				{categories.map((category) => (
					<section key={category.id}>
						<h2 className="mb-3 text-lg">{category.name}</h2>
						<div className="flex flex-col gap-3">
							{category.items.map((item) => (
								<article
									key={item.id}
									className="flex gap-3 rounded-card border border-brand-border bg-brand-surface p-4"
								>
									<div className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-brand-surface-raised text-brand-muted">
										<UtensilsCrossed className="size-6" aria-hidden />
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-start justify-between gap-2">
											<p className="font-medium">{item.name}</p>
											<p className="shrink-0 font-semibold">
												{formatCents(item.priceCents)}
											</p>
										</div>
										<p className="mt-1 text-sm text-brand-muted">
											{item.description}
										</p>
										<div className="mt-2 flex flex-wrap gap-1.5">
											{!item.available && (
												<Badge tone="danger">Sold out</Badge>
											)}
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
										</div>
									</div>
								</article>
							))}
						</div>
					</section>
				))}
			</div>
		</div>
	);
}
