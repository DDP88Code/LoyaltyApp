import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { build } from "vite";

const root = resolve(import.meta.dirname, "..");
const fixture = (name) => resolve(root, `scripts/fixtures/${name}.mjs`);
const originalFetch = globalThis.fetch;
const require = createRequire(import.meta.url);
const homes = { customer: "/app", staff: "/staff", admin: "/admin", owner: "/admin" };
const gateTitle = "Use the Fives web portal";
try {
	for (const native of [true, false]) {
		let serverRole = "customer";
		const revoked = new Set();
		const requests = [];
		const state = globalThis.nativeRoutingTest = { session: {}, redirects: [], actions: {} };
		const storage = globalThis.nativeAuthTest = {
			native: true, token: "fixture-native-session", reads: 0, writes: 0, removes: 0,
			queryClient: {
				setQueryData(_key, user) { state.session = { data: user }; },
				invalidateQueries() {},
			},
		};
		globalThis.fetch = async (url, init) => {
			const path = new URL(url).pathname;
			const authorization = new Headers(init.headers).get("Authorization");
			requests.push({ path, credentials: init.credentials, authorization });
			if (path === "/api/auth/sign-out") {
				assert.equal(init.credentials, native ? "omit" : "include");
				assert.equal(authorization, native ? `Bearer ${storage.token}` : null);
				if (authorization) revoked.add(authorization);
				return Response.json({ success: true });
			}
			if (native && (!authorization || revoked.has(authorization))) {
				return Response.json({ success: false, error: { code: "unauthenticated", message: "Signed out" } }, { status: 401 });
			}
			return Response.json({ success: true, data: { user: { id: "fixture-user", role: serverRole } } });
		};
		const result = await build({
			root, configFile: false, logLevel: "silent",
			plugins: [{
				name: "node-react-renderer",
				enforce: "pre",
				resolveId(id) {
					if (["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom", "react-dom/server"].includes(id)) {
						return { id: pathToFileURL(require.resolve(id)).href, external: true };
					}
				},
			}],
			define: {
				"import.meta.env.VITE_APP_TARGET": JSON.stringify(native ? "native" : "web"),
				"import.meta.env.VITE_API_BASE_URL": JSON.stringify("https://api.example.test"),
			},
			resolve: { alias: {
				"@capacitor/core": fixture("native-auth-mocks"),
				"@aparajita/capacitor-secure-storage": fixture("native-auth-mocks"),
				"@tanstack/react-query": fixture("native-routing-query"),
				"react-router": fixture("native-routing-router"),
				"@/components/ui/Button": fixture("native-routing-button"),
				"@": resolve(root, "src"), "@shared": resolve(root, "shared"),
			} },
			build: {
				write: false, minify: false,
				lib: { entry: resolve(root, "scripts/native-routing-probe.tsx"), formats: ["es"] },
				rolldownOptions: { output: { codeSplitting: false } },
			},
		});
		const output = (Array.isArray(result) ? result[0] : result).output;
		const chunk = output.find((item) => item.type === "chunk" && item.isEntry);
		const probe = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString("base64")}`);
		const render = (path) => { state.redirects = []; state.actions = {}; return probe.renderRoute(path); };
		for (const [role, webHome] of Object.entries(homes)) {
			serverRole = role;
			storage.token = `fixture-${role}-session`;
			state.session = { isPending: true };
			assert.match(render("/app"), /Checking your session/);
			// Restore through the real session query and secure token client.
			state.session = { data: await state.sessionQuery() };
			const blocked = native && role !== "customer";
			const expectedHome = blocked ? "/app" : webHome;
			assert.equal(probe.signedInDestination(role), expectedHome);
			assert.equal(probe.signedInDestination(role, "/admin/settings"), blocked ? "/app" : "/admin/settings");
			render("/login");
			assert.deepEqual(state.redirects, [expectedHome]);
			for (const path of ["/app", "/app/profile", "/staff", "/admin", "/admin/settings", "/admin/owner", "/admin/unknown"]) {
				const html = render(path + "?token=fixture-query-token#fixture-fragment");
				if (blocked) {
					assert(html.includes(gateTitle), `${role} must be gated at ${path}`);
					assert(!html.includes("data-page="), "A protected feature screen mounted");
					assert(html.includes('href="https://fivessportsbar.app/login"'));
					assert(html.includes('referrerPolicy="no-referrer"'));
					assert(!html.includes("fixture-"), "Portal screen must not contain session or navigation data");
				} else {
					assert(!html.includes(gateTitle), "Web/customer routing changed");
					const allowed = path.startsWith("/app") ? role === "customer"
						: path === "/staff" ? role !== "customer"
							: role === "admin" || role === "owner";
					if (!allowed) {
						assert.deepEqual(state.redirects, [webHome]);
						assert(!html.includes("data-page="));
					} else if (["/admin/owner", "/admin/unknown"].includes(path)) {
						assert.deepEqual(state.redirects, ["/admin"]);
					} else {
						assert(html.includes(`data-page="${path}"`));
						assert.deepEqual(state.redirects, []);
					}
				}
			}
			if (role === "customer") assert(render("/app").includes('data-page="/app"'));
			if (!native && role !== "customer") assert(render(webHome).includes(`data-page="${webHome}"`));
			if (blocked) {
				render("/app");
				const oldAuthorization = `Bearer ${storage.token}`;
				await state.actions["Sign Out"]();
				assert.equal(requests.at(-1).path, "/api/auth/sign-out");
				assert(revoked.has(oldAuthorization), "Gate must request server revocation");
				assert.equal(storage.token, null);
				render("/app");
				assert.deepEqual(state.redirects, ["/login"]);
				assert.equal((await fetch("https://api.example.test/api/me", { credentials: "omit", headers: { Authorization: oldAuthorization } })).status, 401);
			}
		}
		state.session = { data: null };
		for (const path of ["/login", "/register"]) assert(render(path).includes(`data-page="${path}"`));
		for (const path of ["/app", "/staff", "/admin/settings"]) {
			render(path);
			assert.deepEqual(state.redirects, ["/login"]);
		}
		if (!native) assert.equal(storage.reads + storage.writes + storage.removes, 0);
		console.log(`${native ? "Native" : "Web"} role routing, restored sessions and portal gate checks passed.`);
	}
} finally {
	globalThis.fetch = originalFetch;
	delete globalThis.nativeAuthTest;
	delete globalThis.nativeRoutingTest;
}
