import { createBrowserRouter, Navigate } from "react-router";
import {
	RedirectIfSignedIn,
	RequireAuth,
	RequireRole,
} from "@/features/auth/guards";
import { AdminLayout } from "@/features/admin/core/AdminLayout";
import { CustomerLayout } from "@/features/customer/CustomerLayout";
import { StaffLayout } from "@/features/staff/StaffLayout";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { TermsPage } from "@/pages/TermsPage";
import { AdminAuditLogPage } from "@/pages/admin/AdminAuditLogPage";
import { AdminCustomersPage } from "@/pages/admin/AdminCustomersPage";
import { AdminDashboardPage } from "@/pages/admin/AdminDashboardPage";
import { AdminLoyaltyPage } from "@/pages/admin/AdminLoyaltyPage";
import { AdminMenuPage } from "@/pages/admin/AdminMenuPage";
import { AdminPromotionsPage } from "@/pages/admin/AdminPromotionsPage";
import { AdminReportsPage } from "@/pages/admin/AdminReportsPage";
import { AdminRewardsPage } from "@/pages/admin/AdminRewardsPage";
import { AdminSettingsPage } from "@/pages/admin/AdminSettingsPage";
import { AdminStaffPage } from "@/pages/admin/AdminStaffPage";
import { AdminTransactionsPage } from "@/pages/admin/AdminTransactionsPage";
import { FivesCodePage } from "@/pages/customer/FivesCodePage";
import { HomePage } from "@/pages/customer/HomePage";
import { MenuPage } from "@/pages/customer/MenuPage";
import { ProfilePage } from "@/pages/customer/ProfilePage";
import { RewardsPage } from "@/pages/customer/RewardsPage";
import { StaffHomePage } from "@/pages/staff/StaffHomePage";

export const router = createBrowserRouter([
	{ path: "/", element: <LandingPage /> },
	{ path: "/terms", element: <TermsPage /> },
	{ path: "/privacy", element: <PrivacyPage /> },
	{
		element: <RedirectIfSignedIn />,
		children: [
			{ path: "/login", element: <LoginPage /> },
			{ path: "/register", element: <RegisterPage /> },
		],
	},
	{
		// Route guards are a navigation convenience. The Worker enforces the same
		// rules on every request, because the browser can be lied to.
		element: <RequireAuth />,
		children: [
			{
				element: <RequireRole allow={["customer"]} />,
				children: [
					{
						element: <CustomerLayout />,
						children: [
							{ path: "/app", element: <HomePage /> },
							{ path: "/app/rewards", element: <RewardsPage /> },
							{ path: "/app/fives-code", element: <FivesCodePage /> },
							{ path: "/app/menu", element: <MenuPage /> },
							{ path: "/app/profile", element: <ProfilePage /> },
						],
					},
				],
			},
			{
				element: <RequireRole allow={["staff", "admin", "owner"]} />,
				children: [
					{
						element: <StaffLayout />,
						children: [{ path: "/staff", element: <StaffHomePage /> }],
					},
				],
			},
			{
				element: <RequireRole allow={["admin", "owner"]} />,
				children: [
					{
						element: <AdminLayout />,
						children: [
							{ path: "/admin", element: <AdminDashboardPage /> },
							{ path: "/admin/customers", element: <AdminCustomersPage /> },
							{ path: "/admin/loyalty", element: <AdminLoyaltyPage /> },
							{ path: "/admin/rewards", element: <AdminRewardsPage /> },
							{ path: "/admin/transactions", element: <AdminTransactionsPage /> },
							{ path: "/admin/menu", element: <AdminMenuPage /> },
							{ path: "/admin/promotions", element: <AdminPromotionsPage /> },
							{ path: "/admin/staff", element: <AdminStaffPage /> },
							{ path: "/admin/reports", element: <AdminReportsPage /> },
							{ path: "/admin/settings", element: <AdminSettingsPage /> },
							{ path: "/admin/audit-log", element: <AdminAuditLogPage /> },
							{ path: "/admin/*", element: <Navigate to="/admin" replace /> },
						],
					},
				],
			},
		],
	},
	{ path: "*", element: <NotFoundPage /> },
]);
