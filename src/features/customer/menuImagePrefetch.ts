import type { CustomerMenuPayload } from "@shared/loyalty";
import { menuMediaObjectUrl } from "@/lib/media";

type MenuImagePrefetchOptions = {
	preferredCategoryId?: string;
	priorityCount?: number;
};

type IdleDeadlineLike = {
	didTimeout: boolean;
	timeRemaining: () => number;
};

const prefetchedMenuUrls = new Set<string>();

function isFoodCategory(category: CustomerMenuPayload["categories"][number]): boolean {
	return category.menuGroup === "food";
}

function toCategoryImageUrls(category: CustomerMenuPayload["categories"][number]): string[] {
	return category.items
		.map((item) => item.imageKey)
		.filter((imageKey): imageKey is string => Boolean(imageKey))
		.map((imageKey) => menuMediaObjectUrl(imageKey));
}

function warmImage(url: string, priority: "high" | "low") {
	if (prefetchedMenuUrls.has(url)) return;
	prefetchedMenuUrls.add(url);

	const image = new Image();
	image.decoding = "async";
	if ("fetchPriority" in image) {
		(image as HTMLImageElement & { fetchPriority: "high" | "low" | "auto" }).fetchPriority =
			priority;
	}
	image.src = url;
}

function requestIdle(task: () => void) {
	if (typeof window === "undefined") return;
	if (typeof window.requestIdleCallback === "function") {
		window.requestIdleCallback(task, { timeout: 1_500 });
		return;
	}
	window.setTimeout(task, 300);
}

function preferredCategory(
	menuData: CustomerMenuPayload,
	preferredCategoryId?: string,
) {
	if (preferredCategoryId) {
		const match = menuData.categories.find(
			(category) => category.id === preferredCategoryId,
		);
		if (match) return match;
	}
	return (
		menuData.categories.find((category) => isFoodCategory(category)) ??
		menuData.categories[0] ??
		null
	);
}

export function prefetchMenuImages(
	menuData: CustomerMenuPayload,
	options: MenuImagePrefetchOptions = {},
) {
	const priorityCount = options.priorityCount ?? 4;
	if (priorityCount <= 0) return;

	const firstCategory = preferredCategory(menuData, options.preferredCategoryId);
	const highPriorityUrls = firstCategory
		? toCategoryImageUrls(firstCategory).slice(0, priorityCount)
		: [];

	for (const url of highPriorityUrls) {
		warmImage(url, "high");
	}

	const queued = new Set(highPriorityUrls);
	const remainingUrls: string[] = [];
	for (const category of menuData.categories) {
		for (const url of toCategoryImageUrls(category)) {
			if (queued.has(url)) continue;
			queued.add(url);
			remainingUrls.push(url);
		}
	}

	if (remainingUrls.length === 0) return;

	const queue = [...remainingUrls];
	const drain = (deadline?: IdleDeadlineLike) => {
		let budget = deadline ? Math.max(1, Math.floor(deadline.timeRemaining() / 5)) : 2;
		while (queue.length > 0 && budget > 0) {
			const next = queue.shift();
			if (next) warmImage(next, "low");
			budget -= 1;
		}
		if (queue.length > 0) {
			requestIdle(() => drain());
		}
	};

	requestIdle(() => drain());
}
