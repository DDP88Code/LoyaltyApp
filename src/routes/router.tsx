import { createBrowserRouter } from "react-router";
import { AppShell } from "@/features/auth/AppShell";
import {
	RedirectIfSignedIn,
	RequireAuth,
	RequireRole,
} from "@/features/auth/guards";
import { CustomerLayout } from "@/features/customer/CustomerLayout";
import { StaffLayout } from "@/features/staff/StaffLayout";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PhasePlaceholderPage } from "@/pages/PhasePlaceholderPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { TermsPage } from "@/pages/TermsPage";
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
				element: <AppShell />,
				children: [
					{
						element: <RequireRole allow={["admin", "owner"]} />,
						children: [
							{
								path: "/admin/*",
								element: <PhasePlaceholderPage title="Admin" phase="Phase 11" />,
							},
						],
					},
				],
			},
		],
	},
	{ path: "*", element: <NotFoundPage /> },
]);
