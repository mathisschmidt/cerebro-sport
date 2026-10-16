/**
 * The phone's own storage for offline training: a thin promise wrapper over
 * IndexedDB, with no dependency.
 *
 *  - `runs`     runs started on this phone, until the server has all of them
 *  - `outbox`   writes waiting for the server, in the order they happened
 *  - `kv`       single values: the offline snapshot
 *
 * Only ever touched in the browser. Everything stored is tagged with the
 * account it belongs to, and `clearAll` wipes it on sign-out.
 */

const DB_NAME = 'cerebro-sport';
const DB_VERSION = 1;

export type StoreName = 'runs' | 'outbox' | 'kv';

let opening: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
	opening ??= new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains('runs')) db.createObjectStore('runs', { keyPath: 'id' });
			if (!db.objectStoreNames.contains('outbox')) {
				db.createObjectStore('outbox', { keyPath: 'seq', autoIncrement: true });
			}
			if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => {
			opening = null;
			reject(request.error);
		};
	});
	return opening;
}

function settle<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

/**
 * Runs `work` in one transaction across `stores`, resolving once it commits —
 * so a run and its outbox entry are written together or not at all.
 */
export async function transact<T>(
	stores: StoreName[],
	mode: IDBTransactionMode,
	work: (tx: IDBTransaction) => Promise<T> | T
): Promise<T> {
	const db = await open();
	const tx = db.transaction(stores, mode);
	const done = new Promise<void>((resolve, reject) => {
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
		tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
	});
	const result = await work(tx);
	await done;
	return result;
}

export function request<T>(tx: IDBTransaction, store: StoreName, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	return settle(run(tx.objectStore(store)));
}

export async function get<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
	return transact([store], 'readonly', (tx) => request<T | undefined>(tx, store, (s) => s.get(key)));
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
	return transact([store], 'readonly', (tx) => request<T[]>(tx, store, (s) => s.getAll()));
}

export async function put(store: StoreName, value: unknown, key?: IDBValidKey): Promise<void> {
	await transact([store], 'readwrite', (tx) => request(tx, store, (s) => s.put(value, key)));
}

export async function remove(store: StoreName, key: IDBValidKey): Promise<void> {
	await transact([store], 'readwrite', (tx) => request(tx, store, (s) => s.delete(key)));
}

/** Wipes every store — sign-out, so the next person on the device sees nothing. */
export async function clearAll(): Promise<void> {
	const stores: StoreName[] = ['runs', 'outbox', 'kv'];
	await transact(stores, 'readwrite', (tx) =>
		Promise.all(stores.map((store) => request(tx, store, (s) => s.clear())))
	);
}
