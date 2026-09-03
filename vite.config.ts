import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		cloudflare(),
		VitePWA({
			registerType: "prompt",
			includeAssets: ["favicon.svg", "icons/apple-touch-icon.png"],
			manifest: {
				id: "/",
				name: "Fives Rewards",
				short_name: "Fives",
				description: "Loyalty rewards for Fives Pub & Grill.",
				lang: "en-ZA",
				dir: "ltr",
				start_url: "/",
				scope: "/",
				display: "standalone",
				display_override: ["standalone", "browser"],
				orientation: "portrait",
				background_color: "#14110f",
				theme_color: "#14110f",
				categories: ["food", "lifestyle"],
				icons: [
					{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
					{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
					{
						src: "/icons/icon-512-maskable.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			workbox: {
				globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
				navigateFallback: "/index.html",
				// Loyalty mutations must never be served from cache or replayed offline.
				navigateFallbackDenylist: [/^\/api\//],
				runtimeCaching: [],
			},
			devOptions: { enabled: false },
		}),
	],
	resolve: {
		alias: {
			"@shared": fileURLToPath(new URL("./shared", import.meta.url)),
			"@worker": fileURLToPath(new URL("./worker", import.meta.url)),
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
});
