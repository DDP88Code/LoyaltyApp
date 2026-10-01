import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Deliberately independent of the web config: no Worker or PWA build plugins.
export default defineConfig({
	plugins: [react(), tailwindcss()],
	define: {
		"import.meta.env.VITE_APP_TARGET": JSON.stringify("native"),
		// API helpers already include /api in their paths. This must be an origin.
		"import.meta.env.VITE_API_BASE_URL": JSON.stringify("https://fivessportsbar.app"),
	},
	resolve: {
		alias: {
			// Exclude the registration module entirely, including its virtual PWA import.
			"@/lib/registerPwa": fileURLToPath(new URL("./src/lib/registerPwa.native.ts", import.meta.url)),
			"@shared": fileURLToPath(new URL("./shared", import.meta.url)),
			"@worker": fileURLToPath(new URL("./worker", import.meta.url)),
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	build: {
		outDir: "dist-native",
		target: "chrome111",
	},
});
