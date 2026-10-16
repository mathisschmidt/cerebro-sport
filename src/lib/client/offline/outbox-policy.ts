/**
 * What to do with an outbox entry after one delivery attempt. Pure, so the
 * rules can be checked without a browser.
 *
 *  - `delivered`   the server has it; drop the entry
 *  - `gone`        the workout no longer exists (it was discarded or deleted):
 *                  nothing left to deliver to, drop the entry
 *  - `retry`       no network, or the server is struggling: keep it, try later
 *  - `signed_out`  the session expired: hold everything until sign-in
 *  - `rejected`    the server will never accept it: set it aside, visibly
 */
export type OutboxKind = 'start' | 'step' | 'finish' | 'discard';
export type DeliveryOutcome = 'delivered' | 'gone' | 'retry' | 'signed_out' | 'rejected';

/** `null` status means the request never reached the server. */
export function classifyDelivery(kind: OutboxKind, status: number | null): DeliveryOutcome {
	if (status === null) return 'retry';
	if (status >= 200 && status < 300) return 'delivered';
	if (status === 401) return 'signed_out';
	if (status === 408 || status === 425 || status === 429 || status >= 500) return 'retry';
	// A start that 404s means its session is unknown and no plan came with it —
	// that will not change on retry. Anything after a start that 404s simply has
	// no workout left to land on.
	if (status === 404) return kind === 'start' ? 'rejected' : 'gone';
	return 'rejected';
}

/** Wait before the next attempt after `attempts` failures: 5 s doubling, capped at 5 min. */
export function retryDelayMs(attempts: number): number {
	return Math.min(5 * 60_000, 5_000 * 2 ** Math.max(0, attempts - 1));
}
