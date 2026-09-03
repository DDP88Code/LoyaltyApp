export type MenuGroup = "food" | "drinks";

export interface AdminMenuCategory {
	id: string;
	businessId: string;
	name: string;
	description: string | null;
	menuGroup: MenuGroup;
	imageKey: string | null;
	sortOrder: number;
	active: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface AdminMenuItemVariant {
	id: string;
	menuItemId: string;
	name: string;
	priceCents: number;
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
	optionNotes: string;
	priceCents: number;
	imageKey: string | null;
	active: boolean;
	available: boolean;
	popular: boolean;
	vegetarian: boolean;
	spicy: boolean;
	isNew: boolean;
	subjectToAvailability: boolean;
	variants: AdminMenuItemVariant[];
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