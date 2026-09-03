PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_loyalty_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`location_id` text NOT NULL,
	`customer_id` text NOT NULL,
	`staff_id` text,
	`program_id` text,
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
INSERT INTO `__new_loyalty_transactions`("id", "business_id", "location_id", "customer_id", "staff_id", "program_id", "transaction_type", "quantity", "spend_amount_cents", "bill_reference", "notes", "reason", "approved_by", "idempotency_key", "created_at") SELECT "id", "business_id", "location_id", "customer_id", "staff_id", "program_id", "transaction_type", "quantity", "spend_amount_cents", "bill_reference", "notes", "reason", "approved_by", "idempotency_key", "created_at" FROM `loyalty_transactions`;--> statement-breakpoint
DROP TABLE `loyalty_transactions`;--> statement-breakpoint
ALTER TABLE `__new_loyalty_transactions` RENAME TO `loyalty_transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `loyalty_transactions_idempotency_key_unq` ON `loyalty_transactions` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `loyalty_transactions_customer_idx` ON `loyalty_transactions` (`customer_id`);--> statement-breakpoint
CREATE INDEX `loyalty_transactions_program_idx` ON `loyalty_transactions` (`program_id`);--> statement-breakpoint
CREATE INDEX `loyalty_transactions_staff_idx` ON `loyalty_transactions` (`staff_id`);--> statement-breakpoint
CREATE INDEX `loyalty_transactions_location_idx` ON `loyalty_transactions` (`location_id`);--> statement-breakpoint
CREATE INDEX `loyalty_transactions_created_at_idx` ON `loyalty_transactions` (`created_at`);--> statement-breakpoint
CREATE INDEX `loyalty_transactions_progress_idx` ON `loyalty_transactions` (`customer_id`,`program_id`,`created_at`);