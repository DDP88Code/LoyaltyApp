import { Coffee, Gift, QrCode, User, UtensilsCrossed } from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { cn } from "@/lib/cn";
import { useSession } from "@/features/auth/useSession";

const TABS = [
	{ to: "/app", label: "Home", icon: Coffee, end: true },
	{ to: "/app/rewards", label: "Rewards", icon: Gift, end: false },
	{ to: "/app/menu", label: "Menu", icon: UtensilsCrossed, end: false },
	{ to: "/app/profile", label: "Profile", icon: User, end: false },
] as const;

/**
 * Mobile-first shell for the customer app: a light top bar with the brand and
 * a bottom tab bar with Fives Code raised as the prominent centre action, per
 * section 15 of the master prompt.
 */
export function CustomerLayout() {
	const { data: user } = useSession();

	return (
		<div className="flex min-h-dvh flex-col pb-24">
			<header className="flex items-center justify-between border-b border-brand-border px-5 py-4">
				<div>
					<p className="text-xs tracking-[0.3em] text-brand-secondary uppercase">
						Fives Rewards
					</p>
					{user && (
						<p className="text-sm text-brand-muted">Hi, {user.fullName}</p>
					)}
				</div>
			</header>

			<main className="flex-1">
				<Outlet />
			</main>

			<nav
				aria-label="Primary"
				className="fixed inset-x-0 bottom-0 border-t border-brand-border bg-brand-surface pb-[env(safe-area-inset-bottom)]"
			>
				<div className="relative grid grid-cols-5 items-end px-2 pt-2 pb-2">
					{TABS.slice(0, 2).map((tab) => (
						<TabLink key={tab.to} {...tab} />
					))}

					<div className="flex justify-center">
						<NavLink
							to="/app/fives-code"
							className={({ isActive }) =>
								cn(
									"-mt-8 flex size-16 flex-col items-center justify-center rounded-full border-4 border-brand-background bg-brand-primary text-brand-on-primary shadow-lg transition-colors",
									isActive && "bg-brand-primary-strong",
								)
							}
						>
							<QrCode className="size-6" aria-hidden />
						</NavLink>
					</div>

					{TABS.slice(2).map((tab) => (
						<TabLink key={tab.to} {...tab} />
					))}
				</div>
			</nav>
		</div>
	);
}

function TabLink({
	to,
	label,
	icon: Icon,
	end,
}: (typeof TABS)[number]) {
	return (
		<NavLink
			to={to}
			end={end}
			className={({ isActive }) =>
				cn(
					"flex flex-col items-center gap-1 rounded-lg py-1 text-xs font-medium text-brand-muted transition-colors",
					isActive && "text-brand-primary",
				)
			}
		>
			<Icon className="size-5" aria-hidden />
			{label}
		</NavLink>
	);
}
