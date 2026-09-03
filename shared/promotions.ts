export interface AdminPromotion {
	id: string;
	businessId: string;
	title: string;
	subtitle: string | null;
	description: string | null;
	imageKey: string | null;
	startAt: string;
	endAt: string;
	active: boolean;
	ctaText: string | null;
	ctaUrl: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface AdminPromotionsPayload {
	promotions: AdminPromotion[];
}

export interface PromotionImageUploadPayload {
	imageKey: string;
	contentType: string;
	sizeBytes: number;
}

export interface PromotionImageDeletePayload {
	deleted: boolean;
}