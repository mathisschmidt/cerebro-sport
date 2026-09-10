-- HAND-EDITED: the four `user_id` columns carry `DEFAULT ''` so this migration
-- also applies to a database that already holds training data. SQLite cannot
-- add a NOT NULL column to a populated table without one. Rows left with `''`
-- are adopted by the first admin at boot (`claimOrphanRows`), after which the
-- default is never used again — the drizzle schema declares no default, so
-- inserts must state an owner.
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_enabled` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`username` text,
	`display_username` text,
	`role` text,
	`banned` integer DEFAULT false,
	`ban_reason` text,
	`ban_expires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_username_unique` ON `user` (`username`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
DROP INDEX `exercises_name_unique`;--> statement-breakpoint
ALTER TABLE `exercises` ADD `user_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `exercises_user_name_unique` ON `exercises` (`user_id`,`name`);--> statement-breakpoint
CREATE INDEX `exercises_user_idx` ON `exercises` (`user_id`);--> statement-breakpoint
DROP INDEX `sessions_name_idx`;--> statement-breakpoint
ALTER TABLE `sessions` ADD `user_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`,`name`);--> statement-breakpoint
ALTER TABLE `routines` ADD `user_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `routines_user_idx` ON `routines` (`user_id`);--> statement-breakpoint
ALTER TABLE `workouts` ADD `user_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `workouts_user_idx` ON `workouts` (`user_id`,`started_at`);