CREATE TABLE `agent_action` (
	`id` text PRIMARY KEY NOT NULL,
	`work_product_id` text NOT NULL,
	`step` integer NOT NULL,
	`kind` text NOT NULL,
	`actor_agent` text DEFAULT '' NOT NULL,
	`summary` text NOT NULL,
	`detail` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`work_product_id`) REFERENCES `work_product`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `aa_wp_idx` ON `agent_action` (`work_product_id`);--> statement-breakpoint
CREATE TABLE `citation` (
	`id` text PRIMARY KEY NOT NULL,
	`work_product_id` text NOT NULL,
	`marker` integer,
	`claim` text DEFAULT '' NOT NULL,
	`celex` text,
	`eli` text,
	`title` text DEFAULT '' NOT NULL,
	`source_url` text,
	`snippet` text DEFAULT '' NOT NULL,
	`locator` text DEFAULT '' NOT NULL,
	`supports_claim` integer DEFAULT true NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`verify_status` text DEFAULT 'unchecked' NOT NULL,
	`verified_at` text,
	FOREIGN KEY (`work_product_id`) REFERENCES `work_product`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cit_wp_idx` ON `citation` (`work_product_id`);--> statement-breakpoint
CREATE TABLE `risk_signal` (
	`id` text PRIMARY KEY NOT NULL,
	`work_product_id` text NOT NULL,
	`category` text NOT NULL,
	`severity` text NOT NULL,
	`rationale` text NOT NULL,
	`confidence` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`work_product_id`) REFERENCES `work_product`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rs_wp_idx` ON `risk_signal` (`work_product_id`);--> statement-breakpoint
CREATE TABLE `supervisory_action` (
	`id` text PRIMARY KEY NOT NULL,
	`work_product_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`prev_hash` text NOT NULL,
	`hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`work_product_id`) REFERENCES `work_product`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sa_wp_idx` ON `supervisory_action` (`work_product_id`);--> statement-breakpoint
CREATE INDEX `sa_created_idx` ON `supervisory_action` (`created_at`);--> statement-breakpoint
CREATE TABLE `work_product` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`matter_ref` text DEFAULT '' NOT NULL,
	`matter_name` text DEFAULT '' NOT NULL,
	`agent_name` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`confidence` real DEFAULT 0 NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `wp_status_idx` ON `work_product` (`status`);--> statement-breakpoint
CREATE INDEX `wp_priority_idx` ON `work_product` (`priority`);