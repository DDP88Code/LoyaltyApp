import { AlertTriangle, Bell, Coffee, Gift, QrCode, User, UtensilsCrossed } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router";
import { BRAND } from "@shared/branding";
import { cn } from "@/lib/cn";
import { useSession } from "@/features/auth/useSession";
import { useCustomerHome, useCustomerUnreadNotifications } from "@/features/customer/api";
import { MarketingOptInModal } from "@/features/customer/MarketingOptInModal";

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
	const unread = useCustomerUnreadNotifications();
	const home = useCustomerHome();
	const unreadCount = unread.data?.unread ?? 0;
	const points = home.data?.pointsEnabled ? home.data.points : null;
	const pointsValue = points?.availableBalance ?? 0;
	const pointsAria = points
		? points.inRecovery
			? `${points.programName}: ${points.availableBalance.toLocaleString("en-ZA")} available, ${points.recoveryPoints.toLocaleString("en-ZA")} points to recover`
			: `${points.programName}: ${points.availableBalance.toLocaleString("en-ZA")} available`
		: null;
	const [compactHeader, setCompactHeader] = useState(false);
	const headerRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		const onScroll = () => {
			setCompactHeader(window.scrollY > 12);
		};

		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	useEffect(() => {
		const header = headerRef.current;
		if (!header || typeof document === "undefined") return;

		const updateHeaderHeightVar = () => {
			document.documentElement.style.setProperty(
				"--customer-header-height",
				`${header.getBoundingClientRect().height}px`,
			);
		};

		updateHeaderHeightVar();

		if (typeof ResizeObserver === "undefined") {
			window.addEventListener("resize", updateHeaderHeightVar);
			return () => {
				window.removeEventListener("resize", updateHeaderHeightVar);
				document.documentElement.style.removeProperty("--customer-header-height");
			};
		}

		const observer = new ResizeObserver(updateHeaderHeightVar);
		observer.observe(header);

		return () => {
			observer.disconnect();
			document.documentElement.style.removeProperty("--customer-header-height");
		};
	}, [compactHeader]);

	return (
		<div className="flex min-h-dvh flex-col pb-[calc(6rem+var(--safe-area-bottom))]">
			<MarketingOptInModal />

			<header
				ref={headerRef}
				data-customer-global-header
				className="sticky top-0 z-30 border-b border-brand-border bg-brand-background/95 backdrop-blur"
			>
				<div
					className={cn(
						"flex items-center justify-between px-5 transition-[padding] duration-200 ease-out motion-reduce:transition-none",
						compactHeader ? "py-2.5" : "py-4",
					)}
				>
					<div className="min-w-0">
						<p className="truncate text-xs tracking-[0.3em] text-brand-secondary uppercase">
						{BRAND.shortName}
					</p>
					{user && (
							<p
								className={cn(
									"overflow-hidden text-sm text-brand-muted transition-[opacity,max-height,margin] duration-200 ease-out motion-reduce:transition-none",
									compactHeader ? "mt-0 max-h-0 opacity-0" : "mt-0.5 max-h-6 opacity-100",
								)}
							>
								Hi, {user.fullName}
							</p>
					)}
				</div>

					<div className="flex shrink-0 items-center gap-2">
						{points && (
							<NavLink
								to="/app/rewards?tab=points"
								className={({ isActive }) =>
									cn(
										"relative inline-flex min-w-0 max-w-44 items-center gap-1.5 rounded-full border border-brand-border bg-brand-surface-raised px-2.5 py-1.5 text-xs font-semibold text-brand-muted transition-colors hover:text-brand-text",
										isActive && "text-brand-primary",
									)
								}
								aria-label={pointsAria ?? "Reward points"}
							>
								{points.inRecovery && (
									<AlertTriangle className="size-3.5 shrink-0 text-brand-warning" aria-hidden />
								)}
								<span className="truncate">{pointsValue.toLocaleString("en-ZA")}</span>
								<span className="inline max-[380px]:hidden">pts</span>
							</NavLink>
						)}

						<NavLink
							to="/app/notifications"
							className={({ isActive }) =>
								cn(
									"relative inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-brand-border bg-brand-surface-raised text-brand-muted transition-colors hover:text-brand-text",
									isActive && "text-brand-primary",
								)
							}
							aria-label="Notifications"
						>
							<Bell className="size-5" aria-hidden />
							{unreadCount > 0 && (
								<span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-brand-danger px-1.5 text-[10px] font-semibold text-white">
									{unreadCount > 99 ? "99+" : unreadCount}
								</span>
							)}
						</NavLink>
					</div>
				</div>
			</header>

			<main className="flex-1 min-w-0">
				<Outlet />
			</main>

			<nav
				aria-label="Primary"
				className="fixed inset-x-0 bottom-0 border-t border-brand-border bg-brand-surface"
				style={{ paddingBottom: "var(--safe-area-bottom)" }}
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
