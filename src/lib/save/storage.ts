/**
 * Device storage for imported saves: a tiny key/value wrapper over IndexedDB.
 *
 * Raw .sav bytes and fully parsed saves are hundreds of KB, and iOS can evict a
 * WebView's localStorage — so they live here, and localStorage only keeps the
 * small profile metadata. Nothing in this store is synced except the summaries,
 * which sync.ts carries separately.
 *
 * Where IndexedDB is missing (tests, some private modes) an in-memory map is
 * used instead, so callers don't need to care.
 */

const DB_NAME = "pokedex-saves";
const STORE = "kv";

/** Key prefixes: one record per profile id under each. */
export const KEYS = {
  /** { fileName, bytes: Uint8Array } — kept so a parser fix can re-read old imports */
  raw: (id: string) => `raw:${id}`,
  /** ParsedSave */
  parsed: (id: string) => `parsed:${id}`,
  /** SaveSummary — also what other devices receive through sync */
  summary: (id: string) => `summary:${id}`,
  /** { at, snapshot: GenSnapshot } — tracker marks from just before the last import */
  revert: (id: string) => `revert:${id}`,
  /** HistoryEntry[] — what changed at each import, newest first */
  history: (id: string) => `history:${id}`,
};

const memory = new Map<string, unknown>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return openDb().then((db) => {
    if (!db) return undefined;
    return new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  });
}

async function usingMemory(): Promise<boolean> {
  return (await openDb()) === null;
}

export async function storageGet<T>(key: string): Promise<T | undefined> {
  if (await usingMemory()) return memory.get(key) as T | undefined;
  return run<T>("readonly", (s) => s.get(key));
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  if (await usingMemory()) { memory.set(key, value); return; }
  await run("readwrite", (s) => s.put(value, key));
}

export async function storageDelete(key: string): Promise<void> {
  if (await usingMemory()) { memory.delete(key); return; }
  await run("readwrite", (s) => s.delete(key));
}

/** Asks the browser not to evict this origin's storage. Best effort — it may say no. */
export function requestPersistentStorage(): void {
  try {
    void navigator.storage?.persist?.().catch(() => {});
  } catch {
    // Not available here — nothing to do
  }
}
