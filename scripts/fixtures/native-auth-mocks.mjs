// Test-only native bridge. Production builds never resolve to this module.
export const Capacitor = { isNativePlatform: () => globalThis.nativeAuthTest.native };
const storage = {
	async get() {
		const state = globalThis.nativeAuthTest;
		state.reads++;
		if (state.failRead) throw new Error("Simulated storage failure");
		return state.token;
	},
	async set(_key, token) {
		const state = globalThis.nativeAuthTest;
		await new Promise((resolve) => setTimeout(resolve, 5));
		if (state.failWrite) throw new Error("Simulated storage failure");
		state.token = token;
		state.writes++;
	},
	async remove() {
		globalThis.nativeAuthTest.token = null;
		globalThis.nativeAuthTest.removes++;
	},
};
export const SecureStorage = new Proxy(storage, {
	get(target, property) {
		if (property === "then") throw new Error("Do not await a Capacitor plugin proxy");
		return target[property];
	},
});

// Exercise mutation/query callbacks without mounting a React UI.
export const useMutation = (options) => options;
export const useQuery = (options) => options;
export const useQueryClient = () => globalThis.nativeAuthTest.queryClient;
