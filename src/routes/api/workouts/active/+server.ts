import { workoutService } from '$server/services/index.ts';
import { authed } from '$server/http/respond.ts';
import { json } from '@sveltejs/kit';

/** `null` is a valid answer here, so the response is built explicitly. */
export const GET = authed((_event, user) => json(workoutService.active(user.id)));
