import { create } from "zustand";

interface SyncStatus {
  syncing: boolean;
  lastSynced: Date | null;
  /** Goes up by one for every sync that sent or brought in changes */
  changeCount: number;
  error: string | null;
  forcePush: (() => void) | null;
  setSyncing: (v: boolean) => void;
  setLastSynced: (d: Date) => void;
  noteChange: () => void;
  setError: (e: string | null) => void;
  setForcePush: (fn: (() => void) | null) => void;
}

/** Non-persisted store for sync UI state. Consumed by SyncDot and useSyncEngine. */
export const useSyncStatus = create<SyncStatus>()((set) => ({
  syncing: false,
  lastSynced: null,
  changeCount: 0,
  error: null,
  forcePush: null,
  setSyncing: (syncing) => set({ syncing }),
  setLastSynced: (lastSynced) => set({ lastSynced, syncing: false, error: null }),
  noteChange: () => set((s) => ({ changeCount: s.changeCount + 1 })),
  setError: (error) => set({ error, syncing: false }),
  setForcePush: (fn) => set({ forcePush: fn }),
}));
