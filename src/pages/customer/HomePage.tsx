import { QrCode, Sparkles, UtensilsCrossed } from "lucide-react";
import { Link } from "react-router";
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

	const { coffee, availableRewards, activePromotion, pointsEnabled } = home.data;
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
							? "Show your Fives Code to staff to redeem your free coffee."
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
				Show My Fives Code
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

			{activePromotion && (
				<Card>
					{activePromotion.imageKey && (
						<img
							src={mediaObjectUrl(activePromotion.imageKey)}
							alt={activePromotion.title}
							className="mb-3 h-40 w-full rounded-xl object-cover"
							loading="lazy"
						/>
					)}
					<div className="flex items-start gap-3">
						<Sparkles className="size-5 shrink-0 text-brand-secondary" aria-hidden />
						<div>
							<CardTitle>{activePromotion.title}</CardTitle>
							{activePromotion.subtitle && (
								<CardDescription>{activePromotion.subtitle}</CardDescription>
							)}
							{activePromotion.description && (
								<CardDescription className="mt-1">
									{activePromotion.description}
								</CardDescription>
							)}
						</div>
					</div>
					{activePromotion.ctaText && activePromotion.ctaUrl && (
						<Link to={activePromotion.ctaUrl} className="mt-3 inline-block">
							<Button size="sm" variant="outline">
								{activePromotion.ctaText}
							</Button>
						</Link>
					)}
				</Card>
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
