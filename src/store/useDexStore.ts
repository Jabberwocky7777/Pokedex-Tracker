import { create } from "zustand";
import { persist } from "zustand/middleware";

type GenRecord = Record<number, number[]>;

// placed = sits in its own slot in the living dex (see lib/save/living-dex.ts)
export type DexField = "caught" | "pending" | "shiny" | "placed";
export const DEX_FIELDS: DexField[] = ["caught", "pending", "shiny", "placed"];

/** One proposed change to a mark — what a save import applies in bulk. */
export interface MarkChange {
  field: DexField;
  id: number;
  value: boolean;
}

/**
 * Per-entry "last changed" times: updatedAt[field][gen][id] = epoch ms.
 * Written on every mark AND un-mark so sync can merge two devices entry by
 * entry (newer wins) instead of one snapshot overwriting the other.
 * An entry with no timestamp counts as 0.
 */
export type DexTimestamps = Record<DexField, Record<number, Record<number, number>>>;

export interface GenSnapshot {
  caught: number[];
  pending: number[];
  shiny: number[];
  placed: number[];
}

const FIELD_KEY = {
  caught: "caughtByGen",
  pending: "pendingByGen",
  shiny: "shinyByGen",
  placed: "placedByGen",
} as const;

interface DexData {
  caughtByGen: GenRecord;
  pendingByGen: GenRecord;
  shinyByGen: GenRecord;
  placedByGen: GenRecord;
  updatedAt: DexTimestamps;
}

export const emptyTimestamps = (): DexTimestamps => ({ caught: {}, pending: {}, shiny: {}, placed: {} });

/**
 * Sets (or toggles) ids in one field of one generation and stamps each id whose
 * value actually changed. Returns the partial state to merge.
 */
function writeEntries(
  state: DexData,
  field: DexField,
  gen: number,
  ids: number[],
  value: boolean | "toggle",
): Partial<DexData> {
  const key = FIELD_KEY[field];
  const next = new Set(state[key][gen] ?? []);
  const stamps = { ...(state.updatedAt[field]?.[gen] ?? {}) };
  const now = Date.now();
  let changed = false;

  for (const id of ids) {
    const has = next.has(id);
    const want = value === "toggle" ? !has : value;
    if (has === want) continue;
    if (want) next.add(id);
    else next.delete(id);
    stamps[id] = now;
    changed = true;
  }
  if (!changed) return {};

  return {
    [key]: { ...state[key], [gen]: Array.from(next) },
    updatedAt: { ...state.updatedAt, [field]: { ...state.updatedAt[field], [gen]: stamps } },
  };
}

/** Makes one generation of one field equal `ids`, stamping only the entries that change. */
function replaceEntries(state: DexData, field: DexField, gen: number, ids: number[]): Partial<DexData> {
  const current = new Set(state[FIELD_KEY[field]][gen] ?? []);
  const want = new Set(ids);
  const differing = [...current].filter((id) => !want.has(id)).concat(ids.filter((id) => !current.has(id)));
  return writeEntries(state, field, gen, differing, "toggle");
}

function dataOf(state: DexData): DexData {
  return {
    caughtByGen: state.caughtByGen,
    pendingByGen: state.pendingByGen,
    shinyByGen: state.shinyByGen,
    placedByGen: state.placedByGen,
    updatedAt: state.updatedAt,
  };
}

interface DexStore extends DexData {
  toggleCaught: (id: number, gen: number) => void;
  setCaught: (id: number, value: boolean, gen: number) => void;
  isCaught: (id: number, gen: number) => boolean;

  // Pokémon obtained (e.g. have a Pidgey) but slot needs evolution (Pidgeotto)
  togglePending: (id: number, gen: number) => void;
  setPending: (id: number, value: boolean, gen: number) => void;
  isPending: (id: number, gen: number) => boolean;

  toggleShiny: (id: number, gen: number) => void;
  setShiny: (id: number, value: boolean, gen: number) => void;
  isShiny: (id: number, gen: number) => boolean;

  togglePlaced: (id: number, gen: number) => void;
  setPlaced: (id: number, value: boolean, gen: number) => void;
  isPlaced: (id: number, gen: number) => boolean;

  /** Applies a batch of mark changes to one generation in a single update, stamping each entry that changes. */
  applyMarks: (gen: number, changes: MarkChange[]) => void;

  /** Un-marks everything (caught, pending, shiny and placed) for one generation. */
  clearAll: (gen: number) => void;
  /** The current marks for one generation — pass back to restoreGen() to undo a clear. */
  getGenSnapshot: (gen: number) => GenSnapshot;
  /** Makes one generation match a snapshot, stamping every entry that changes. */
  restoreGen: (gen: number, snapshot: GenSnapshot) => void;
  /** Replaces all marks (backup restore). Every entry that changes is stamped now, so the restore wins in sync. */
  importTracker: (data: { caughtByGen: GenRecord; pendingByGen: GenRecord; shinyByGen?: GenRecord; placedByGen?: GenRecord }) => void;
}

export const useDexStore = create<DexStore>()(
  persist(
    (set, get) => ({
      caughtByGen: {},
      pendingByGen: {},
      shinyByGen: {},
      placedByGen: {},
      updatedAt: emptyTimestamps(),

      toggleCaught: (id, gen) => set((state) => writeEntries(state, "caught", gen, [id], "toggle")),
      setCaught: (id, value, gen) => set((state) => writeEntries(state, "caught", gen, [id], value)),
      isCaught: (id, gen) => (get().caughtByGen[gen] ?? []).includes(id),

      togglePending: (id, gen) => set((state) => writeEntries(state, "pending", gen, [id], "toggle")),
      setPending: (id, value, gen) => set((state) => writeEntries(state, "pending", gen, [id], value)),
      isPending: (id, gen) => (get().pendingByGen[gen] ?? []).includes(id),

      toggleShiny: (id, gen) => set((state) => writeEntries(state, "shiny", gen, [id], "toggle")),
      setShiny: (id, value, gen) => set((state) => writeEntries(state, "shiny", gen, [id], value)),
      isShiny: (id, gen) => (get().shinyByGen[gen] ?? []).includes(id),

      togglePlaced: (id, gen) => set((state) => writeEntries(state, "placed", gen, [id], "toggle")),
      setPlaced: (id, value, gen) => set((state) => writeEntries(state, "placed", gen, [id], value)),
      isPlaced: (id, gen) => (get().placedByGen[gen] ?? []).includes(id),

      applyMarks: (gen, changes) =>
        set((state) => {
          let next = dataOf(state);
          for (const field of DEX_FIELDS) {
            for (const value of [true, false]) {
              const ids = changes.filter((c) => c.field === field && c.value === value).map((c) => c.id);
              if (ids.length > 0) next = { ...next, ...writeEntries(next, field, gen, ids, value) };
            }
          }
          return next;
        }),

      clearAll: (gen) => get().restoreGen(gen, { caught: [], pending: [], shiny: [], placed: [] }),

      getGenSnapshot: (gen) => {
        const s = get();
        return {
          caught: [...(s.caughtByGen[gen] ?? [])],
          pending: [...(s.pendingByGen[gen] ?? [])],
          shiny: [...(s.shinyByGen[gen] ?? [])],
          placed: [...(s.placedByGen[gen] ?? [])],
        };
      },

      restoreGen: (gen, snapshot) =>
        set((state) => {
          let next = dataOf(state);
          for (const field of DEX_FIELDS) {
            next = { ...next, ...replaceEntries(next, field, gen, snapshot[field] ?? []) };
          }
          return next;
        }),

      importTracker: (data) =>
        set((state) => {
          const incoming: Record<DexField, GenRecord> = {
            caught: data.caughtByGen ?? {},
            pending: data.pendingByGen ?? {},
            shiny: data.shinyByGen ?? {},
            placed: data.placedByGen ?? {},
          };
          let next = dataOf(state);
          for (const field of DEX_FIELDS) {
            const gens = new Set([
              ...Object.keys(state[FIELD_KEY[field]]).map(Number),
              ...Object.keys(incoming[field]).map(Number),
            ]);
            for (const gen of gens) {
              next = { ...next, ...replaceEntries(next, field, gen, incoming[field][gen] ?? []) };
            }
          }
          return next;
        }),
    }),
    {
      name: "pokedex-tracker-v2",
      partialize: (state) => ({
        caughtByGen: state.caughtByGen,
        pendingByGen: state.pendingByGen,
        shinyByGen: state.shinyByGen,
        placedByGen: state.placedByGen,
        updatedAt: state.updatedAt,
      }),
      onRehydrateStorage: () => {
        return (_state, error) => {
          if (error) return;
          // Migrate from old pokedex-tracker-v1 (flat caught/pending arrays → gen 3 bucket)
          try {
            const v1Raw = localStorage.getItem("pokedex-tracker-v1");
            if (v1Raw) {
              const v1Data = JSON.parse(v1Raw);
              const caught: number[] = v1Data?.state?.caught ?? [];
              const pending: number[] = v1Data?.state?.pending ?? [];
              if (caught.length > 0 || pending.length > 0) {
                // Only migrate if gen 3 bucket is currently empty. Deferred because the
                // store constant isn't assigned yet while persist rehydrates; nothing
                // else (sync awaits the network first) can run before this timer.
                setTimeout(() => {
                  const current = useDexStore.getState();
                  const gen3Caught = current.caughtByGen[3] ?? [];
                  if (gen3Caught.length === 0) {
                    useDexStore.setState((s) => ({
                      caughtByGen: { ...s.caughtByGen, 3: caught },
                      pendingByGen: { ...s.pendingByGen, 3: pending },
                    }));
                  }
                }, 0);
              }
              localStorage.removeItem("pokedex-tracker-v1");
            }
          } catch {
            // Unreadable v1 data is left where it is; the user starts from the v2 state
          }
        };
      },
    }
  )
);
