import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "vite";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFile(resolve(root, path), "utf8");
const config = JSON.parse(await read("capacitor.config.json"));
assert.equal(config.appId, "app.fivessportsbar.rewards");
assert.equal(config.appName, "Fives Sports Bar Rewards");
assert.equal(config.webDir, "dist-native");
assert.equal(config.server.hostname, "app.fivessportsbar.app");
assert.equal(config.server.androidScheme, "https");
assert.equal(config.server.appStartPath, "/app");
assert.equal(config.server.cleartext, false);
assert.equal(config.server.url, undefined);
assert.equal(config.server.allowNavigation, undefined);
assert.equal(config.android.allowMixedContent, false);
assert.equal(config.android.minWebViewVersion, 111);

const files = await readdir(resolve(root, config.webDir), { recursive: true });
assert(files.includes("index.html"), "Native index.html is missing");
assert(files.some((file) => file.endsWith(".js")), "Native JS assets are missing");
assert(!files.some((file) => /(?:^|[/\\])(sw\.js|registerSW\.js|workbox-[^/\\]+|manifest\.webmanifest)$/.test(file)),
	"Native output must not include PWA assets");
const bundles = await Promise.all(files.filter((file) => /\.(js|html)$/.test(file))
	.map((file) => read(`${config.webDir}/${file}`)));
assert(!bundles.some((text) => /serviceWorker\s*\.\s*register\s*\(|workbox-window|registerSW\.js|manifest\.webmanifest/.test(text)),
	"Native output contains service-worker registration");
const css = (await Promise.all(files.filter((file) => file.endsWith(".css"))
	.map((file) => read(`${config.webDir}/${file}`)))).join("\n");
for (const side of ["top", "right", "bottom", "left"]) {
	assert(css.includes(`--safe-area-inset-${side}`), `Missing native safe-area variable: ${side}`);
	assert(css.includes(`env(safe-area-inset-${side},`), `Missing safe-area fallback: ${side}`);
}

// Exercise the actual platform/API/media modules with the native Vite config.
// This catches wrong mode/env precedence and /api/api duplication without
// contacting production or implementing the later native auth client.
const entry = resolve(root, "scripts/native-build-probe.ts");
const result = await build({
	root,
	configFile: resolve(root, "vite.native.config.ts"),
	mode: "native",
	logLevel: "silent",
	build: {
		write: false,
		minify: false,
		lib: { entry, formats: ["es"], fileName: "native-probe" },
	},
});
const output = (Array.isArray(result) ? result[0] : result).output;
const chunk = output.find((item) => item.type === "chunk" && item.isEntry);
assert(chunk, "Native probe did not compile");
const probe = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString("base64")}`);
assert.equal(probe.APP_TARGET, "native");
assert.equal(probe.IS_NATIVE, true);
assert.equal(probe.buildPasswordResetRedirectUrl(), "https://fivessportsbar.app/reset-password");
assert.equal(probe.menuMediaObjectUrl("test"), "https://fivessportsbar.app/api/media/public/menu?key=test");
const originalFetch = globalThis.fetch;
try {
	globalThis.fetch = async (url) => {
		assert.equal(url, "https://fivessportsbar.app/api/me");
		return new Response(JSON.stringify({ success: true, data: { checked: true } }));
	};
	assert.deepEqual(await probe.apiFetch("/api/me"), { checked: true });
} finally {
	globalThis.fetch = originalFetch;
}
console.log("Native build checks passed: identity, local bundle, no PWA registration, safe areas, native target and production API origin.");
