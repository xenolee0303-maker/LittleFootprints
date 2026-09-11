CREATE TABLE `health_profile` (
	`child_id` text PRIMARY KEY NOT NULL,
	`allergies` text,
	`chronic_conditions` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `child`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `health_record` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`facility` text,
	`summary` text,
	`follow_up_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `child`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `media_asset` ADD `health_record_id` text REFERENCES `health_record`(`id`) ON DELETE cascade;
