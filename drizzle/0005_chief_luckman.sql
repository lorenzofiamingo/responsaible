CREATE TABLE `firm_knowledge` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT 'memo' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`source_ref` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fk_category_idx` ON `firm_knowledge` (`category`);