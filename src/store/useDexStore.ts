import { create } from "zustand";
import { persist } from "zustand/middleware";

type GenRecord = Record<number, number[]>;

/** Returns a Zustand set-updater that toggles an id in/out of a per-generation array. */
function makeToggle(field: "caughtByGen" | "pendingByGen") {
  return (id: number, gen: number, state: { caughtByGen: GenRecord; pendingByGen: GenRecord }) => {
    const current = state[field][gen] ?? [];
    const s = new Set(current);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    return { [field]: { ...state[field], [gen]: Array.from(s) } };
  };
}

interface DexStore {
  caughtByGen: Record<number, number[]>;
  toggleCaught: (id: number, gen: number) => void;
  setCaught: (id: number, value: boolean, gen: number) => void;
  isCaught: (id: number, gen: number) => boolean;
  clearAll: (gen: number) => void;

  // Pokémon obtained (e.g. have a Pidgey) but slot needs evolution (Pidgeotto)
  pendingByGen: Record<number, number[]>;
  togglePending: (id: number, gen: number) => void;
  setPending: (id: number, value: boolean, gen: number) => void;
  isPending: (id: number, gen: number) => boolean;
}

export const useDexStore = create<DexStore>()(
  persist(
    (set, get) => ({
      caughtByGen: {},

      toggleCaught: (id, gen) => set((state) => makeToggle("caughtByGen")(id, gen, state)),

      setCaught: (id, value, gen) =>
        set((state) => {
          const current = state.caughtByGen[gen] ?? [];
          const s = new Set(current);
          if (value) {
            s.add(id);
          } else {
            s.delete(id);
          }
          return { caughtByGen: { ...state.caughtByGen, [gen]: Array.from(s) } };
        }),

      isCaught: (id, gen) => (get().caughtByGen[gen] ?? []).includes(id),

      clearAll: (gen) =>
        set((state) => ({
          caughtByGen: { ...state.caughtByGen, [gen]: [] },
          pendingByGen: { ...state.pendingByGen, [gen]: [] },
        })),

      pendingByGen: {},

      togglePending: (id, gen) => set((state) => makeToggle("pendingByGen")(id, gen, state)),

      setPending: (id, value, gen) =>
        set((state) => {
          const current = state.pendingByGen[gen] ?? [];
          const s = new Set(current);
          if (value) {
            s.add(id);
          } else {
            s.delete(id);
          }
          return { pendingByGen: { ...state.pendingByGen, [gen]: Array.from(s) } };
        }),

      isPending: (id, gen) => (get().pendingByGen[gen] ?? []).includes(id),
    }),
    {
      name: "pokedex-tracker-v2",
      partialize: (state) => ({
        caughtByGen: state.caughtByGen,
        pendingByGen: state.pendingByGen,
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
                // Only migrate if gen 3 bucket is currently empty
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
            // Migration failed silently — no data loss, user just starts fresh
          }
        };
      },
    }
  )
);
