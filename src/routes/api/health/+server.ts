import { healthService } from '$server/services/index.ts';
import { endpoint } from '$server/http/respond.ts';

/**
 * Public on purpose — an orchestrator has no session. Deliberately says nothing
 * about the instance beyond whether it is serving.
 */
export const GET = endpoint(() => healthService.check());
