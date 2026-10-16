/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

/**
 * Opens the app without a network.
 *
 *  - The app's own code and static files are stored at install, per version.
 *  - Pages and their data are network-first: fresh when online, the last copy
 *    when not. A slow network falls back to the copy after a few seconds, so a
 *    weak signal in a gym does not leave the athlete staring at a spinner.
 *  - `/api` is never cached: reads are live, and writes go through the outbox.
 *  - Reloading a run offline goes home: a run is never resumed.
 *
 * It never takes over on its own (no `skipWaiting` at install): swapping code
 * under a run in progress could lose it. The page asks once no run is open.
 *
 * Cached pages carry the signed-in athlete's data, so the page deletes every
 * `pages-*` cache on sign-out.
 */

import { build, files, version } from '$service-worker';

const sw = self as unknown as ServiceWorkerGlobalScope;

const ASSETS = `assets-${version}`;
const PAGES = `pages-${version}`;
const PRECACHE = [...build, ...files];
const PRECACHED = new Set(PRECACHE);

/** How long a network answer may take before the stored copy is shown instead. */
const NETWORK_TIMEOUT_MS = 4_000;

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(ASSETS).then((cache) => cache.addAll(PRECACHE)));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			for (const key of await caches.keys()) {
				if (key !== ASSETS && key !== PAGES) await caches.delete(key);
			}
			await sw.clients.claim();
		})()
	);
});

sw.addEventListener('message', (event) => {
	const message = event.data as { type?: string; paths?: string[] } | null;
	if (message?.type === 'skip-waiting') void sw.skipWaiting();
	if (message?.type === 'warm' && Array.isArray(message.paths)) event.waitUntil(warm(message.paths));
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== sw.location.origin || url.pathname.startsWith('/api/')) return;

	if (PRECACHED.has(url.pathname)) {
		event.respondWith(cacheFirst(request));
	} else if (request.mode === 'navigate') {
		event.respondWith(navigation(request, url));
	} else if (url.pathname.endsWith('/__data.json')) {
		event.respondWith(pageData(request, url));
	}
});

async function cacheFirst(request: Request): Promise<Response> {
	return (await caches.match(request, { cacheName: ASSETS })) ?? fetch(request);
}

/** A page, keyed by path alone: the query never changes whose data it is. */
function keyFor(url: URL, pathname = url.pathname): string {
	return `${url.origin}${pathname}`;
}

async function navigation(request: Request, url: URL): Promise<Response> {
	if (url.pathname.startsWith('/run/')) {
		// Online, the run page itself ends a left run and sends the athlete home.
		// Offline there is no page to run it, so go home directly — the app ends
		// the left run on opening.
		return fetch(request).catch(() => Response.redirect('/', 302));
	}
	return networkFirst(request, keyFor(url), isCacheablePage, async () => {
		return (await caches.match('/offline.html', { cacheName: ASSETS })) ?? offlineText();
	});
}

async function pageData(request: Request, url: URL): Promise<Response> {
	return networkFirst(request, keyFor(url), isCacheableData, async () => {
		// SvelteKit turns a non-OK JSON string into the error page's message.
		return new Response(JSON.stringify('Not available offline yet'), {
			status: 503,
			headers: { 'content-type': 'application/json' }
		});
	});
}

/**
 * Fresh from the network and stored for later; the stored copy when the
 * network fails, or is still silent after a few seconds.
 */
async function networkFirst(
	request: Request,
	key: string,
	cacheable: (response: Response) => Promise<boolean>,
	fallback: () => Promise<Response>
): Promise<Response> {
	const cache = await caches.open(PAGES);
	const network = fetch(request).then(async (response) => {
		if (await cacheable(response)) await cache.put(key, response.clone());
		return response;
	});
	// The race below may settle without it; a late failure is expected, not an error.
	network.catch(() => {});

	const stored = cache.match(key);
	const slow = new Promise<Response | undefined>((resolve) =>
		setTimeout(async () => resolve(await stored), NETWORK_TIMEOUT_MS)
	);

	try {
		const first = await Promise.race([network, slow]);
		return first ?? (await network);
	} catch {
		return (await stored) ?? fallback();
	}
}

/** A real page, not a redirect to sign-in or an error. */
async function isCacheablePage(response: Response): Promise<boolean> {
	return response.ok && response.type === 'basic' && !response.redirected;
}

/**
 * Page data, not a redirect: SvelteKit answers a data request that must
 * redirect (signed out, say) with a 200 carrying `{"type":"redirect"}`, and a
 * stored redirect would send the athlete to sign-in forever while offline.
 */
async function isCacheableData(response: Response): Promise<boolean> {
	if (!(await isCacheablePage(response))) return false;
	const head = (await response.clone().text()).slice(0, 32);
	return !head.includes('"type":"redirect"');
}

function dataPathOf(pathname: string): string {
	return pathname === '/' ? '/__data.json' : `${pathname.replace(/\/$/, '')}/__data.json`;
}

/** Stores the main pages and their data, so they open offline even if never visited. */
async function warm(paths: string[]): Promise<void> {
	const cache = await caches.open(PAGES);
	const origin = sw.location.origin;
	await Promise.all(
		paths.flatMap((path) => [
			store(cache, `${origin}${path}`, isCacheablePage),
			store(cache, `${origin}${dataPathOf(path)}`, isCacheableData)
		])
	);
}

async function store(
	cache: Cache,
	url: string,
	cacheable: (response: Response) => Promise<boolean>
): Promise<void> {
	try {
		const response = await fetch(url, { credentials: 'same-origin' });
		if (await cacheable(response)) await cache.put(url, response);
	} catch {
		// Offline after all; the next opening tries again.
	}
}

function offlineText(): Response {
	return new Response('Offline — this page is not available yet.', {
		status: 503,
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
}
