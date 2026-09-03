import {
	BarChart3,
	ClipboardList,
	Gift,
	LayoutDashboard,
	LogOut,
	Megaphone,
	Settings,
	ShieldCheck,
	Users,
	UserSquare2,
	UtensilsCrossed,
} from "lucide-react";
import { NavLink, Outlet } from "react-router";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { useSession, useSignOut } from "@/features/auth/useSession";

const NAV_ITEMS = [
	{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
	{ to: "/admin/customers", label: "Customers", icon: Users },
	{ to: "/admin/loyalty", label: "Loyalty", icon: ShieldCheck },
	{ to: "/admin/rewards", label: "Rewards", icon: Gift },
	{ to: "/admin/transactions", label: "Transactions", icon: ClipboardList },
	{ to: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
	{ to: "/admin/promotions", label: "Promotions", icon: Megaphone },
	{ to: "/admin/staff", label: "Staff", icon: UserSquare2 },
	{ to: "/admin/reports", label: "Reports", icon: BarChart3 },
	{ to: "/admin/settings", label: "Settings", icon: Settings },
	{ to: "/admin/audit-log", label: "Audit Log", icon: ClipboardList },
] as const;

export function AdminLayout() {
	const { data: user } = useSession();
	const signOut = useSignOut();

	return (
		<div className="min-h-dvh bg-brand-background text-brand-text lg:grid lg:grid-cols-[260px_1fr]">
			<aside className="border-r border-brand-border bg-brand-surface/70 p-4 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
				<div className="mb-4 rounded-xl border border-brand-border bg-brand-surface-raised px-3 py-3">
					<p className="text-xs tracking-[0.3em] text-brand-secondary uppercase">
						Fives Admin
					</p>
					{user && (
						<>
							<p className="mt-2 truncate text-sm font-semibold">{user.fullName}</p>
							<p className="text-xs text-brand-muted capitalize">{user.role}</p>
						</>
					)}
				</div>

				<nav aria-label="Admin" className="grid gap-1">
					{NAV_ITEMS.map((item) => (
						<NavLink
							key={item.to}
							to={item.to}
							end={"end" in item ? item.end : false}
							className={({ isActive }) =>
								cn(
									"flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
									isActive
										? "bg-brand-primary/20 text-brand-primary"
										: "text-brand-muted hover:bg-brand-surface-raised hover:text-brand-text",
								)
							}
						>
							<item.icon className="size-4" aria-hidden />
							{item.label}
						</NavLink>
					))}
				</nav>

				<Button
					variant="outline"
					size="sm"
					className="mt-4 w-full"
					loading={signOut.isPending}
					leadingIcon={<LogOut className="size-4" aria-hidden />}
					onClick={() => signOut.mutate()}
				>
					Sign out
				</Button>
			</aside>

			<div className="min-w-0">
				<Outlet />
			</div>
		</div>
	);
}
