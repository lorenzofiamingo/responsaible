CREATE TABLE `matter` (
	`id` text PRIMARY KEY NOT NULL,
	`ref` text DEFAULT '' NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`client` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matter_ref_idx` ON `matter` (`ref`);--> statement-breakpoint
CREATE INDEX `matter_status_idx` ON `matter` (`status`);--> statement-breakpoint
ALTER TABLE `work_product` ADD `matter_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `wp_matter_idx` ON `work_product` (`matter_id`);