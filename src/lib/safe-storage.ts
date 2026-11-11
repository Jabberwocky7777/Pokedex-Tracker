import { create } from "zustand";
import { createJSONStorage, type StateStorage } from "zustand/middleware";

/**
 * localStorage that never throws. When the browser refuses a write (storage
 * full, blocked, some private modes), zustand's persist would throw out of the
 * action that changed the state, after the change was already made in memory:
 * the edit looks saved and is gone on reload. Here the write fails quietly and
 * `useStorageHealth` says so, for the banner in App.tsx (like the Saves view's
 * `storageFailed`).
 */
export const useStorageHealth = create<{ writeFailed: boolean }>(() => ({ writeFailed: false }));

function noteFailure() {
  if (!useStorageHealth.getState().writeFailed) useStorageHealth.setState({ writeFailed: true });
}

/** localStorage.setItem that reports a failure instead of throwing. True when the value was written. */
export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    noteFailure();
    return false;
  }
}

const guarded: StateStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    safeSetItem(key, value);
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to remove if storage is unavailable
    }
  },
};

/** The `storage` option for every persisted store. */
export const safeStorage = createJSONStorage(() => guarded);
