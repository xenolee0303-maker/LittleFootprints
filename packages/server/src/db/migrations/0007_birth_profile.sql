ALTER TABLE `child` ADD `gender` text DEFAULT 'unspecified' NOT NULL;
--> statement-breakpoint
ALTER TABLE `child_profile` ADD `birth_time` text;
--> statement-breakpoint
ALTER TABLE `child_profile` ADD `gender` text DEFAULT 'unspecified' NOT NULL;
--> statement-breakpoint
ALTER TABLE `child_profile` ADD `blood_type` text;
--> statement-breakpoint
ALTER TABLE `child_profile` ADD `father_height_cm` real;
--> statement-breakpoint
ALTER TABLE `child_profile` ADD `mother_height_cm` real;
