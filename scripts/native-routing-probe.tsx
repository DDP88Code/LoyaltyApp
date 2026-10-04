import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Navigate, Outlet, useRoutes, type RouteObject } from "react-router";
import { router } from "../src/routes/router";
import { RequireAuth, RequireRole, RedirectIfSignedIn } from "../src/features/auth/guards";
export { signedInDestination } from "../src/features/auth/roleRouting";

// Keep the real route tree and guards. Replace feature screens with markers so
// tests detect whether a protected screen could mount, without business fixtures.
const guards = [RequireAuth, RequireRole, RedirectIfSignedIn, Navigate];
function routesForTest(routes: typeof router.routes): RouteObject[] {
	return routes.map((route) => {
		const element = route.element as { type?: unknown } | undefined;
		return {
			...route,
			element: guards.includes(element?.type as typeof RequireAuth)
				? route.element
				: route.children
					? <Outlet />
					: <span data-page={route.path} />,
			children: route.children ? routesForTest(route.children) : undefined,
		} as RouteObject;
	});
}
function TestRoutes() {
	return useRoutes(routesForTest(router.routes));
}
export function renderRoute(path: string): string {
	return renderToStaticMarkup(
		createElement(MemoryRouter, { initialEntries: [path] }, createElement(TestRoutes)),
	);
}
