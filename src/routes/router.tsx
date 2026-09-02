import { createBrowserRouter } from "react-router";
import { LandingPage } from "@/pages/LandingPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PhasePlaceholderPage } from "@/pages/PhasePlaceholderPage";

export const router = createBrowserRouter([
	{ path: "/", element: <LandingPage /> },
	{
		path: "/app/*",
		element: <PhasePlaceholderPage title="Fives Rewards" phase="Phase 5" />,
	},
	{
		path: "/staff/*",
		element: <PhasePlaceholderPage title="Staff" phase="Phase 7" />,
	},
	{
		path: "/admin/*",
		element: <PhasePlaceholderPage title="Admin" phase="Phase 11" />,
	},
	{ path: "*", element: <NotFoundPage /> },
]);
