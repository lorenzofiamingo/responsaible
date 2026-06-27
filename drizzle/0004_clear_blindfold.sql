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
CREATE INDEX `fk_category_idx` ON `firm_knowledge` (`category`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'supervisor' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user`("id", "name", "email", "email_verified", "image", "role", "created_at", "updated_at") SELECT "id", "name", "email", "email_verified", "image", "role", "created_at", "updated_at" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);