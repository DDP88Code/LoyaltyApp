CREATE TABLE `points_promotions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`promotion_type` text NOT NULL,
	`multiplier_bp` integer,
	`fixed_bonus_points` integer,
	`min_eligible_spend_cents` integer,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "points_promotions_window_chk" CHECK("points_promotions"."end_at" > "points_promotions"."start_at"),
	CONSTRAINT "points_promotions_multiplier_chk" CHECK("points_promotions"."promotion_type" <> 'multiplier' OR ("points_promotions"."multiplier_bp" IS NOT NULL AND "points_promotions"."multiplier_bp" > 10000)),
	CONSTRAINT "points_promotions_bonus_chk" CHECK("points_promotions"."promotion_type" <> 'fixed_bonus' OR ("points_promotions"."fixed_bonus_points" IS NOT NULL AND "points_promotions"."fixed_bonus_points" > 0)),
	CONSTRAINT "points_promotions_min_spend_chk" CHECK("points_promotions"."min_eligible_spend_cents" IS NULL OR "points_promotions"."min_eligible_spend_cents" >= 0)
);
--> statement-breakpoint
CREATE INDEX `points_promotions_window_idx` ON `points_promotions` (`business_id`,`enabled`,`start_at`,`end_at`);
--> statement-breakpoint
CREATE INDEX `points_promotions_archived_idx` ON `points_promotions` (`business_id`,`archived_at`);
--> statement-breakpoint

CREATE TABLE `points_awards` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`program_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`location_id` text NOT NULL,
	`staff_id` text,
	`source` text DEFAULT 'staff_manual' NOT NULL,
	`eligible_spend_cents` integer NOT NULL,
	`rate_points` integer NOT NULL,
	`rate_spend_cents` integer NOT NULL,
	`base_points` integer NOT NULL,
	`bonus_points` integer DEFAULT 0 NOT NULL,
	`total_points` integer NOT NULL,
	`multiplier_promotion_id` text,
	`multiplier_promotion_name` text,
	`applied_multiplier_bp` integer,
	`bonus_promotion_id` text,
	`bonus_promotion_name` text,
	`applied_fixed_bonus_points` integer,
	`bill_reference` text NOT NULL,
	`bill_reference_key` text NOT NULL,
	`business_day` text NOT NULL,
	`dedupe_guard_key` text,
	`released_guard_key` text,
	`duplicate_override` integer DEFAULT false NOT NULL,
	`duplicate_override_reason` text,
	`duplicate_override_by` text,
	`request_idempotency_key` text NOT NULL,
	`reversed_at` integer,
	`reversed_by` text,
	`reversal_reason` text,
	`calculation_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_id`) REFERENCES `loyalty_programs`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`staff_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`multiplier_promotion_id`) REFERENCES `points_promotions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`bonus_promotion_id`) REFERENCES `points_promotions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`duplicate_override_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reversed_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "points_awards_total_chk" CHECK("points_awards"."total_points" = "points_awards"."base_points" + "points_awards"."bonus_points"),
	CONSTRAINT "points_awards_positive_chk" CHECK("points_awards"."eligible_spend_cents" > 0 AND "points_awards"."rate_points" > 0 AND "points_awards"."rate_spend_cents" > 0 AND "points_awards"."base_points" >= 0 AND "points_awards"."bonus_points" >= 0 AND "points_awards"."total_points" > 0),
	CONSTRAINT "points_awards_override_chk" CHECK("points_awards"."duplicate_override" = 0 OR ("points_awards"."duplicate_override_reason" IS NOT NULL AND "points_awards"."duplicate_override_by" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_awards_dedupe_guard_unq` ON `points_awards` (`dedupe_guard_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_awards_request_idem_unq` ON `points_awards` (`business_id`,`request_idempotency_key`);
--> statement-breakpoint
CREATE INDEX `points_awards_customer_idx` ON `points_awards` (`customer_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `points_awards_business_created_idx` ON `points_awards` (`business_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `points_awards_staff_idx` ON `points_awards` (`staff_id`);
--> statement-breakpoint
CREATE INDEX `points_awards_location_day_idx` ON `points_awards` (`location_id`,`business_day`);
--> statement-breakpoint
CREATE INDEX `points_awards_mult_promo_idx` ON `points_awards` (`multiplier_promotion_id`);
--> statement-breakpoint
CREATE INDEX `points_awards_bonus_promo_idx` ON `points_awards` (`bonus_promotion_id`);
--> statement-breakpoint

CREATE TABLE `points_catalogue_items` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`reward_definition_id` text NOT NULL,
	`points_cost` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`archived_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`image_key` text,
	`max_per_customer_per_period` integer,
	`limit_period_days` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reward_definition_id`) REFERENCES `reward_definitions`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "points_catalogue_cost_chk" CHECK("points_catalogue_items"."points_cost" > 0),
	CONSTRAINT "points_catalogue_limit_chk" CHECK(("points_catalogue_items"."max_per_customer_per_period" IS NULL OR "points_catalogue_items"."max_per_customer_per_period" > 0) AND ("points_catalogue_items"."limit_period_days" IS NULL OR "points_catalogue_items"."limit_period_days" > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_catalogue_reward_unq` ON `points_catalogue_items` (`business_id`,`reward_definition_id`);
--> statement-breakpoint
CREATE INDEX `points_catalogue_listing_idx` ON `points_catalogue_items` (`business_id`,`active`,`sort_order`);
--> statement-breakpoint

CREATE TABLE `points_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`program_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`catalogue_item_id` text NOT NULL,
	`reward_definition_id` text NOT NULL,
	`catalogue_item_name` text NOT NULL,
	`points_cost` integer NOT NULL,
	`ledger_transaction_id` text NOT NULL,
	`customer_reward_id` text NOT NULL,
	`request_idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`program_id`) REFERENCES `loyalty_programs`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`catalogue_item_id`) REFERENCES `points_catalogue_items`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`reward_definition_id`) REFERENCES `reward_definitions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`ledger_transaction_id`) REFERENCES `loyalty_transactions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`customer_reward_id`) REFERENCES `customer_rewards`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "points_redemptions_cost_chk" CHECK("points_redemptions"."points_cost" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_redemptions_request_unq` ON `points_redemptions` (`business_id`,`customer_id`,`request_idempotency_key`);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_redemptions_ledger_unq` ON `points_redemptions` (`ledger_transaction_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `points_redemptions_reward_unq` ON `points_redemptions` (`customer_reward_id`);
--> statement-breakpoint
CREATE INDEX `points_redemptions_customer_idx` ON `points_redemptions` (`customer_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `points_redemptions_item_idx` ON `points_redemptions` (`catalogue_item_id`);
--> statement-breakpoint

ALTER TABLE `loyalty_programs` ADD `earn_rate_points` integer;
--> statement-breakpoint
ALTER TABLE `loyalty_programs` ADD `earn_rate_spend_cents` integer;
--> statement-breakpoint
ALTER TABLE `loyalty_transactions` ADD `points_award_id` text;
--> statement-breakpoint
ALTER TABLE `loyalty_transactions` ADD `related_transaction_id` text;
--> statement-breakpoint
CREATE INDEX `loyalty_transactions_points_award_idx` ON `loyalty_transactions` (`points_award_id`);
--> statement-breakpoint
CREATE INDEX `loyalty_transactions_related_idx` ON `loyalty_transactions` (`related_transaction_id`);
