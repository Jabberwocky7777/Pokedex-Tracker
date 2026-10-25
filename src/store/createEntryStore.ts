import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Entries } from "../lib/entries";
import { stampNow } from "../lib/clock";

export interface EntryStore<T> {
  /** Synced. Includes tombstones of removed entries (see lib/entries.ts) */
  entries: Entries<T>;
  /** Writes an entry, stamped now */
  put: (key: string, value: T) => void;
  /** Removes an entry, leaving a tombstone so the removal syncs */
  remove: (key: string) => void;
  /** Replaces everything — for applying a merged sync payload or a restore. Stamps nothing. */
  replaceAll: (entries: Entries<T>) => void;
}

/**
 * A persisted store holding one entry-merged collection. Three of them exist
 * (roamers, notes, shiny hunts); each is one section of the sync payload.
 */
export function createEntryStore<T>(storageKey: string) {
  return create<EntryStore<T>>()(
    persist(
      (set) => ({
        entries: {},
        put: (key, value) => set((state) => ({ entries: { ...state.entries, [key]: { ...value, at: stampNow(state.entries[key]?.at) } } })),
        remove: (key) => set((state) => {
          const existing = state.entries[key];
          if (!existing || existing.removed) return state;
          return { entries: { ...state.entries, [key]: { ...existing, at: stampNow(existing.at), removed: true } } };
        }),
        replaceAll: (entries) => set({ entries }),
      }),
      { name: storageKey, partialize: (state) => ({ entries: state.entries }) },
    ),
  );
}
