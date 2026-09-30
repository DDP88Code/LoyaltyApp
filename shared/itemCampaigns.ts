export const BILL_EVENT_SOURCES = ["staff_manual", "pos"] as const;
export type BillEventSource = (typeof BILL_EVENT_SOURCES)[number];

export const ITEM_CAMPAIGN_STATUSES = ["active", "disabled", "archived"] as const;
export type ItemCampaignStatus = (typeof ITEM_CAMPAIGN_STATUSES)[number];

export const ITEM_CAMPAIGN_TRANSACTION_TYPES = [
	"purchase",
	"reversal",
	"adjustment",
] as const;
export type ItemCampaignTransactionType =
	(typeof ITEM_CAMPAIGN_TRANSACTION_TYPES)[number];

export function normalizeItemReference(value: string): string {
	return value.trim().toUpperCase().replace(/[\s\-_/.]/g, "");
}
