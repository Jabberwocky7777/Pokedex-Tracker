import { create } from "zustand";

interface SyncStatus {
  syncing: boolean;
  lastSynced: Date | null;
  error: string | null;
  setSyncing: (v: boolean) => void;
  setLastSynced: (d: Date) => void;
  setError: (e: string | null) => void;
}

/** Non-persisted store for sync UI state. Consumed by SyncIndicator and useSyncEngine. */
export const useSyncStatus = create<SyncStatus>()((set) => ({
  syncing: false,
  lastSynced: null,
  error: null,
  setSyncing: (syncing) => set({ syncing }),
  setLastSynced: (lastSynced) => set({ lastSynced, error: null }),
  setError: (error) => set({ error, syncing: false }),
}));
