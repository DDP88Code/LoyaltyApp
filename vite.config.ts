import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";
import { BRAND } from "./shared/branding";

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		cloudflare(),
		VitePWA({
			strategies: "injectManifest",
			srcDir: "src",
			filename: "sw.js",
			registerType: "autoUpdate",
			includeAssets: ["favicon.svg", BRAND.assets.icons.appleTouch.slice(1)],
			manifest: {
				id: "/",
				name: BRAND.rewardsName,
				short_name: BRAND.shortName,
				description: `Loyalty rewards for ${BRAND.fullName}.`,
				lang: "en-ZA",
				dir: "ltr",
				start_url: "/",
				scope: "/",
				display: "standalone",
				display_override: ["standalone", "browser"],
				orientation: "portrait",
				background_color: BRAND.colors.background,
				theme_color: BRAND.colors.background,
				categories: ["food", "lifestyle"],
				icons: [
					{ src: BRAND.assets.icons.app192, sizes: "192x192", type: "image/png" },
					{ src: BRAND.assets.icons.app512, sizes: "512x512", type: "image/png" },
					{
						src: BRAND.assets.icons.app512Maskable,
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
			injectManifest: {
				globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
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
