import assert from "node:assert/strict";
import { resolve } from "node:path";
import { build } from "vite";

const root = resolve(import.meta.dirname, "..");
const mock = resolve(root, "scripts/fixtures/native-auth-mocks.mjs");
const originalFetch = globalThis.fetch;
const user = { id: "test-user", role: "customer" };
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
	status, headers: { "Content-Type": "application/json", ...headers },
});

try {
	for (const native of [true, false]) {
		const requests = [];
		let mode = "success";
		const state = globalThis.nativeAuthTest = {
			native: true, token: "fixture-session", reads: 0, writes: 0, removes: 0,
			queryClient: {
				fetchQuery: ({ queryFn }) => queryFn(),
				setQueryData: (_key, value) => { state.session = value; },
				invalidateQueries() {},
			},
		};
		globalThis.fetch = async (url, init) => {
			const path = new URL(url).pathname;
			const headers = new Headers(init.headers);
			assert.equal(init.credentials, native ? "omit" : "include");
			assert.equal(headers.get("Authorization"), native && state.token ? `Bearer ${state.token}` : null);
			requests.push({ path, headers });
			if (mode === "network-error") throw new TypeError("Simulated offline");
			if (path.includes("/api/auth/")) {
				if (mode === "auth-error") return json({ message: "Invalid credentials" }, 401);
				return json({ user }, 200, path.endsWith("/sign-out") ? {} : { "set-auth-token": "fixture-new-session" });
			}
			if (mode === "expired") return json({ success: false, error: { code: "unauthenticated", message: "Signed out" } }, 401);
			return json({ success: true, data: { user } });
		};
		const result = await build({
			root, configFile: false, logLevel: "silent",
			define: {
				"import.meta.env.VITE_APP_TARGET": JSON.stringify(native ? "native" : "web"),
				"import.meta.env.VITE_API_BASE_URL": JSON.stringify("https://api.example.test"),
			},
			resolve: { alias: {
				"@capacitor/core": mock,
				"@aparajita/capacitor-secure-storage": mock,
				"@tanstack/react-query": mock,
				"@": resolve(root, "src"), "@shared": resolve(root, "shared"),
			} },
			build: {
				write: false, minify: false,
				lib: { entry: resolve(root, "scripts/native-auth-client-probe.ts"), formats: ["es"] },
				rolldownOptions: { output: { codeSplitting: false } },
			},
		});
		const output = (Array.isArray(result) ? result[0] : result).output;
		const chunk = output.find((item) => item.type === "chunk" && item.isEntry);
		const probe = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString("base64")}`);

		// Startup restores the secure token; header formats and form uploads survive.
		assert.deepEqual(await probe.apiFetch("/api/me", { headers: new Headers({ "X-Test": "preserved" }) }), { user });
		assert.equal(requests.at(-1).headers.get("X-Test"), "preserved");
		await probe.apiFetch("/api/customer/profile", { method: "POST", body: new FormData(), headers: [["X-Test", "tuple"]] });
		assert.equal(requests.at(-1).headers.get("Content-Type"), null);
		assert.equal(requests.at(-1).headers.get("X-Test"), "tuple");
		if (native) await probe.apiFetch("/api/me", { credentials: "include" });

		const signIn = probe.useSignIn();
		assert.deepEqual(await signIn.mutationFn({ email: "test@example.test", password: "fixture-password", turnstileToken: "fixture-turnstile" }), user);
		assert.equal(requests.find((r) => r.path.endsWith("/sign-in/email")).headers.get("cf-turnstile-response"), "fixture-turnstile");
		assert.equal(state.token, native ? "fixture-new-session" : "fixture-session");
		assert.deepEqual(await probe.useRegister().mutationFn({ email: "test@example.test", password: "fixture-password", name: "Test", mobileNumber: "0123456789" }), user);
		await probe.useChangePassword().mutationFn({ currentPassword: "fixture-password", newPassword: "fixture-next-password" });
		assert.equal(requests.at(-1).path, "/api/auth/change-password");

		mode = "auth-error";
		const writes = state.writes;
		await assert.rejects(signIn.mutationFn({ email: "test@example.test", password: "wrong" }), /Invalid credentials/);
		assert.equal(state.writes, writes);
		mode = "success";
		await probe.useSignOut().mutationFn();
		assert.equal(state.token, native ? null : "fixture-session");
		await signIn.mutationFn({ email: "test@example.test", password: "fixture-password" });
		mode = "network-error";
		await assert.rejects(probe.useSignOut().mutationFn(), /Simulated offline/);
		assert.equal(state.token, native ? null : "fixture-session");
		mode = "expired";
		state.token = "fixture-expired";
		assert.equal(await probe.useSession().queryFn(), null);
		assert.equal(state.token, native ? null : "fixture-expired");
		mode = "success";
		state.token = "fixture-delete";
		const deletion = probe.useDeleteAccount();
		await deletion.mutationFn();
		await deletion.onSuccess();
		assert.equal(state.token, native ? null : "fixture-delete");
		assert.equal(state.session, null);

		if (native) {
			state.failWrite = true;
			await assert.rejects(signIn.mutationFn({ email: "test@example.test", password: "fixture-password" }), /Could not save/);
			state.failWrite = false;
			state.failRead = true;
			const count = requests.length;
			await assert.rejects(probe.apiFetch("/api/me"), /Could not read/);
			assert.equal(requests.length, count);
			state.failRead = false;
			state.native = false;
			await assert.rejects(probe.setNativeAuthToken("fixture-blocked"), /Could not save/);
		} else {
			assert.equal(state.reads + state.writes + state.removes, 0, "Web must never access token storage");
		}
		console.log(`${native ? "Native" : "Web"} auth client checks passed.`);
	}
} finally {
	globalThis.fetch = originalFetch;
	delete globalThis.nativeAuthTest;
}
