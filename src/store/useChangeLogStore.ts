import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MarkChange } from "./useDexStore";
import { mergeChanges, type LogEntry, type LogKind } from "../lib/change-log";
import { mergeProgressChanges, type ProgressChange } from "../lib/game-progress";

/** Oldest entries drop off past this many. */
export const MAX_LOG_ENTRIES = 100;
/** Marks made by hand within this long of each other (same generation) share one entry. */
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

interface ChangeLogStore {
  /** Newest first */
  entries: LogEntry[];
  /**
   * Adds what just happened. Hand-made marks join the newest entry when that is
   * also a recent, not-undone group of marks; a mark that takes back one already
   * in the group cancels it. Returns the entry's id, or null if nothing is left to log.
   */
  record: (gen: number, kind: LogKind, label: string, changes: MarkChange[]) => string | null;
  /**
   * Adds Game Progress changes made by hand, grouped like marks: they join a
   * recent, not-undone progress entry of the same generation. Returns the entry's id.
   */
  recordProgress: (gen: number, changes: ProgressChange[]) => string | null;
  /** Adds progress changes to an existing entry (an import that also moved progress on) */
  attachProgress: (id: string, changes: ProgressChange[]) => void;
  setUndone: (id: string, undone: boolean) => void;
  /** Drops one Pokémon's changes from an entry (after undoing just that Pokémon). */
  removePokemon: (id: string, pokemonId: number) => void;
  clear: () => void;
}

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

/**
 * The tracker's change log: what each import, clear, and run of hand-made marks
 * changed. This device only — never synced or backed up; it describes actions
 * taken here, and changes arriving from another device are not logged.
 */
export const useChangeLogStore = create<ChangeLogStore>()(
  persist(
    (set, get) => ({
      entries: [],

      record: (gen, kind, label, changes) => {
        if (changes.length === 0) return null;
        const now = Date.now();
        const [latest, ...rest] = get().entries;
        const joins = kind === "marks" && latest !== undefined && latest.kind === "marks" && latest.gen === gen &&
          latest.undoneAt === undefined && now - latest.at < GROUP_WINDOW_MS;
        if (joins) {
          const merged = mergeChanges(latest.changes, changes);
          set({ entries: merged.length > 0 ? [{ ...latest, at: now, changes: merged }, ...rest] : rest });
          return merged.length > 0 ? latest.id : null;
        }
        const entry: LogEntry = { id: newId(), at: now, gen, kind, label, changes };
        set({ entries: [entry, ...get().entries].slice(0, MAX_LOG_ENTRIES) });
        return entry.id;
      },

      recordProgress: (gen, changes) => {
        if (changes.length === 0) return null;
        const now = Date.now();
        const [latest, ...rest] = get().entries;
        const joins = latest !== undefined && latest.kind === "progress" && latest.gen === gen &&
          latest.undoneAt === undefined && now - latest.at < GROUP_WINDOW_MS;
        if (joins) {
          const merged = mergeProgressChanges(latest.progress ?? [], changes);
          set({ entries: merged.length > 0 ? [{ ...latest, at: now, progress: merged }, ...rest] : rest });
          return merged.length > 0 ? latest.id : null;
        }
        const entry: LogEntry = { id: newId(), at: now, gen, kind: "progress", label: "", changes: [], progress: changes };
        set({ entries: [entry, ...get().entries].slice(0, MAX_LOG_ENTRIES) });
        return entry.id;
      },

      attachProgress: (id, changes) =>
        set({ entries: get().entries.map((e) => (e.id === id ? { ...e, progress: [...(e.progress ?? []), ...changes] } : e)) }),

      setUndone: (id, undone) =>
        set({
          entries: get().entries.map((e) => {
            if (e.id !== id) return e;
            if (undone) return { ...e, undoneAt: Date.now() };
            const kept = { ...e };
            delete kept.undoneAt;
            return kept;
          }),
        }),

      removePokemon: (id, pokemonId) =>
        set({
          entries: get().entries
            .map((e) => (e.id === id ? { ...e, changes: e.changes.filter((c) => c.id !== pokemonId) } : e))
            .filter((e) => e.changes.length > 0 || (e.progress?.length ?? 0) > 0),
        }),

      clear: () => set({ entries: [] }),
    }),
    { name: "pokedex-changelog-v1" },
  ),
);
