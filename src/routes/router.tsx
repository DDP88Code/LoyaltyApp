import { createBrowserRouter } from "react-router";
import { AppShell } from "@/features/auth/AppShell";
import {
	RedirectIfSignedIn,
	RequireAuth,
	RequireRole,
} from "@/features/auth/guards";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PhasePlaceholderPage } from "@/pages/PhasePlaceholderPage";
import { RegisterPage } from "@/pages/RegisterPage";

export const router = createBrowserRouter([
	{ path: "/", element: <LandingPage /> },
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
				element: <AppShell />,
				children: [
					{
						element: <RequireRole allow={["customer"]} />,
						children: [
							{
								path: "/app/*",
								element: (
									<PhasePlaceholderPage title="Fives Rewards" phase="Phase 5" />
								),
							},
						],
					},
					{
						element: <RequireRole allow={["staff", "admin", "owner"]} />,
						children: [
							{
								path: "/staff/*",
								element: <PhasePlaceholderPage title="Staff" phase="Phase 7" />,
							},
						],
					},
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
