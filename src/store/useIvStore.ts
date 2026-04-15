import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StatKey } from "../lib/iv-calc";

export interface IvSession {
  id: string;
  name: string;
  pokemonId: number;
  pokemonName: string;
  pokemonSprite: string;
  natureName: string;
  evs: Record<StatKey, number>;
  entries: { level: number; stats: Record<StatKey, string> }[];
  savedAt: number;
}

interface IvStore {
  savedSessions: IvSession[];
  saveSession: (session: IvSession) => void;
  deleteSession: (id: string) => void;
}

export const useIvStore = create<IvStore>()(
  persist(
    (set) => ({
      savedSessions: [],
      saveSession: (session) =>
        set((state) => ({
          savedSessions: [session, ...state.savedSessions.filter((s) => s.id !== session.id)],
        })),
      deleteSession: (id) =>
        set((state) => ({
          savedSessions: state.savedSessions.filter((s) => s.id !== id),
        })),
    }),
    { name: "iv-checker-pc-box-v1" }
  )
);
