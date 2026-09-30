CREATE TABLE `bill_events` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`location_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`staff_id` text,
	`source` text DEFAULT 'staff_manual' NOT NULL,
	`bill_total_cents` integer NOT NULL,
	`campaign_spend_cents` integer DEFAULT 0 NOT NULL,
	`excluded_campaign_spend_cents` integer DEFAULT 0 NOT NULL,
	`other_excluded_spend_cents` integer DEFAULT 0 NOT NULL,
	`eligible_spend_cents` integer DEFAULT 0 NOT NULL,
	`total_points` integer DEFAULT 0 NOT NULL,
	`bill_reference` text NOT NULL,
	`bill_reference_key` text NOT NULL,
	`business_day` text NOT NULL,
	`dedupe_guard_key` text,
	`released_guard_key` text,
	`duplicate_override` integer DEFAULT false NOT NULL,
	`duplicate_override_reason` text,
	`duplicate_override_by` text,
	`request_idempotency_key` text NOT NULL,
	`rewards_settled_at` integer,
	`reversed_at` integer,
	`reversed_by` text,
	`reversal_reason` text,
	`calculation_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`staff_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`duplicate_override_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reversed_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "bill_events_total_positive_chk" CHECK("bill_events"."bill_total_cents" > 0),
	CONSTRAINT "bill_events_non_negative_chk" CHECK("bill_events"."campaign_spend_cents" >= 0 AND "bill_events"."excluded_campaign_spend_cents" >= 0 AND "bill_events"."other_excluded_spend_cents" >= 0 AND "bill_events"."eligible_spend_cents" >= 0),
	CONSTRAINT "bill_events_spend_balance_chk" CHECK("bill_events"."campaign_spend_cents" + "bill_events"."other_excluded_spend_cents" <= "bill_events"."bill_total_cents"),
	CONSTRAINT "bill_events_override_chk" CHECK("bill_events"."duplicate_override" = 0 OR ("bill_events"."duplicate_override_reason" IS NOT NULL AND "bill_events"."duplicate_override_by" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bill_events_dedupe_guard_unq` ON `bill_events` (`dedupe_guard_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `bill_events_request_idem_unq` ON `bill_events` (`business_id`,`request_idempotency_key`);--> statement-breakpoint
CREATE INDEX `bill_events_customer_created_idx` ON `bill_events` (`customer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `bill_events_business_created_idx` ON `bill_events` (`business_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `bill_events_location_day_idx` ON `bill_events` (`location_id`,`business_day`);--> statement-breakpoint
CREATE INDEX `bill_events_staff_idx` ON `bill_events` (`staff_id`);--> statement-breakpoint
CREATE INDEX `bill_events_settlement_idx` ON `bill_events` (`rewards_settled_at`);--> statement-breakpoint
CREATE TABLE `item_campaign_reward_issuances` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`cycle_index` integer NOT NULL,
	`active_cycle_key` text,
	`released_cycle_key` text,
	`customer_reward_id` text NOT NULL,
	`bill_event_id` text NOT NULL,
	`issued_at` integer NOT NULL,
	`cancelled_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `item_campaigns`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_reward_id`) REFERENCES `customer_rewards`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`bill_event_id`) REFERENCES `bill_events`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "item_campaign_issuance_cycle_positive_chk" CHECK("item_campaign_reward_issuances"."cycle_index" > 0),
	CONSTRAINT "item_campaign_issuance_release_chk" CHECK(("item_campaign_reward_issuances"."active_cycle_key" IS NULL AND "item_campaign_reward_issuances"."cancelled_at" IS NOT NULL AND "item_campaign_reward_issuances"."released_cycle_key" IS NOT NULL) OR ("item_campaign_reward_issuances"."active_cycle_key" IS NOT NULL AND "item_campaign_reward_issuances"."cancelled_at" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_campaign_issuance_cycle_unq` ON `item_campaign_reward_issuances` (`active_cycle_key`);--> statement-breakpoint
CREATE INDEX `item_campaign_issuance_customer_idx` ON `item_campaign_reward_issuances` (`campaign_id`,`customer_id`,`cycle_index`);--> statement-breakpoint
CREATE INDEX `item_campaign_issuance_bill_idx` ON `item_campaign_reward_issuances` (`bill_event_id`);--> statement-breakpoint
CREATE INDEX `item_campaign_issuance_reward_idx` ON `item_campaign_reward_issuances` (`customer_reward_id`);--> statement-breakpoint
CREATE TABLE `item_campaign_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`location_id` text NOT NULL,
	`staff_id` text,
	`bill_event_id` text NOT NULL,
	`transaction_type` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`campaign_spend_cents` integer NOT NULL,
	`earns_reward_points` integer NOT NULL,
	`campaign_name_snapshot` text NOT NULL,
	`item_reference_snapshot` text NOT NULL,
	`bill_reference` text,
	`reason` text,
	`approved_by` text,
	`idempotency_key` text NOT NULL,
	`related_transaction_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `item_campaigns`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`staff_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`bill_event_id`) REFERENCES `bill_events`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`approved_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "item_campaign_tx_qty_non_zero_chk" CHECK("item_campaign_transactions"."quantity" <> 0),
	CONSTRAINT "item_campaign_tx_price_non_negative_chk" CHECK("item_campaign_transactions"."unit_price_cents" >= 0),
	CONSTRAINT "item_campaign_tx_type_qty_chk" CHECK(("item_campaign_transactions"."transaction_type" = 'purchase' AND "item_campaign_transactions"."quantity" > 0) OR ("item_campaign_transactions"."transaction_type" = 'reversal' AND "item_campaign_transactions"."quantity" < 0) OR "item_campaign_transactions"."transaction_type" = 'adjustment'),
	CONSTRAINT "item_campaign_tx_spend_formula_chk" CHECK("item_campaign_transactions"."campaign_spend_cents" = ("item_campaign_transactions"."quantity" * "item_campaign_transactions"."unit_price_cents"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_campaign_tx_idem_unq` ON `item_campaign_transactions` (`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `item_campaign_tx_bill_campaign_type_unq` ON `item_campaign_transactions` (`bill_event_id`,`campaign_id`,`transaction_type`);--> statement-breakpoint
CREATE INDEX `item_campaign_tx_progress_idx` ON `item_campaign_transactions` (`customer_id`,`campaign_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `item_campaign_tx_campaign_created_idx` ON `item_campaign_transactions` (`campaign_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `item_campaign_tx_business_created_idx` ON `item_campaign_transactions` (`business_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `item_campaign_tx_bill_idx` ON `item_campaign_transactions` (`bill_event_id`);--> statement-breakpoint
CREATE TABLE `item_campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`item_reference` text NOT NULL,
	`item_reference_key` text NOT NULL,
	`active_item_key` text,
	`unit_price_cents` integer NOT NULL,
	`target_quantity` integer NOT NULL,
	`reward_definition_id` text NOT NULL,
	`earns_reward_points` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`start_at` integer,
	`end_at` integer,
	`max_quantity_per_bill` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reward_definition_id`) REFERENCES `reward_definitions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "item_campaigns_price_chk" CHECK("item_campaigns"."unit_price_cents" > 0),
	CONSTRAINT "item_campaigns_target_chk" CHECK("item_campaigns"."target_quantity" >= 2 AND "item_campaigns"."target_quantity" <= 1000),
	CONSTRAINT "item_campaigns_max_qty_chk" CHECK("item_campaigns"."max_quantity_per_bill" IS NULL OR ("item_campaigns"."max_quantity_per_bill" > 0 AND "item_campaigns"."max_quantity_per_bill" <= 500)),
	CONSTRAINT "item_campaigns_window_chk" CHECK("item_campaigns"."start_at" IS NULL OR "item_campaigns"."end_at" IS NULL OR "item_campaigns"."end_at" > "item_campaigns"."start_at"),
	CONSTRAINT "item_campaigns_archive_chk" CHECK(("item_campaigns"."status" = 'archived' AND "item_campaigns"."archived_at" IS NOT NULL AND "item_campaigns"."active_item_key" IS NULL) OR ("item_campaigns"."status" <> 'archived' AND "item_campaigns"."archived_at" IS NULL AND "item_campaigns"."active_item_key" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `item_campaigns_active_item_unq` ON `item_campaigns` (`business_id`,`active_item_key`);--> statement-breakpoint
CREATE INDEX `item_campaigns_listing_idx` ON `item_campaigns` (`business_id`,`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `item_campaigns_reward_idx` ON `item_campaigns` (`reward_definition_id`);--> statement-breakpoint
ALTER TABLE `points_awards` ADD `bill_event_id` text REFERENCES bill_events(id);--> statement-breakpoint
INSERT INTO `bill_events` (
	`id`,
	`business_id`,
	`location_id`,
	`customer_id`,
	`staff_id`,
	`source`,
	`bill_total_cents`,
	`campaign_spend_cents`,
	`excluded_campaign_spend_cents`,
	`other_excluded_spend_cents`,
	`eligible_spend_cents`,
	`total_points`,
	`bill_reference`,
	`bill_reference_key`,
	`business_day`,
	`dedupe_guard_key`,
	`released_guard_key`,
	`duplicate_override`,
	`duplicate_override_reason`,
	`duplicate_override_by`,
	`request_idempotency_key`,
	`rewards_settled_at`,
	`reversed_at`,
	`reversed_by`,
	`reversal_reason`,
	`calculation_json`,
	`created_at`
)
SELECT
	`id` || ':bill',
	`business_id`,
	`location_id`,
	`customer_id`,
	`staff_id`,
	`source`,
	`eligible_spend_cents`,
	0,
	0,
	0,
	`eligible_spend_cents`,
	`total_points`,
	`bill_reference`,
	`bill_reference_key`,
	`business_day`,
	`dedupe_guard_key`,
	`released_guard_key`,
	`duplicate_override`,
	`duplicate_override_reason`,
	`duplicate_override_by`,
	'legacy-award:' || `id`,
	`created_at`,
	`reversed_at`,
	`reversed_by`,
	`reversal_reason`,
	`calculation_json`,
	`created_at`
FROM `points_awards`
WHERE `bill_event_id` IS NULL;--> statement-breakpoint
UPDATE `points_awards`
SET `bill_event_id` = `id` || ':bill'
WHERE `bill_event_id` IS NULL;--> statement-breakpoint
CREATE INDEX `points_awards_bill_event_idx` ON `points_awards` (`bill_event_id`);