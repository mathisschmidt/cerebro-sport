import { offlineService } from '$server/services/index.ts';
import { authed } from '$server/http/respond.ts';

/** What the phone stores to train without a connection. */
export const GET = authed((_event, user) => offlineService.snapshot(user.id));
