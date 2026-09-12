ALTER TABLE `growth_measurement` ADD `head_cm` real;
--> statement-breakpoint
CREATE TABLE `vaccine_record` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`name` text NOT NULL,
	`dose` text NOT NULL,
	`scheduled_date` text,
	`administered_date` text,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `child`(`id`) ON UPDATE no action ON DELETE cascade
);
