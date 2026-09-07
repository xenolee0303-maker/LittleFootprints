CREATE TABLE `child` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `child_profile` (
	`child_id` text PRIMARY KEY NOT NULL,
	`birth_date` text,
	`school_stage` text,
	`personality` text,
	`ai_background` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `child`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `child_profile_child_id_unique` ON `child_profile` (`child_id`);
--> statement-breakpoint
CREATE TABLE `growth_measurement` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`date` text NOT NULL,
	`height_cm` real,
	`weight_kg` real,
	`note` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `child`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `interest` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `child`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `interest_note` (
	`id` text PRIMARY KEY NOT NULL,
	`interest_id` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`author_role` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`interest_id`) REFERENCES `interest`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `growth_event` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`location` text,
	`description` text,
	`participant_child_ids` text NOT NULL,
	`author_role` text NOT NULL,
	`media_directory` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_provider_config` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`mode` text NOT NULL,
	`model` text,
	`endpoint` text,
	`api_key_encrypted` text,
	`timeout_ms` integer,
	`max_input_tokens` integer,
	`max_output_tokens` integer,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_analysis_report_revision` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL REFERENCES `ai_analysis_report`(`id`) ON DELETE cascade,
	`revision` integer NOT NULL,
	`payload_json` text NOT NULL,
	`snapshot_json` text,
	`parent_report_json` text,
	`child_report_json` text,
	`provider` text,
	`model` text,
	`prompt_version` text,
	`generated_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_analysis_report_revision_report_revision_unique` ON `ai_analysis_report_revision` (`report_id`,`revision`);
--> statement-breakpoint
CREATE TABLE `ai_analysis_report` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL REFERENCES `child`(`id`) ON DELETE cascade,
	`week_start` text NOT NULL,
	`status` text NOT NULL,
	`current_revision_id` text REFERENCES `ai_analysis_report_revision`(`id`) ON DELETE set null,
	`data_updated_at` text,
	`failure_code` text,
	`failure_stage` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_analysis_report_child_week_unique` ON `ai_analysis_report` (`child_id`,`week_start`);
--> statement-breakpoint
CREATE TABLE `ai_saved_conversation` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text REFERENCES `child`(`id`) ON DELETE cascade,
	`title` text,
	`context_json` text,
	`messages_json` text NOT NULL,
	`evidence_json` text,
	`provider` text,
	`model` text,
	`saved_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
