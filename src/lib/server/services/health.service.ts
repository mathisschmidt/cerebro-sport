import { pingDatabase } from '../db/client.ts';

/**
 * What the container's health check asks about.
 *
 * A process that is listening but cannot reach its database is not healthy, so
 * the check touches storage rather than just returning 200 from memory.
 */
export interface HealthReport {
	status: 'ok';
	database: 'ok';
	uptimeSec: number;
}

export const healthService = {
	check(): HealthReport {
		pingDatabase();
		return {
			status: 'ok',
			database: 'ok',
			uptimeSec: Math.round(process.uptime())
		};
	}
};
