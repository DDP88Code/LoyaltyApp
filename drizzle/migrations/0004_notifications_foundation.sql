CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`action_url` text,
	`source_type` text,
	`source_id` text,
	`created_at` integer NOT NULL,
	`read_at` integer,
	`expires_at` integer,
	`push_sent_at` integer,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_customer_idx` ON `notifications` (`customer_id`);
--> statement-breakpoint
CREATE INDEX `notifications_created_at_idx` ON `notifications` (`created_at`);
--> statement-breakpoint
CREATE INDEX `notifications_read_at_idx` ON `notifications` (`read_at`);
--> statement-breakpoint
CREATE INDEX `notifications_type_idx` ON `notifications` (`type`);
--> statement-breakpoint
CREATE INDEX `notifications_customer_created_idx` ON `notifications` (`customer_id`,`created_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_customer_type_source_unq` ON `notifications` (`customer_id`,`type`,`source_type`,`source_id`) WHERE source_type is not null and source_id is not null;
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh_key` text NOT NULL,
	`auth_key` text NOT NULL,
	`device_label` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_seen_at` integer,
	FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`customer_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_business_endpoint_unq` ON `push_subscriptions` (`business_id`,`endpoint`);
--> statement-breakpoint
CREATE INDEX `push_subscriptions_customer_idx` ON `push_subscriptions` (`customer_id`);
--> statement-breakpoint
CREATE INDEX `push_subscriptions_customer_active_idx` ON `push_subscriptions` (`customer_id`,`active`);
