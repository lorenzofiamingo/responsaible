ALTER TABLE `atomic_claim` ADD `review_verdict` text;--> statement-breakpoint
ALTER TABLE `atomic_claim` ADD `review_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `atomic_claim` ADD `reviewed_by` text;--> statement-breakpoint
ALTER TABLE `atomic_claim` ADD `reviewed_at` text;--> statement-breakpoint
ALTER TABLE `atomic_claim` ADD `supervisor_input` text;
