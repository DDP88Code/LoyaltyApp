import { QrCode, Sparkles, UtensilsCrossed } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { BRAND } from "@shared/branding";
import type { CustomerHomePayload, PromotionSummary } from "@shared/loyalty";
import { Button } from "@/components/ui/Button";
import { Card, CardDescription, CardTitle } from "@/components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useSession } from "@/features/auth/useSession";
import { useCustomerHome } from "@/features/customer/api";
import { CoffeeStampGrid } from "@/features/customer/CoffeeStampGrid";
import { RewardCard } from "@/features/customer/RewardCard";
import { mediaObjectUrl } from "@/lib/media";

export function HomePage() {
	const { data: user } = useSession();
	const home = useCustomerHome();

	if (home.isPending) return <LoadingState label="Loading your rewards…" />;
	if (home.isError) {
		return (
			<ErrorState
				description={home.error.message}
				onRetry={() => void home.refetch()}
			/>
		);
	}

	const { coffee, availableRewards, pointsEnabled } = home.data;
	const promotions = resolvePromotions(home.data);
	const remaining = coffee && coffee.threshold ? coffee.threshold - coffee.current : null;
	const rewardReady = remaining === 0;

	return (
		<div className="flex flex-col gap-4 p-5">
			<div>
				<h1 className="text-2xl">Hi, {user?.fullName?.split(" ")[0]}</h1>
				<p className="text-sm text-brand-muted">
					{rewardReady
						? "Your reward is ready to redeem."
						: "Keep collecting stamps towards your next reward."}
				</p>
			</div>

			{coffee && (
				<Card>
					<CardTitle>{coffee.programName}</CardTitle>
					<CardDescription>
						{rewardReady
							? `Show your ${BRAND.memberCodeName} to staff to redeem your free coffee.`
							: `${remaining} more to your next free coffee.`}
					</CardDescription>
					<div className="mt-4">
						<CoffeeStampGrid coffee={coffee} />
					</div>
				</Card>
			)}

			<Link
				to="/app/fives-code"
				className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-primary font-semibold text-brand-on-primary"
			>
				<QrCode className="size-4" aria-hidden />
				Show My {BRAND.memberCodeName}
			</Link>

			<Card>
				<CardTitle>Available rewards</CardTitle>
				{availableRewards.length === 0 ? (
					<EmptyState
						title="No rewards yet"
						description="Rewards you earn or redeem will show up here."
					/>
				) : (
					<div className="mt-3 flex flex-col gap-2">
						{availableRewards.map((reward) => (
							<RewardCard key={reward.id} reward={reward} />
						))}
					</div>
				)}
				<Link
					to="/app/rewards"
					className="mt-3 inline-block text-sm text-brand-secondary underline"
				>
					View all rewards
				</Link>
			</Card>

			{pointsEnabled && (
				<Card>
					<CardTitle>Points</CardTitle>
					<CardDescription>Coming soon.</CardDescription>
				</Card>
			)}

			{promotions.length > 0 && (
				<section className="flex flex-col gap-2">
					<h2 className="text-lg">Promotions</h2>
					{promotions.length === 1 ? (
						<PromotionCard promotion={promotions[0]!} />
					) : (
						<PromotionCarousel promotions={promotions} />
					)}
				</section>
			)}

			<Link
				to="/app/menu"
				className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand-border font-semibold transition-colors hover:bg-brand-surface-raised"
			>
				<UtensilsCrossed className="size-4" aria-hidden />
				Browse the menu
			</Link>
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

function PromotionCarousel({ promotions }: { promotions: PromotionSummary[] }) {
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
		if (promotions.length <= 1 || prefersReducedMotion) return;

		const timer = window.setInterval(() => {
			if (Date.now() < resumeAutoAdvanceAtRef.current) return;
			const scroller = scrollerRef.current;
			if (!scroller) return;

			const nextIndex = (currentIndexRef.current + 1) % promotions.length;
			currentIndexRef.current = nextIndex;
			setCurrentIndex(nextIndex);
			scroller.scrollTo({
				left: scroller.clientWidth * nextIndex,
				behavior: "smooth",
			});
		}, 3_000);

		return () => window.clearInterval(timer);
	}, [promotions.length, prefersReducedMotion]);

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
				className="flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-smooth [scrollbar-] [&::-webkit-scrollbar]:hidden"
			>
				{promotions.map((promotion) => (
					<div key={promotion.id} className="w-full min-w-full snap-start">
						<PromotionCard promotion={promotion} />
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

function PromotionCard({ promotion }: { promotion: PromotionSummary }) {
	return (
		<Card>
			{promotion.imageKey && (
				<img
					src={mediaObjectUrl(promotion.imageKey)}
					alt={promotion.title}
					className="mb-3 h-40 w-full rounded-xl object-cover"
					loading="lazy"
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
