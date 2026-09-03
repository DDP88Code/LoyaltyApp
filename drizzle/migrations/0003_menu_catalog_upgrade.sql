ALTER TABLE `menu_categories` ADD `menu_group` text DEFAULT 'food' NOT NULL;
--> statement-breakpoint
CREATE INDEX `menu_categories_business_group_sort_idx` ON `menu_categories` (`business_id`,`menu_group`,`sort_order`);
--> statement-breakpoint
UPDATE `menu_categories`
SET `menu_group` = 'drinks'
WHERE lower(`name`) IN (
	'drinks',
	'coffee',
	'on tap',
	'beers',
	'ciders',
	'gin',
	'brandy',
	'vodka',
	'rum',
	'whiskey',
	'shooters',
	'double up specials'
);
--> statement-breakpoint
ALTER TABLE `menu_items` ADD `option_notes` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `menu_items` ADD `is_new` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `menu_items` ADD `subject_to_availability` integer DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE `menu_item_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`menu_item_id` text NOT NULL,
	`name` text NOT NULL,
	`price_cents` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`menu_item_id`) REFERENCES `menu_items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `menu_item_variants_item_sort_idx` ON `menu_item_variants` (`menu_item_id`,`sort_order`);
--> statement-breakpoint
CREATE UNIQUE INDEX `menu_item_variants_item_name_unq` ON `menu_item_variants` (`menu_item_id`,`name`);
