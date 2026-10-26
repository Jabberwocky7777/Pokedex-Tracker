import { create } from "zustand";

/**
 * Pokémon that only one of the selected games can supply (lib/planner.ts
 * soleSources), published by the tracker so every view can tag them "Only in
 * Pt". In memory only; empty with fewer than two games selected.
 */
interface SoleSourceStore {
  byId: ReadonlyMap<number, string>;
  setById: (byId: ReadonlyMap<number, string>) => void;
}

export const useSoleSourceStore = create<SoleSourceStore>()((set) => ({
  byId: new Map(),
  setById: (byId) => set({ byId }),
}));
