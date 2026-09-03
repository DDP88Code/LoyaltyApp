import { ApiError } from "@worker/lib/http";

const MENU_IMAGE_MIME_EXT: Record<string, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
};

export const MENU_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const MENU_MEDIA_PREFIX = "menu";
const PROMOTIONS_MEDIA_PREFIX = "promotions";

export type BusinessMediaCollection =
	| typeof MENU_MEDIA_PREFIX
	| typeof PROMOTIONS_MEDIA_PREFIX;

function businessRootPrefix(businessId: string): string {
	return `biz/${businessId}/`;
}

function mediaPrefixForBusiness(
	businessId: string,
	collection: BusinessMediaCollection,
): string {
	return `${businessRootPrefix(businessId)}${collection}/`;
}

export function assertOwnedBusinessMediaKey(
	businessId: string,
	imageKey: string,
): void {
	const key = imageKey.trim();
	if (!key) throw new ApiError("validation_failed", "Image key is required.");
	if (key.includes("..") || key.includes("\\")) {
		throw new ApiError("validation_failed", "Invalid image key.");
	}
	if (!key.startsWith(businessRootPrefix(businessId))) {
		throw new ApiError(
			"forbidden",
			"That image does not belong to your business.",
		);
	}
}

export function assertOwnedMenuMediaKey(
	businessId: string,
	imageKey: string,
): void {
	assertOwnedBusinessMediaKey(businessId, imageKey);
	if (!imageKey.startsWith(mediaPrefixForBusiness(businessId, MENU_MEDIA_PREFIX))) {
		throw new ApiError(
			"forbidden",
			"That image key is not for menu media.",
		);
	}
}

export function assertOwnedPromotionsMediaKey(
	businessId: string,
	imageKey: string,
): void {
	assertOwnedBusinessMediaKey(businessId, imageKey);
	if (
		!imageKey.startsWith(
			mediaPrefixForBusiness(businessId, PROMOTIONS_MEDIA_PREFIX),
		)
	) {
		throw new ApiError(
			"forbidden",
			"That image key is not for promotions media.",
		);
	}
}

function mediaKeyForBusiness(
	businessId: string,
	collection: BusinessMediaCollection,
	contentType: string,
): string {
	const ext = MENU_IMAGE_MIME_EXT[contentType.toLowerCase()];
	if (!ext) {
		throw new ApiError(
			"validation_failed",
			"Only JPG, PNG, or WEBP images are allowed.",
		);
	}
	return `${mediaPrefixForBusiness(businessId, collection)}${crypto.randomUUID()}.${ext}`;
}

export function validateMenuImage(file: File): void {
	if (!(file instanceof File)) {
		throw new ApiError("validation_failed", "Please choose an image file.");
	}
	if (!MENU_IMAGE_MIME_EXT[file.type.toLowerCase()]) {
		throw new ApiError(
			"validation_failed",
			"Only JPG, PNG, or WEBP images are allowed.",
		);
	}
	if (file.size <= 0) {
		throw new ApiError("validation_failed", "The uploaded file was empty.");
	}
	if (file.size > MENU_IMAGE_MAX_BYTES) {
		throw new ApiError(
			"validation_failed",
			`Image files must be ${Math.floor(MENU_IMAGE_MAX_BYTES / (1024 * 1024))}MB or smaller.`,
		);
	}
}

export async function putMenuImage(
	bucket: R2Bucket,
	businessId: string,
	file: File,
): Promise<{ imageKey: string; contentType: string; sizeBytes: number }> {
	validateMenuImage(file);
	const contentType = file.type.toLowerCase();
	const imageKey = mediaKeyForBusiness(
		businessId,
		MENU_MEDIA_PREFIX,
		contentType,
	);
	await bucket.put(imageKey, await file.arrayBuffer(), {
		httpMetadata: {
			contentType,
			cacheControl: "private, max-age=86400",
		},
	});
	return { imageKey, contentType, sizeBytes: file.size };
}

export async function putPromotionImage(
	bucket: R2Bucket,
	businessId: string,
	file: File,
): Promise<{ imageKey: string; contentType: string; sizeBytes: number }> {
	validateMenuImage(file);
	const contentType = file.type.toLowerCase();
	const imageKey = mediaKeyForBusiness(
		businessId,
		PROMOTIONS_MEDIA_PREFIX,
		contentType,
	);
	await bucket.put(imageKey, await file.arrayBuffer(), {
		httpMetadata: {
			contentType,
			cacheControl: "private, max-age=86400",
		},
	});
	return { imageKey, contentType, sizeBytes: file.size };
}

export async function deleteMenuImageSafe(
	bucket: R2Bucket,
	imageKey: string | null,
): Promise<void> {
	if (!imageKey) return;
	try {
		await bucket.delete(imageKey);
	} catch (error) {
		console.error("Failed to delete menu media object", { imageKey, error });
	}
}