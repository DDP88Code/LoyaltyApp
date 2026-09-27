import { ChevronRight, Gift, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { CustomerHomePayload, PromotionSummary } from "@shared/loyalty";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { ErrorState, LoadingState } from "@/components/ui/States";
import {
	customerMenuQueryOptions,
	useCustomerHome,
} from "@/features/customer/api";
import { CoffeeStampGrid } from "@/features/customer/CoffeeStampGrid";
import { prefetchMenuImages } from "@/features/customer/menuImagePrefetch";
import { prefetchPromotionImages } from "@/features/customer/promotionImagePrefetch";
import { promotionMediaObjectUrl } from "@/lib/media";

export function HomePage() {
	const queryClient = useQueryClient();
	const home = useCustomerHome();

	useEffect(() => {
		if (!home.data) return;
		if (typeof window === "undefined") return;
		const activePromotions = resolvePromotions(home.data);
		prefetchPromotionImages(activePromotions, { priorityCount: 1 });

		let cancelled = false;

		const prefetch = async () => {
			try {
				const menuData = await queryClient.ensureQueryData(customerMenuQueryOptions());
				if (cancelled) return;
				const firstFoodCategoryId =
					menuData.categories.find((category) => category.menuGroup === "food")?.id ??
					menuData.categories[0]?.id;
				prefetchMenuImages(menuData, {
					preferredCategoryId: firstFoodCategoryId,
					priorityCount: 4,
				});
			} catch {
				// Ignore background prefetch failures; the menu screen can still fetch directly.
			}
		};

		if (typeof window.requestIdleCallback === "function") {
			const idleId = window.requestIdleCallback(() => {
				void prefetch();
			}, { timeout: 1_200 });
			return () => {
				cancelled = true;
				window.cancelIdleCallback(idleId);
			};
		}

		const timeoutId = window.setTimeout(() => {
			void prefetch();
		}, 250);
		return () => {
			cancelled = true;
			window.clearTimeout(timeoutId);
		};
	}, [home.data, queryClient]);

	if (home.isPending) return <LoadingState label="Loading your rewards…" />;
	if (home.isError) {
		return (
			<ErrorState
				description={home.error.message}
				onRetry={() => void home.refetch()}
			/>
		);
	}

	const { coffee, availableRewards } = home.data;
	const promotions = resolvePromotions(home.data);
	const promotionCarouselSpeedSeconds = resolvePromotionCarouselSpeedSeconds(
		home.data,
	);
	const availableRewardCount = availableRewards.length;
	const threshold = coffee?.threshold ?? null;
	const remaining =
		coffee && threshold !== null ? Math.max(threshold - coffee.current, 0) : null;
	const rewardReady = remaining === 0;
	const rewardLabel =
		availableRewardCount === 1
			? "1 reward available"
			: `${availableRewardCount} rewards available`;

	return (
		<div className="flex flex-col gap-3 p-5">

			{coffee && (
				<Card className="p-4">
					<p className="text-xs tracking-[0.2em] text-brand-secondary uppercase">
						Your coffee reward
					</p>
					<div className="mt-2 flex items-end justify-between gap-2">
						<p className="text-base font-semibold">
							{coffee.current}
							{threshold !== null ? ` / ${threshold}` : ""} coffees
						</p>
						{remaining !== null && (
							<p className="text-xs font-medium text-brand-secondary">
								{rewardReady ? "Reward ready" : `${remaining} to go`}
							</p>
						)}
					</div>
					<div className="mt-3">
						<CoffeeStampGrid coffee={coffee} compact />
					</div>
					<CardDescription className="mt-3">
						{threshold !== null
							? `Buy ${threshold} coffees to unlock your next reward.`
							: "Keep collecting coffees to unlock your next reward."}
					</CardDescription>
				</Card>
			)}

			{availableRewardCount > 0 && (
				<Link
					to="/app/rewards?tab=available"
					className="block rounded-card border border-brand-border bg-brand-surface p-4 shadow-lg shadow-black/30 transition-colors hover:bg-brand-surface-raised"
					aria-label="View available rewards"
				>
					<div className="flex items-center gap-3">
						<div className="rounded-full bg-brand-primary/15 p-2 text-brand-primary">
							<Gift className="size-5" aria-hidden />
						</div>
						<div className="min-w-0 flex-1">
							<p className="font-semibold">{rewardLabel}</p>
							<p className="text-sm text-brand-muted">Your Fives rewards are ready to use.</p>
						</div>
						<ChevronRight className="size-5 text-brand-muted" aria-hidden />
					</div>
				</Link>
			)}

			{promotions.length > 0 && (
				<section className="flex flex-col gap-2">
					<h2 className="text-xs tracking-[0.28em] text-brand-secondary uppercase">
						What&apos;s on at Fives Sports Bar
					</h2>
					{promotions.length === 1 ? (
						<PromotionCard promotion={promotions[0]!} prioritizeImage />
					) : (
						<PromotionCarousel
							promotions={promotions}
							autoAdvanceSeconds={promotionCarouselSpeedSeconds}
						/>
					)}
				</section>
			)}
		</div>
	);
}

function resolvePromotions(homeData: CustomerHomePayload): PromotionSummary[] {
	const fromList = (homeData as CustomerHomePayload & {
		activePromotions?: PromotionSummary[] | null;
	}).activePromotions;
	if (Array.isArray(fromList)) {
		return fromList;
	}
	return homeData.activePromotion ? [homeData.activePromotion] : [];
}

function resolvePromotionCarouselSpeedSeconds(homeData: CustomerHomePayload): number {
	if (
		Number.isInteger(homeData.promotionCarouselSpeedSeconds) &&
		homeData.promotionCarouselSpeedSeconds >= 2 &&
		homeData.promotionCarouselSpeedSeconds <= 15
	) {
		return homeData.promotionCarouselSpeedSeconds;
	}

	return 3;
}

function usePrefersReducedMotion(): boolean {
	const [reducedMotion, setReducedMotion] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
			return;
		}

		const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		const update = () => setReducedMotion(mediaQuery.matches);
		update();

		if (typeof mediaQuery.addEventListener === "function") {
			mediaQuery.addEventListener("change", update);
			return () => mediaQuery.removeEventListener("change", update);
		}

		mediaQuery.addListener(update);
		return () => mediaQuery.removeListener(update);
	}, []);

	return reducedMotion;
}

function PromotionCarousel({
	promotions,
	autoAdvanceSeconds,
}: {
	promotions: PromotionSummary[];
	autoAdvanceSeconds: number;
}) {
	const scrollerRef = useRef<HTMLDivElement | null>(null);
	const currentIndexRef = useRef(0);
	const resumeAutoAdvanceAtRef = useRef(0);
	const [currentIndex, setCurrentIndex] = useState(0);
	const prefersReducedMotion = usePrefersReducedMotion();

	useEffect(() => {
		currentIndexRef.current = currentIndex;
	}, [currentIndex]);

	useEffect(() => {
		currentIndexRef.current = 0;
		setCurrentIndex(0);
		const scroller = scrollerRef.current;
		if (!scroller) return;
		scroller.scrollTo({ left: 0, behavior: "auto" });
	}, [promotions.length]);

	useEffect(() => {
		if (promotions.length <= 1) return;

		const timer = window.setInterval(() => {
			if (Date.now() < resumeAutoAdvanceAtRef.current) return;
			const scroller = scrollerRef.current;
			if (!scroller) return;

			const nextIndex = (currentIndexRef.current + 1) % promotions.length;
			currentIndexRef.current = nextIndex;
			setCurrentIndex(nextIndex);
			scroller.scrollTo({
				left: scroller.clientWidth * nextIndex,
				behavior: prefersReducedMotion ? "auto" : "smooth",
			});
		}, autoAdvanceSeconds * 1_000);

		return () => window.clearInterval(timer);
	}, [autoAdvanceSeconds, promotions.length, prefersReducedMotion]);

	const pauseAutoAdvance = () => {
		resumeAutoAdvanceAtRef.current = Date.now() + 6_000;
	};

	const syncCurrentIndexFromScroll = () => {
		const scroller = scrollerRef.current;
		if (!scroller || scroller.clientWidth === 0) return;
		const nextIndex = Math.round(scroller.scrollLeft / scroller.clientWidth);
		if (nextIndex !== currentIndexRef.current) {
			currentIndexRef.current = nextIndex;
			setCurrentIndex(nextIndex);
		}
	};

	const jumpToPromotion = (index: number) => {
		const scroller = scrollerRef.current;
		if (!scroller) return;
		pauseAutoAdvance();
		currentIndexRef.current = index;
		setCurrentIndex(index);
		scroller.scrollTo({
			left: scroller.clientWidth * index,
			behavior: prefersReducedMotion ? "auto" : "smooth",
		});
	};

	return (
		<div className="overflow-hidden">
			<div
				ref={scrollerRef}
				onScroll={syncCurrentIndexFromScroll}
				onPointerDown={pauseAutoAdvance}
				onTouchStart={pauseAutoAdvance}
				onWheel={pauseAutoAdvance}
				className={`flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-] [&::-webkit-scrollbar]:hidden ${
					prefersReducedMotion ? "scroll-auto" : "scroll-smooth"
				}`}
			>
				{promotions.map((promotion, index) => (
					<div key={promotion.id} className="w-full min-w-full snap-start">
						<PromotionCard promotion={promotion} prioritizeImage={index === 0} />
					</div>
				))}
			</div>

			<div className="mt-2 flex justify-center gap-1.5">
				{promotions.map((promotion, index) => {
					const active = index === currentIndex;
					return (
						<button
							key={promotion.id}
							type="button"
							onClick={() => jumpToPromotion(index)}
							aria-label={`Go to promotion ${index + 1}`}
							aria-current={active}
							className={`h-2.5 w-2.5 rounded-full transition-colors ${
								active ? "bg-brand-secondary" : "bg-brand-border"
							}`}
						/>
					);
				})}
			</div>
		</div>
	);
}

function PromotionCard({
	promotion,
	prioritizeImage = false,
}: {
	promotion: PromotionSummary;
	prioritizeImage?: boolean;
}) {
	return (
		<Card>
			{promotion.imageKey && (
				<img
					src={promotionMediaObjectUrl(promotion.imageKey)}
					alt={promotion.title}
					className="mb-3 aspect-video w-full rounded-xl object-cover"
					width={1600}
					height={900}
					loading={prioritizeImage ? "eager" : "lazy"}
					fetchPriority={prioritizeImage ? "high" : "low"}
					decoding="async"
				/>
			)}
			<div className="flex items-start gap-3">
				<Sparkles className="size-5 shrink-0 text-brand-secondary" aria-hidden />
				<div>
					<CardTitle>{promotion.title}</CardTitle>
					{promotion.subtitle && (
						<CardDescription>{promotion.subtitle}</CardDescription>
					)}
					{promotion.description && (
						<CardDescription className="mt-1">{promotion.description}</CardDescription>
					)}
				</div>
			</div>
			{promotion.ctaText && promotion.ctaUrl && (
				<Link to={promotion.ctaUrl} className="mt-3 inline-block">
					<Button size="sm" variant="outline">
						{promotion.ctaText}
					</Button>
				</Link>
			)}
		</Card>
	);
}
