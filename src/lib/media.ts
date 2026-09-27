const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export function mediaObjectUrl(imageKey: string): string {
	return `${BASE_URL}/api/media/object?key=${encodeURIComponent(imageKey)}`;
}

export function menuMediaObjectUrl(imageKey: string): string {
	return `${BASE_URL}/api/media/public/menu?key=${encodeURIComponent(imageKey)}`;
}

export function promotionMediaObjectUrl(imageKey: string): string {
	return `${BASE_URL}/api/media/public/promotions?key=${encodeURIComponent(imageKey)}`;
}