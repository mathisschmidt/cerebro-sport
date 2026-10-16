import { browser } from '$app/environment';

/**
 * Whether the device thinks it has a network. `navigator.onLine` only knows
 * about the link, not the server, so it is a hint: the outbox still treats a
 * failed request as offline whatever this says.
 */
class Connectivity {
	online = $state(browser ? navigator.onLine : true);
	#listeners = new Set<() => void>();

	constructor() {
		if (!browser) return;
		window.addEventListener('online', () => {
			this.online = true;
			for (const listener of this.#listeners) listener();
		});
		window.addEventListener('offline', () => (this.online = false));
	}

	/** Called each time the connection comes back. */
	onReconnect(listener: () => void): () => void {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}
}

export const connectivity = new Connectivity();
