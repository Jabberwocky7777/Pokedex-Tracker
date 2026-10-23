import { create } from "zustand";

/**
 * The tracker's progress for what its filters show, published by the tracker
 * so the shared header can show it on a phone. In memory only.
 */
interface TrackerCountStore {
  caught: number;
  pending: number;
  total: number;
  setCounts: (counts: { caught: number; pending: number; total: number }) => void;
}

export const useTrackerCountStore = create<TrackerCountStore>()((set) => ({
  caught: 0,
  pending: 0,
  total: 0,
  setCounts: (counts) => set(counts),
}));
