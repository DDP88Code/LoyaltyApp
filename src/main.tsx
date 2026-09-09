import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { registerSW } from "virtual:pwa-register";
import { BRAND } from "@shared/branding";
import { AppProviders } from "@/providers/AppProviders";
import { router } from "@/routes/router";
import "@/index.css";

const updateSW = registerSW({
	immediate: true,
	onRegisteredSW(_swUrl, registration) {
		if (!registration) return;
		void registration.update();
		setInterval(() => {
			void registration.update();
		}, 60_000);
	},
	onNeedRefresh() {
		void updateSW(true);
	},
});

const container = document.getElementById("root");
if (!container) throw new Error("Root element #root not found");

document.title = BRAND.rewardsName;

const descriptionTag = document.querySelector('meta[name="description"]');
if (descriptionTag) {
	descriptionTag.setAttribute(
		"content",
		`${BRAND.rewardsName} — loyalty rewards for ${BRAND.fullName}.`,
	);
}

createRoot(container).render(
	<StrictMode>
		<AppProviders>
			<RouterProvider router={router} />
		</AppProviders>
	</StrictMode>,
);
