CREATE TABLE `daily_journal` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`date` text NOT NULL,
	`content` text NOT NULL,
	`mood` text,
	`author_role` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `child`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `daily_journal_child_date_idx` ON `daily_journal` (`child_id`,`date`);
--> statement-breakpoint
ALTER TABLE `media_asset` ADD `journal_id` text REFERENCES `daily_journal`(`id`) ON DELETE cascade;
