import { browser } from '$app/environment';

/**
 * New versions of the app. The service worker never takes over by itself —
 * swapping code under a run in progress could cost the athlete the run — so a
 * new version waits, and the layout offers to reload once no run is open.
 */
class Updates {
	ready = $state(false);
	#registration: ServiceWorkerRegistration | null = null;

	constructor() {
		if (!browser || !('serviceWorker' in navigator)) return;
		// `ready` waits for SvelteKit to have registered the worker.
		void navigator.serviceWorker.ready.then((registration) => {
			this.#registration = registration;
			if (registration.waiting && navigator.serviceWorker.controller) this.ready = true;
			registration.addEventListener('updatefound', () => {
				const installing = registration.installing;
				installing?.addEventListener('statechange', () => {
					// Only an *update* waits: a first install has nothing to replace.
					if (installing.state === 'installed' && navigator.serviceWorker.controller) {
						this.ready = true;
					}
				});
			});
		});
	}

	/** Lets the waiting version take over, then reloads into it. */
	apply(): void {
		const waiting = this.#registration?.waiting;
		if (!waiting) return location.reload();
		navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
			once: true
		});
		waiting.postMessage({ type: 'skip-waiting' });
	}
}

export const updates = new Updates();
