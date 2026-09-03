export interface AdminMenuCategory {
	id: string;
	businessId: string;
	name: string;
	description: string | null;
	imageKey: string | null;
	sortOrder: number;
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface AdminMenuItem {
	id: string;
	businessId: string;
	categoryId: string;
	name: string;
	description: string;
	priceCents: number;
	imageKey: string | null;
	active: boolean;
	available: boolean;
	popular: boolean;
	vegetarian: boolean;
	spicy: boolean;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

export interface AdminMenuCategoriesPayload {
	categories: AdminMenuCategory[];
}

export interface AdminMenuItemsPayload {
	items: AdminMenuItem[];
}

export interface MenuImageUploadPayload {
	imageKey: string;
	contentType: string;
	sizeBytes: number;
}

export interface MenuImageDeletePayload {
	deleted: boolean;
}