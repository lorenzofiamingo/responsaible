PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_supervisory_action` (
	`id` text PRIMARY KEY NOT NULL,
	`work_product_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`prev_hash` text NOT NULL,
	`hash` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_supervisory_action`("id", "work_product_id", "actor_email", "action", "reason", "prev_hash", "hash", "created_at") SELECT "id", "work_product_id", "actor_email", "action", "reason", "prev_hash", "hash", "created_at" FROM `supervisory_action`;--> statement-breakpoint
DROP TABLE `supervisory_action`;--> statement-breakpoint
ALTER TABLE `__new_supervisory_action` RENAME TO `supervisory_action`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `sa_wp_idx` ON `supervisory_action` (`work_product_id`);--> statement-breakpoint
CREATE INDEX `sa_created_idx` ON `supervisory_action` (`created_at`);