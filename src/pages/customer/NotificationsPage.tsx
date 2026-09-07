import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import {
	useCustomerNotifications,
	useCustomerUnreadNotifications,
	useMarkAllCustomerNotificationsRead,
	useMarkCustomerNotificationRead,
} from "@/features/customer/api";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 20;

const TYPE_LABELS: Record<string, string> = {
	reward_earned: "Reward earned",
	reward_expiring: "Reward expiring",
	birthday_reward: "Birthday",
	promotion: "Promotion",
	redemption_receipt: "Redemption",
	system: "System",
};

function typeLabel(type: string): string {
	return TYPE_LABELS[type] ?? "Update";
}

function formatDate(iso: string): string {
	return new Date(iso).toLocaleString("en-ZA", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function NotificationsPage() {
	const [offset, setOffset] = useState(0);
	const notifications = useCustomerNotifications({
		limit: PAGE_SIZE,
		offset,
	});
	const unread = useCustomerUnreadNotifications();
	const markOne = useMarkCustomerNotificationRead();
	const markAll = useMarkAllCustomerNotificationsRead();

	if (notifications.isPending) return <LoadingState label="Loading notifications..." />;
	if (notifications.isError) {
		return (
			<ErrorState
				description={notifications.error.message}
				onRetry={() => void notifications.refetch()}
			/>
		);
	}

	const { notifications: rows, total } = notifications.data;
	const unreadCount = unread.data?.unread ?? 0;

	if (rows.length === 0) {
		return (
			<div className="p-5">
				<EmptyState
					title="No notifications yet"
					description="Reward updates and account alerts will appear here."
					icon={<Bell className="size-8" />}
				/>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 p-5">
			<div className="flex items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl">Notifications</h1>
					<p className="text-sm text-brand-muted">
						{unreadCount > 0
							? `${unreadCount} unread`
							: "You are all caught up."}
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					leadingIcon={<CheckCheck className="size-4" aria-hidden />}
					loading={markAll.isPending}
					disabled={unreadCount === 0}
					onClick={() => markAll.mutate()}
				>
					Mark all read
				</Button>
			</div>

			{markAll.isError && (
				<p role="alert" className="text-sm text-brand-danger">
					{markAll.error.message}
				</p>
			)}

			<ul className="flex flex-col gap-2">
				{rows.map((item) => {
					const destination = item.actionUrl ?? "/app/rewards";
					const isUnread = !item.readAt;

					return (
						<li key={item.id}>
							<Link
								to={destination}
								onClick={() => {
									if (isUnread) markOne.mutate(item.id);
								}}
								className={cn(
									"block rounded-xl border px-4 py-3 transition-colors",
									isUnread
										? "border-brand-primary/70 bg-brand-primary/10"
										: "border-brand-border bg-brand-surface",
								)}
							>
								<div className="flex items-start justify-between gap-3">
									<div>
										<p className="font-medium">{item.title}</p>
										<p className="mt-1 text-sm text-brand-muted">{item.message}</p>
									</div>
									<Badge tone={isUnread ? "primary" : "neutral"}>
										{typeLabel(item.type)}
									</Badge>
								</div>
								<p className="mt-2 text-xs text-brand-muted">{formatDate(item.createdAt)}</p>
							</Link>
						</li>
					);
				})}
			</ul>

			{markOne.isError && (
				<p role="alert" className="text-sm text-brand-danger">
					{markOne.error.message}
				</p>
			)}

			{total > PAGE_SIZE && (
				<div className="flex items-center justify-between text-sm">
					<button
						type="button"
						disabled={offset === 0}
						onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
						className="text-brand-secondary underline disabled:opacity-40"
					>
						Newer
					</button>
					<button
						type="button"
						disabled={offset + PAGE_SIZE >= total}
						onClick={() => setOffset((value) => value + PAGE_SIZE)}
						className="text-brand-secondary underline disabled:opacity-40"
					>
						Older
					</button>
				</div>
			)}
		</div>
	);
}
