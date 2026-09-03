import { Gift, Ticket } from "lucide-react";
import type { RewardSummary } from "@shared/loyalty";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatCents } from "@/lib/money";

const STATUS_TONE = {
	available: "primary",
	redeemed: "neutral",
	expired: "danger",
	cancelled: "neutral",
} as const;

const STATUS_LABEL = {
	available: "Available",
	redeemed: "Redeemed",
	expired: "Expired",
	cancelled: "Cancelled",
} as const;

export function RewardCard({ reward }: { reward: RewardSummary }) {
	const Icon = reward.rewardType === "voucher" ? Ticket : Gift;

	return (
		<Card className="flex items-start gap-3">
			<div className="rounded-full bg-brand-primary/15 p-2 text-brand-primary">
				<Icon className="size-5" aria-hidden />
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex items-start justify-between gap-2">
					<p className="font-medium">{reward.name}</p>
					<Badge tone={STATUS_TONE[reward.status]}>
						{STATUS_LABEL[reward.status]}
					</Badge>
				</div>
				{reward.valueCents !== null && (
					<p className="text-sm text-brand-muted">
						Worth {formatCents(reward.valueCents)}
					</p>
				)}
				{reward.status === "available" && reward.expiresAt && (
					<p className="mt-1 text-xs text-brand-muted">
						Expires {new Date(reward.expiresAt).toLocaleDateString("en-ZA")}
					</p>
				)}
				{reward.status === "redeemed" && reward.redeemedAt && (
					<p className="mt-1 text-xs text-brand-muted">
						Redeemed {new Date(reward.redeemedAt).toLocaleDateString("en-ZA")}
					</p>
				)}
			</div>
		</Card>
	);
}
