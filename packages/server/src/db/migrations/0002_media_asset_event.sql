CREATE TABLE `media_asset_new` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text REFERENCES `interest_note`(`id`) ON DELETE cascade,
	`event_id` text REFERENCES `growth_event`(`id`) ON DELETE cascade,
	`kind` text NOT NULL,
	`file_name` text NOT NULL,
	`storage_path` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `media_asset_new` (`id`,`note_id`,`event_id`,`kind`,`file_name`,`storage_path`,`size_bytes`,`created_at`)
	SELECT `id`,`note_id`,NULL,`kind`,`file_name`,`storage_path`,`size_bytes`,`created_at` FROM `media_asset`;
--> statement-breakpoint
DROP TABLE `media_asset`;
--> statement-breakpoint
ALTER TABLE `media_asset_new` RENAME TO `media_asset`;
