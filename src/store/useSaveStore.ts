import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GenSnapshot } from "./useDexStore";
import { parseGen4Save } from "../lib/save/gen4";
import { detectStartBox } from "../lib/save/living-dex";
import { KEYS, requestPersistentStorage, storageDelete, storageGet, storageSet } from "../lib/save/storage";
import { toSummary } from "../lib/save/summary";
import type { ParsedSave, SaveProfile, SaveSummary } from "../lib/save/types";

/** Auto-detect calls a save a living dex once this many Pokémon sit in their own slot. */
const LIVING_DEX_MIN_PLACED = 30;

export interface RevertPoint {
  /** When the import was applied (epoch ms) */
  at: number;
  gen: number;
  /** Tracker marks from just before it */
  snapshot: GenSnapshot;
}

interface RawSave {
  fileName: string;
  bytes: Uint8Array;
}

/** Which part of the Saves view is open. */
export type SavesPanel = "boxes" | "todo" | "plan" | "search" | "history";

export const profileIdOf = (save: Pick<ParsedSave, "family" | "trainer">): string =>
  `${save.family}-${save.trainer.tid}-${save.trainer.sid}`;

interface SaveStore {
  // ── Persisted to localStorage (small) and synced ──
  profiles: SaveProfile[];
  // ── Persisted to localStorage, per device ──
  activeProfileId: string | null;

  // ── Loaded from IndexedDB by hydrate(); not in localStorage ──
  /** Slim per-Pokémon view of each save. Synced, so other devices have it too. */
  summaries: Record<string, SaveSummary>;
  /** Fully parsed saves — only for profiles imported on this device. */
  fullSaves: Record<string, ParsedSave>;
  /** Tracker marks from before each profile's last applied import. */
  reverts: Record<string, RevertPoint>;
  hydrated: boolean;

  // ── In memory only ──
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
  saveImport: (parsed: ParsedSave, bytes: Uint8Array, fileName: string) => SaveProfile;
  updateProfile: (id: string, patch: Partial<Pick<SaveProfile, "label" | "role" | "startBox" | "ownOnly">>) => void;
  removeProfile: (id: string) => void;
  setActiveProfile: (id: string | null) => void;
  /** Replaces profiles and summaries wholesale (sync, backup restore). */
  replaceAll: (profiles: SaveProfile[], summaries: Record<string, SaveSummary>) => void;
  setRevert: (id: string, point: RevertPoint | null) => void;
  /** Re-parses every stored .sav with the current parser (after a parser fix). */
  rereadAll: () => Promise<{ reread: number; failed: number }>;
}

let hydration: Promise<void> | null = null;

export const useSaveStore = create<SaveStore>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeProfileId: null,
      summaries: {},
      fullSaves: {},
      reverts: {},
      hydrated: false,

      panel: "boxes",
      setPanel: (panel) => set({ panel }),
      todoChecks: {},
      toggleTodoCheck: (stepId) => set((s) => ({ todoChecks: { ...s.todoChecks, [stepId]: !s.todoChecks[stepId] } })),

      hydrate: () => {
        hydration ??= (async () => {
          const summaries: Record<string, SaveSummary> = {};
          const fullSaves: Record<string, ParsedSave> = {};
          const reverts: Record<string, RevertPoint> = {};
          try {
            await Promise.all(get().profiles.map(async ({ id }) => {
              const [summary, parsed, revert] = await Promise.all([
                storageGet<SaveSummary>(KEYS.summary(id)),
                storageGet<ParsedSave>(KEYS.parsed(id)),
                storageGet<RevertPoint>(KEYS.revert(id)),
              ]);
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
          importedAt: Date.now(),
          saveCount: parsed.saveCount,
          family: parsed.family,
          trainer: parsed.trainer,
        };
        set((s) => ({
          profiles: existing ? s.profiles.map((p) => (p.id === id ? profile : p)) : [...s.profiles, profile],
          activeProfileId: id,
          summaries: { ...s.summaries, [id]: summary },
          fullSaves: { ...s.fullSaves, [id]: parsed },
          todoChecks: {},
        }));
        requestPersistentStorage();
        // The raw bytes are kept (as a copy) so a later parser fix can re-read them
        void storageSet(KEYS.raw(id), { fileName, bytes: bytes.slice() } satisfies RawSave).catch(() => {});
        void storageSet(KEYS.parsed(id), parsed).catch(() => {});
        void storageSet(KEYS.summary(id), summary).catch(() => {});
        return profile;
      },

      updateProfile: (id, patch) =>
        set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

      removeProfile: (id) => {
        set((s) => {
          const without = <T,>(rec: Record<string, T>) => Object.fromEntries(Object.entries(rec).filter(([k]) => k !== id));
          const profiles = s.profiles.filter((p) => p.id !== id);
          return {
            profiles,
            activeProfileId: s.activeProfileId === id ? profiles[0]?.id ?? null : s.activeProfileId,
            summaries: without(s.summaries),
            fullSaves: without(s.fullSaves),
            reverts: without(s.reverts),
          };
        });
        for (const key of [KEYS.raw(id), KEYS.parsed(id), KEYS.summary(id), KEYS.revert(id)]) {
          void storageDelete(key).catch(() => {});
        }
      },

      setActiveProfile: (id) => set({ activeProfileId: id }),

      replaceAll: (profiles, summaries) => {
        set((s) => ({
          profiles,
          summaries,
          activeProfileId: profiles.some((p) => p.id === s.activeProfileId) ? s.activeProfileId : profiles[0]?.id ?? null,
        }));
        for (const [id, summary] of Object.entries(summaries)) {
          void storageSet(KEYS.summary(id), summary).catch(() => {});
        }
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
        for (const profile of get().profiles) {
          const raw = await storageGet<RawSave>(KEYS.raw(profile.id)).catch(() => undefined);
          if (!raw) continue; // imported on another device — nothing to re-read here
          try {
            const parsed = parseGen4Save(raw.bytes);
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
      partialize: (state) => ({ profiles: state.profiles, activeProfileId: state.activeProfileId }),
    },
  ),
);

void useSaveStore.getState().hydrate();
