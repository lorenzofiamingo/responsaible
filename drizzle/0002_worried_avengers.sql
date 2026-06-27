CREATE TABLE `atomic_claim` (
	`id` text PRIMARY KEY NOT NULL,
	`work_product_id` text NOT NULL,
	`idx` integer NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`char_start` integer DEFAULT 0 NOT NULL,
	`char_end` integer DEFAULT 0 NOT NULL,
	`kind` text DEFAULT 'assertion' NOT NULL,
	`assigned_preset` text DEFAULT 'standard_review' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`analysis_source` text,
	`preset_used` text DEFAULT '' NOT NULL,
	`work_group_json` text,
	`verdict` text,
	`analysis_summary` text DEFAULT '' NOT NULL,
	`confidence` real DEFAULT 0 NOT NULL,
	`risk_category` text,
	`risk_severity` text,
	`risk_rationale` text DEFAULT '' NOT NULL,
	`citation_markers` text,
	`figure_trace` text,
	`ran_at` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`work_product_id`) REFERENCES `work_product`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `claim_wp_idx` ON `atomic_claim` (`work_product_id`);