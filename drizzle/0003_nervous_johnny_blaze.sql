ALTER TABLE `workouts` DROP COLUMN `active_ms`;--> statement-breakpoint
ALTER TABLE `workouts` DROP COLUMN `rest_ms`;--> statement-breakpoint
-- Total time becomes clock time: start of the first step to the end of the last,
-- breaks included. Recompute it for every existing workout from its step logs,
-- the same span `refreshTotals` derives from now on.
UPDATE `workouts` SET `total_ms` = coalesce((
	SELECT CAST(round((julianday(max(`completed_at`)) - julianday(min(`started_at`))) * 86400000) AS INTEGER)
	FROM `workout_steps` WHERE `workout_steps`.`workout_id` = `workouts`.`id`
), 0);
