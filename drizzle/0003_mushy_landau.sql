CREATE TABLE `claim_edge` (
	`id` text PRIMARY KEY NOT NULL,
	`work_product_id` text NOT NULL,
	`from_claim_id` text NOT NULL,
	`to_claim_id` text NOT NULL,
	`relation` text NOT NULL,
	`rationale` text DEFAULT '' NOT NULL,
	`is_ordering` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`work_product_id`) REFERENCES `work_product`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_claim_id`) REFERENCES `atomic_claim`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_claim_id`) REFERENCES `atomic_claim`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `edge_wp_idx` ON `claim_edge` (`work_product_id`);--> statement-breakpoint
CREATE INDEX `edge_from_idx` ON `claim_edge` (`from_claim_id`);