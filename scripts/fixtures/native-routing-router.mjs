// Use real matching/outlets in SSR, capturing browser creation and redirects.
export * from "../../node_modules/react-router/dist/development/index.mjs";
export const createBrowserRouter = (routes) => ({ routes });
export function Navigate({ to }) {
	globalThis.nativeRoutingTest.redirects.push(to);
	return null;
}
