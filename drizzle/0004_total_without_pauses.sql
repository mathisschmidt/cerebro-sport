-- Total time becomes training time: every step's time summed, rests included,
-- pauses excluded. Each step log's duration already leaves out paused time, so
-- recompute every workout from its logs, as `refreshTotals` does from now on.
UPDATE `workouts` SET `total_ms` = coalesce((
	SELECT sum(`duration_ms`) FROM `workout_steps` WHERE `workout_steps`.`workout_id` = `workouts`.`id`
), 0);
