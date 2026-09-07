CREATE TABLE `media_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`kind` text NOT NULL,
	`file_name` text NOT NULL,
	`storage_path` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`note_id`) REFERENCES `interest_note`(`id`) ON UPDATE no action ON DELETE cascade
);
