import { create } from "zustand";
import { persist } from "zustand/middleware";
import { stampNow } from "../lib/clock";
import type { GenSnapshot, MarkChange } from "./useDexStore";
import { detectStartBox } from "../lib/save/living-dex";
import { KEYS, requestPersistentStorage, storageDelete, storageGet, storageSet } from "../lib/save/storage";
import { toSummary } from "../lib/save/summary";
import { diffSaves, hasChanges, HISTORY_LIMIT, type HistoryEntry } from "../lib/save/history";
import { gameVersionOf, genConfigOf, type ParsedSave, type SaveProfile, type SaveSummary } from "../lib/save/types";

/** Auto-detect calls a save a living dex once this many Pokémon sit in their own slot. */
const LIVING_DEX_MIN_PLACED = 30;

export interface RevertPoint {
  /** When the import was applied (epoch ms) */
  at: number;
  gen: number;
  /** Tracker marks from just before it */
  snapshot: GenSnapshot;
  /**
   * What the import changed. Reverting takes back only these (and only while
   * they still have the import's value). Absent in revert points saved before
   * this existed — those are reverted through the change log, or not at all.
   */
  changes?: MarkChange[];
}

interface RawSave {
  fileName: string;
  bytes: Uint8Array;
}

/** Which part of the Saves view is open. */
export type SavesPanel = "boxes" | "todo" | "plan" | "trade" | "search" | "history";

export const profileIdOf = (save: Pick<ParsedSave, "family" | "trainer">): string =>
  `${save.family}-${save.trainer.tid}-${save.trainer.sid}`;

interface SaveStore {
  // ── Persisted to localStorage (small) and synced ──
  profiles: SaveProfile[];
  /** Profile id → when it was removed (epoch ms). Synced, so removing a save on one device removes it on the others. */
  removedProfiles: Record<string, number>;
  // ── Persisted to localStorage, per device ──
  activeProfileId: string | null;

  // ── Loaded from IndexedDB by hydrate(); not in localStorage ──
  /** Slim per-Pokémon view of each save. Synced, so other devices have it too. */
  summaries: Record<string, SaveSummary>;
  /** Fully parsed saves — only for profiles imported on this device. */
  fullSaves: Record<string, ParsedSave>;
  /** Tracker marks from before each profile's last applied import. */
  reverts: Record<string, RevertPoint>;
  /** What changed at each import of a profile, newest first (this device only). */
  history: Record<string, HistoryEntry[]>;
  hydrated: boolean;

  // ── In memory only ──
  /** An import couldn't be written to device storage (full, or blocked in a private window) */
  storageFailed: boolean;
  panel: SavesPanel;
  setPanel: (panel: SavesPanel) => void;
  /** To-do steps the user has ticked off; cleared by the next import */
  todoChecks: Record<string, boolean>;
  toggleTodoCheck: (stepId: string) => void;

  /** Loads summaries, parsed saves and revert points from device storage. Safe to call repeatedly. */
  hydrate: () => Promise<void>;
  /**
   * Stores a freshly parsed save as a profile. Re-importing the same game +
   * trainer replaces the data but keeps the label, role and start box.
   */
  saveImport: (parsed: ParsedSave, bytes: Uint8Array, fileName: string) => { profile: SaveProfile; since: HistoryEntry };
  updateProfile: (id: string, patch: Partial<Pick<SaveProfile, "label" | "role" | "startBox" | "ownOnly">>) => void;
  removeProfile: (id: string) => void;
  setActiveProfile: (id: string | null) => void;
  /**
   * Replaces profiles and summaries wholesale (sync, backup restore). Sync passes
   * the merged removal list; without one (a restore), every profile that drops
   * out is recorded as removed now. This device's stored files for profiles
   * that are gone are deleted.
   */
  replaceAll: (profiles: SaveProfile[], summaries: Record<string, SaveSummary>, removed?: Record<string, number>) => void;
  setRevert: (id: string, point: RevertPoint | null) => void;
  /** Re-parses every stored .sav with the current parser (after a parser fix). */
  rereadAll: () => Promise<{ reread: number; failed: number }>;
}

let hydration: Promise<void> | null = null;

/** Deletes everything this device stores for a profile: the file, the parsed save, summary, revert point and history. */
function deleteStoredProfile(id: string): void {
  for (const key of [KEYS.raw(id), KEYS.parsed(id), KEYS.summary(id), KEYS.revert(id), KEYS.history(id)]) {
    void storageDelete(key).catch(() => {});
  }
}

export const useSaveStore = create<SaveStore>()(
  persist(
    (set, get) => ({
      profiles: [],
      removedProfiles: {},
      activeProfileId: null,
      summaries: {},
      fullSaves: {},
      reverts: {},
      history: {},
      hydrated: false,
      storageFailed: false,

      panel: "boxes",
      setPanel: (panel) => set({ panel }),
      todoChecks: {},
      toggleTodoCheck: (stepId) => set((s) => ({ todoChecks: { ...s.todoChecks, [stepId]: !s.todoChecks[stepId] } })),

      hydrate: () => {
        hydration ??= (async () => {
          const summaries: Record<string, SaveSummary> = {};
          const fullSaves: Record<string, ParsedSave> = {};
          const reverts: Record<string, RevertPoint> = {};
          const history: Record<string, HistoryEntry[]> = {};
          try {
            await Promise.all(get().profiles.map(async ({ id }) => {
              const [summary, parsed, revert, entries] = await Promise.all([
                storageGet<SaveSummary>(KEYS.summary(id)),
                storageGet<ParsedSave>(KEYS.parsed(id)),
                storageGet<RevertPoint>(KEYS.revert(id)),
                storageGet<HistoryEntry[]>(KEYS.history(id)),
              ]);
              if (entries) history[id] = entries;
              if (summary) summaries[id] = summary;
              if (parsed) fullSaves[id] = parsed;
              if (revert) reverts[id] = revert;
            }));
          } catch {
            // Device storage unavailable — carry on with whatever is in memory
          }
          // Anything imported while this was loading is newer than what was stored
          set((s) => ({
            summaries: { ...summaries, ...s.summaries },
            fullSaves: { ...fullSaves, ...s.fullSaves },
            reverts: { ...reverts, ...s.reverts },
            history: { ...history, ...s.history },
            hydrated: true,
          }));
        })();
        return hydration;
      },

      saveImport: (parsed, bytes, fileName) => {
        const id = profileIdOf(parsed);
        const summary = toSummary(parsed);
        const existing = get().profiles.find((p) => p.id === id);
        const detected = detectStartBox(parsed.mons, parsed.boxNames);
        const profile: SaveProfile = {
          id,
          label: existing?.label ?? `${parsed.game} · ${parsed.trainer.name || "Trainer"}`,
          role: existing?.role ?? (detected.placed >= LIVING_DEX_MIN_PLACED ? "living-dex" : "playthrough"),
          startBox: existing?.startBox ?? detected.startBox,
          ...(existing?.ownOnly ? { ownOnly: true } : {}),
          fileName,
          importedAt: stampNow(Math.max(existing?.importedAt ?? 0, get().removedProfiles[id] ?? 0) || undefined),
          saveCount: parsed.saveCount,
          family: parsed.family,
          trainer: parsed.trainer,
          ...((gameVersionOf(parsed.game) ?? existing?.game) ? { game: gameVersionOf(parsed.game) ?? existing!.game } : {}),
          ...(parsed.progress?.playTime
            ? { playTime: { hours: parsed.progress.playTime.hours, minutes: parsed.progress.playTime.minutes } }
            : existing?.playTime ? { playTime: existing.playTime } : {}),
        };
        // What changed since the previous import of this save
        const since = diffSaves(get().fullSaves[id], parsed, profile, genConfigOf(parsed.family).maxSpecies, profile.importedAt);
        const entries = hasChanges(since) ? [since, ...(get().history[id] ?? [])].slice(0, HISTORY_LIMIT) : get().history[id] ?? [];
        set((s) => ({
          profiles: existing ? s.profiles.map((p) => (p.id === id ? profile : p)) : [...s.profiles, profile],
          // Importing a save again brings it back
          removedProfiles: Object.fromEntries(Object.entries(s.removedProfiles).filter(([k]) => k !== id)),
          activeProfileId: id,
          summaries: { ...s.summaries, [id]: summary },
          fullSaves: { ...s.fullSaves, [id]: parsed },
          history: { ...s.history, [id]: entries },
          todoChecks: {},
        }));
        requestPersistentStorage();
        // The raw bytes are kept (as a copy) so a later parser fix can re-read them
        void Promise.all([
          storageSet(KEYS.history(id), entries),
          storageSet(KEYS.raw(id), { fileName, bytes: bytes.slice() } satisfies RawSave),
          storageSet(KEYS.parsed(id), parsed),
          storageSet(KEYS.summary(id), summary),
        ]).then(
          () => set({ storageFailed: false }),
          // The save is usable now but won't be there after a reload — the view says so
          () => set({ storageFailed: true }),
        );
        return { profile, since };
      },

      updateProfile: (id, patch) =>
        set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

      removeProfile: (id) => {
        set((s) => {
          const without = <T,>(rec: Record<string, T>) => Object.fromEntries(Object.entries(rec).filter(([k]) => k !== id));
          const profiles = s.profiles.filter((p) => p.id !== id);
          return {
            profiles,
            removedProfiles: { ...s.removedProfiles, [id]: stampNow(s.profiles.find((p) => p.id === id)?.importedAt) },
            activeProfileId: s.activeProfileId === id ? profiles[0]?.id ?? null : s.activeProfileId,
            summaries: without(s.summaries),
            fullSaves: without(s.fullSaves),
            reverts: without(s.reverts),
            history: without(s.history),
          };
        });
        deleteStoredProfile(id);
      },

      setActiveProfile: (id) => set({ activeProfileId: id }),

      replaceAll: (profiles, summaries, removed) => {
        const kept = new Set(profiles.map((p) => p.id));
        const gone = get().profiles.map((p) => p.id).filter((id) => !kept.has(id));
        const now = stampNow();
        const only = <T,>(rec: Record<string, T>) => Object.fromEntries(Object.entries(rec).filter(([id]) => kept.has(id)));
        set((s) => ({
          profiles,
          summaries,
          removedProfiles: removed ?? { ...s.removedProfiles, ...Object.fromEntries(gone.map((id) => [id, now])) },
          fullSaves: only(s.fullSaves),
          reverts: only(s.reverts),
          history: only(s.history),
          activeProfileId: profiles.some((p) => p.id === s.activeProfileId) ? s.activeProfileId : profiles[0]?.id ?? null,
        }));
        for (const [id, summary] of Object.entries(summaries)) {
          void storageSet(KEYS.summary(id), summary).catch(() => {});
        }
        gone.forEach(deleteStoredProfile);
      },

      setRevert: (id, point) => {
        set((s) => {
          const reverts = { ...s.reverts };
          if (point) reverts[id] = point;
          else delete reverts[id];
          return { reverts };
        });
        void (point ? storageSet(KEYS.revert(id), point) : storageDelete(KEYS.revert(id))).catch(() => {});
      },

      rereadAll: async () => {
        let reread = 0;
        let failed = 0;
        // Loaded here rather than at the top: the parsers bring the save tables
        // (~60 kB), and this store is part of every page load (sync reads it)
        const { parseSave } = await import("../lib/save/parse");
        for (const profile of get().profiles) {
          const raw = await storageGet<RawSave>(KEYS.raw(profile.id)).catch(() => undefined);
          if (!raw) continue; // imported on another device — nothing to re-read here
          try {
            const parsed = parseSave(raw.bytes);
            const summary = toSummary(parsed);
            set((s) => ({
              profiles: s.profiles.map((p) => (p.id === profile.id ? { ...p, saveCount: parsed.saveCount } : p)),
              summaries: { ...s.summaries, [profile.id]: summary },
              fullSaves: { ...s.fullSaves, [profile.id]: parsed },
            }));
            await storageSet(KEYS.parsed(profile.id), parsed);
            await storageSet(KEYS.summary(profile.id), summary);
            reread++;
          } catch {
            failed++;
          }
        }
        return { reread, failed };
      },
    }),
    {
      name: "save-profiles-v1",
      // Only the small metadata goes to localStorage; everything else is in IndexedDB
      partialize: (state) => ({ profiles: state.profiles, removedProfiles: state.removedProfiles, activeProfileId: state.activeProfileId }),
    },
  ),
);

void useSaveStore.getState().hydrate();
