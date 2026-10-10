// Vitest runs in Node, where there is no localStorage. The stores (zustand
// persist) and sync.ts both read it at import time, so install a small
// in-memory one before any test file loads them.
class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() { return this.data.size; }
  clear() { this.data.clear(); }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null; }
  removeItem(key: string) { this.data.delete(key); }
  setItem(key: string, value: string) { this.data.set(key, String(value)); }
}

// Always replace it: newer Node versions expose a global localStorage that is
// unusable without --localstorage-file.
const storage = new MemoryStorage();
Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
// zustand's persist middleware looks for window.localStorage specifically
if (typeof globalThis.window === "undefined") {
  Object.defineProperty(globalThis, "window", { value: { localStorage: storage }, configurable: true, writable: true });
}
