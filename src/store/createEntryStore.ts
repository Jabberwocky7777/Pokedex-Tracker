import { create } from "zustand";
import { safeStorage } from "../lib/safe-storage";
import { persist } from "zustand/middleware";
import { tombstone, type Entries } from "../lib/entries";
import { stampNow } from "../lib/clock";

export interface EntryStore<T> {
  /** Synced. Includes tombstones of removed entries (see lib/entries.ts) */
  entries: Entries<T>;
  /** Writes an entry, stamped now */
  put: (key: string, value: T) => void;
  /** Removes an entry, leaving a bare tombstone (`{ at, removed }`, no content) so the removal syncs */
  remove: (key: string) => void;
  /** Replaces everything — for applying a merged sync payload or a restore. Stamps nothing. */
  replaceAll: (entries: Entries<T>) => void;
}

/**
 * A persisted store holding one entry-merged collection, synced as one section
 * of the payload (ENTRY_SECTIONS in lib/backup.ts lists them all).
 */
export function createEntryStore<T>(storageKey: string) {
  return create<EntryStore<T>>()(
    persist(
      (set) => ({
        entries: {},
        put: (key, value) =>
          set((state) => ({
            entries: { ...state.entries, [key]: { ...value, at: stampNow(state.entries[key]?.at) } },
          })),
        remove: (key) =>
          set((state) => {
            const existing = state.entries[key];
            if (!existing || existing.removed) return state;
            return { entries: { ...state.entries, [key]: tombstone<T>(stampNow(existing.at)) } };
          }),
        replaceAll: (entries) => set({ entries }),
      }),
      { name: storageKey, storage: safeStorage, partialize: (state) => ({ entries: state.entries }) },
    ),
  );
}
