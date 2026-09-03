CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`key` text NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_settings_business_key_unq` ON `app_settings` (`business_id`,`key`);--> statement-breakpoint
CREATE TABLE `businesses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`currency` text DEFAULT 'ZAR' NOT NULL,
	`timezone` text DEFAULT 'Africa/Johannesburg' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `businesses_slug_unq` ON `businesses` (`slug`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `locations_business_idx` ON `locations` (`business_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `locations_business_name_unq` ON `locations` (`business_id`,`name`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_user_id` text NOT NULL,
	`business_id` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`mobile_number` text,
	`role` text DEFAULT 'customer' NOT NULL,
	`birthday` text,
	`avatar_url` text,
	`marketing_opt_in` integer DEFAULT false NOT NULL,
	`notification_opt_in` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_auth_user_unq` ON `profiles` (`auth_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_business_email_unq` ON `profiles` (`business_id`,`email`);--> statement-breakpoint
CREATE INDEX `profiles_business_role_idx` ON `profiles` (`business_id`,`role`);--> statement-breakpoint
CREATE INDEX `profiles_mobile_idx` ON `profiles` (`business_id`,`mobile_number`);--> statement-breakpoint
CREATE TABLE `loyalty_programs` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`program_type` text NOT NULL,
	`currency_code` text NOT NULL,
	`qualifying_purchases_required` integer,
	`reward_definition_id` text,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reward_definition_id`) REFERENCES `reward_definitions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `loyalty_programs_business_currency_unq` ON `loyalty_programs` (`business_id`,`currency_code`);--> statement-breakpoint
CREATE INDEX `loyalty_programs_business_active_idx` ON `loyalty_programs` (`business_id`,`active`);--> statement-breakpoint
CREATE TABLE `loyalty_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`location_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`staff_id` text,
	`program_id` text NOT NULL,
	`transaction_type` text NOT NULL,
	`quantity` integer NOT NULL,
	`spend_amount_cents` integer,
	`bill_reference` text,
	`notes` text,
	`reason` text,
	`approved_by` text,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`staff_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`program_id`) REFERENCES `loyalty_programs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `loyalty_transactions_idempotency_key_unq` ON `loyalty_transactions` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `loyalty_transactions_customer_idx` ON `loyalty_transactions` (`customer_id`);--> statement-breakpoint
CREATE INDEX `loyalty_transactions_program_idx` ON `loyalty_transactions` (`program_id`);--> statement-breakpoint
CREATE INDEX `loyalty_transactions_staff_idx` ON `loyalty_transactions` (`staff_id`);--> statement-breakpoint
CREATE INDEX `loyalty_transactions_location_idx` ON `loyalty_transactions` (`location_id`);--> statement-breakpoint
CREATE INDEX `loyalty_transactions_created_at_idx` ON `loyalty_transactions` (`created_at`);--> statement-breakpoint
CREATE INDEX `loyalty_transactions_progress_idx` ON `loyalty_transactions` (`customer_id`,`program_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `customer_rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`reward_definition_id` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`issued_at` integer NOT NULL,
	`expires_at` integer,
	`redeemed_at` integer,
	`redeemed_by` text,
	`location_id` text,
	`redemption_transaction_id` text,
	`issuance_key` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reward_definition_id`) REFERENCES `reward_definitions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`redeemed_by`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`redemption_transaction_id`) REFERENCES `loyalty_transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_rewards_issuance_key_unq` ON `customer_rewards` (`issuance_key`);--> statement-breakpoint
CREATE INDEX `customer_rewards_customer_status_idx` ON `customer_rewards` (`customer_id`,`status`);--> statement-breakpoint
CREATE INDEX `customer_rewards_business_idx` ON `customer_rewards` (`business_id`);--> statement-breakpoint
CREATE INDEX `customer_rewards_expires_at_idx` ON `customer_rewards` (`expires_at`);--> statement-breakpoint
CREATE TABLE `loyalty_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`otp_hash` text NOT NULL,
	`qr_token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `loyalty_codes_otp_idx` ON `loyalty_codes` (`business_id`,`otp_hash`,`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `loyalty_codes_qr_token_unq` ON `loyalty_codes` (`qr_token_hash`);--> statement-breakpoint
CREATE INDEX `loyalty_codes_customer_idx` ON `loyalty_codes` (`customer_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `reward_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`reward_type` text NOT NULL,
	`value_cents` integer,
	`points_cost` integer,
	`item_reference` text,
	`valid_days` integer,
	`welcome_reward` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`terms` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reward_definitions_business_active_idx` ON `reward_definitions` (`business_id`,`active`);--> statement-breakpoint
CREATE UNIQUE INDEX `reward_definitions_welcome_unq` ON `reward_definitions` (`business_id`) WHERE welcome_reward = 1;--> statement-breakpoint
CREATE TABLE `menu_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`image_key` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `menu_categories_business_name_unq` ON `menu_categories` (`business_id`,`name`);--> statement-breakpoint
CREATE INDEX `menu_categories_business_sort_idx` ON `menu_categories` (`business_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`category_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`price_cents` integer NOT NULL,
	`image_key` text,
	`active` integer DEFAULT true NOT NULL,
	`available` integer DEFAULT true NOT NULL,
	`popular` integer DEFAULT false NOT NULL,
	`vegetarian` integer DEFAULT false NOT NULL,
	`spicy` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `menu_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `menu_items_category_sort_idx` ON `menu_items` (`category_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `menu_items_business_active_idx` ON `menu_items` (`business_id`,`active`);--> statement-breakpoint
CREATE TABLE `promotions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`description` text,
	`image_key` text,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`cta_text` text,
	`cta_url` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `promotions_business_window_idx` ON `promotions` (`business_id`,`active`,`start_at`,`end_at`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`actor_role` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`old_value_json` text,
	`new_value_json` text,
	`metadata_json` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `audit_logs_business_created_idx` ON `audit_logs` (`business_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actor_user_id`);