import { clientsClaim } from "workbox-core";
import {
	cleanupOutdatedCaches,
	createHandlerBoundToURL,
	precacheAndRoute,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
	new NavigationRoute(createHandlerBoundToURL("/index.html"), {
		denylist: [/^\/api\//],
	}),
);

const DEFAULT_CLICK_URL = "/app/notifications";
const DEFAULT_TITLE = "Fives Rewards";
const DEFAULT_BODY = "You have a new account update.";

function toNotificationShape(value) {
	if (!value || typeof value !== "object") return null;

	const title = typeof value.title === "string" ? value.title : DEFAULT_TITLE;
	const message = typeof value.message === "string" ? value.message : DEFAULT_BODY;
	const actionUrl =
		typeof value.actionUrl === "string" && value.actionUrl.trim().length > 0
			? value.actionUrl
			: DEFAULT_CLICK_URL;
	const id = typeof value.id === "string" ? value.id : null;

	return {
		title,
		message,
		actionUrl,
		id,
	};
}

async function fetchLatestUnreadNotification() {
	try {
		const response = await fetch("/api/customer/notifications/latest-unread", {
			headers: { Accept: "application/json" },
			credentials: "include",
		});
		if (!response.ok) return null;

		const payload = await response.json();
		if (!payload || payload.success !== true) return null;

		return toNotificationShape(payload.data?.notification);
	} catch {
		return null;
	}
}

async function resolvePushNotification(event) {
	if (event.data) {
		try {
			const parsed = event.data.json();
			const normalized = toNotificationShape(parsed);
			if (normalized) return normalized;
		} catch {
			try {
				const text = event.data.text();
				if (text && text.trim().length > 0) {
					return {
						title: DEFAULT_TITLE,
						message: text,
						actionUrl: DEFAULT_CLICK_URL,
						id: null,
					};
				}
			} catch {
				// Intentionally ignored.
			}
		}
	}

	return fetchLatestUnreadNotification();
}

self.addEventListener("push", (event) => {
	event.waitUntil(
		(async () => {
			const latest = await resolvePushNotification(event);
			const title = latest?.title ?? DEFAULT_TITLE;
			const body = latest?.message ?? DEFAULT_BODY;
			const url = latest?.actionUrl ?? DEFAULT_CLICK_URL;

			await self.registration.showNotification(title, {
				body,
				icon: "/icons/icon-192.png",
				badge: "/icons/icon-192.png",
				tag: latest?.id ? `fives:${latest.id}` : undefined,
				data: { url },
				renotify: false,
			});
		})(),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	event.waitUntil(
		(async () => {
			const rawUrl =
				typeof event.notification.data?.url === "string"
					? event.notification.data.url
					: DEFAULT_CLICK_URL;
			const target = new URL(rawUrl, self.location.origin).toString();
			const windows = await self.clients.matchAll({
				type: "window",
				includeUncontrolled: true,
			});

			for (const client of windows) {
				const url = new URL(client.url);
				if (url.origin !== self.location.origin) continue;

				await client.focus();
				if ("navigate" in client) {
					await client.navigate(target);
				}
				return;
			}

			if (self.clients.openWindow) {
				await self.clients.openWindow(target);
			}
		})(),
	);
});
