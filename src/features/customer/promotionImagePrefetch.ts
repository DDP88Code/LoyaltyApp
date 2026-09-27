import type { PromotionSummary } from "@shared/loyalty";
import { promotionMediaObjectUrl } from "@/lib/media";

type IdleDeadlineLike = {
	didTimeout: boolean;
	timeRemaining: () => number;
};

type PromotionImagePrefetchOptions = {
	priorityCount?: number;
};

const prefetchedPromotionUrls = new Set<string>();

function warmImage(url: string, priority: "high" | "low") {
	if (prefetchedPromotionUrls.has(url)) return;
	prefetchedPromotionUrls.add(url);

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

function toPromotionImageUrls(promotions: PromotionSummary[]): string[] {
	return promotions
		.map((promotion) => promotion.imageKey)
		.filter((imageKey): imageKey is string => Boolean(imageKey))
		.map((imageKey) => promotionMediaObjectUrl(imageKey));
}

export function prefetchPromotionImages(
	promotions: PromotionSummary[],
	options: PromotionImagePrefetchOptions = {},
) {
	const priorityCount = options.priorityCount ?? 1;
	if (priorityCount <= 0 || promotions.length === 0) return;

	const allUrls = toPromotionImageUrls(promotions);
	if (allUrls.length === 0) return;

	const highPriorityUrls = allUrls.slice(0, priorityCount);
	for (const url of highPriorityUrls) {
		warmImage(url, "high");
	}

	const queue = allUrls.slice(priorityCount);
	if (queue.length === 0) return;

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
