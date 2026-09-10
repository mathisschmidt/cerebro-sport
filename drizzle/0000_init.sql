CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`default_measure_type` text,
	`default_measure_value` real,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_name_unique` ON `exercises` (`name`);--> statement-breakpoint
CREATE INDEX `exercises_category_idx` ON `exercises` (`category`);--> statement-breakpoint
CREATE TABLE `routine_occurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`workout_id` text,
	`resolved_at` text NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routine_occurrences_unique` ON `routine_occurrences` (`routine_id`,`date`);--> statement-breakpoint
CREATE INDEX `routine_occurrences_date_idx` ON `routine_occurrences` (`date`);--> statement-breakpoint
CREATE TABLE `routines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`session_id` text NOT NULL,
	`recurrence_type` text NOT NULL,
	`recurrence_interval` integer DEFAULT 1 NOT NULL,
	`recurrence_weekdays` text DEFAULT '[]' NOT NULL,
	`recurrence_day_of_month` integer,
	`start_date` text NOT NULL,
	`end_date` text,
	`time_of_day` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `routines_session_idx` ON `routines` (`session_id`);--> statement-breakpoint
CREATE INDEX `routines_active_idx` ON `routines` (`active`);--> statement-breakpoint
CREATE TABLE `session_blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`position` integer NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`rounds` integer DEFAULT 1 NOT NULL,
	`rest_between_rounds_sec` integer DEFAULT 0 NOT NULL,
	`rest_after_sec` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_blocks_session_idx` ON `session_blocks` (`session_id`,`position`);--> statement-breakpoint
CREATE TABLE `session_items` (
	`id` text PRIMARY KEY NOT NULL,
	`block_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`measure_type` text NOT NULL,
	`measure_value` real NOT NULL,
	`rest_after_sec` integer DEFAULT 0 NOT NULL,
	`target_load` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`block_id`) REFERENCES `session_blocks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `session_items_block_idx` ON `session_items` (`block_id`,`position`);--> statement-breakpoint
CREATE INDEX `session_items_exercise_idx` ON `session_items` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_name_idx` ON `sessions` (`name`);--> statement-breakpoint
CREATE TABLE `workout_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`step_index` integer NOT NULL,
	`step_key` text NOT NULL,
	`kind` text NOT NULL,
	`block_id` text NOT NULL,
	`block_index` integer NOT NULL,
	`item_id` text,
	`item_index` integer,
	`round_index` integer NOT NULL,
	`exercise_id` text,
	`exercise_name` text DEFAULT '' NOT NULL,
	`planned_measure_type` text,
	`planned_measure_value` real,
	`planned_rest_sec` integer,
	`actual_value` real,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT false NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text NOT NULL,
	FOREIGN KEY (`workout_id`) REFERENCES `workouts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workout_steps_unique` ON `workout_steps` (`workout_id`,`step_index`);--> statement-breakpoint
CREATE INDEX `workout_steps_key_idx` ON `workout_steps` (`step_key`);--> statement-breakpoint
CREATE INDEX `workout_steps_exercise_idx` ON `workout_steps` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`session_name` text NOT NULL,
	`routine_id` text,
	`occurrence_date` text,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`total_ms` integer DEFAULT 0 NOT NULL,
	`active_ms` integer DEFAULT 0 NOT NULL,
	`rest_ms` integer DEFAULT 0 NOT NULL,
	`completed_step_count` integer DEFAULT 0 NOT NULL,
	`planned_step_count` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`plan` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `workouts_session_idx` ON `workouts` (`session_id`);--> statement-breakpoint
CREATE INDEX `workouts_started_idx` ON `workouts` (`started_at`);--> statement-breakpoint
CREATE INDEX `workouts_status_idx` ON `workouts` (`status`);