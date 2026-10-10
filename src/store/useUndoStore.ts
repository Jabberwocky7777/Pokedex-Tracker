import { create } from "zustand";

export interface UndoToast {
  id: number;
  message: string;
  undo: () => void;
}

interface UndoStore {
  toast: UndoToast | null;
  /** Shows "<message> · Undo". A newer toast replaces the current one. */
  show: (message: string, undo: () => void) => void;
  dismiss: () => void;
}

let nextId = 0;

/** Non-persisted store behind the undo toast (see UndoToast and lib/dex-actions). */
export const useUndoStore = create<UndoStore>()((set) => ({
  toast: null,
  show: (message, undo) => set({ toast: { id: ++nextId, message, undo } }),
  dismiss: () => set({ toast: null }),
}));
