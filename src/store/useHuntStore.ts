import { createEntryStore } from "./createEntryStore";
import type { HuntMethod } from "../lib/shiny-odds";

/** One shiny hunt. */
export interface ShinyHunt {
  generation: number;
  pokemonId: number;
  method: HuntMethod;
  /** Encounters, resets or eggs so far — or the current chain, for the Poké Radar */
  count: number;
  startedAt: number;
  /** Set when the shiny was found */
  foundAt?: number;
}

/** Shiny hunts, keyed by a generated id. Synced as the `shinyHunts` section, merged hunt by hunt. */
export const useHuntStore = createEntryStore<ShinyHunt>("pokedex-hunts-v1");

export const newHuntId = () => `hunt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function startHunt(generation: number, pokemonId: number, method: HuntMethod): void {
  useHuntStore.getState().put(newHuntId(), { generation, pokemonId, method, count: 0, startedAt: Date.now() });
}

/** Changes a hunt that still exists. The entry's sync fields (at, removed) are rewritten by put(). */
export function updateHunt(id: string, patch: Partial<ShinyHunt>): void {
  const entry = useHuntStore.getState().entries[id];
  if (!entry || entry.removed) return;
  const { generation, pokemonId, method, count, startedAt, foundAt } = { ...entry, ...patch };
  useHuntStore.getState().put(id, { generation, pokemonId, method, count, startedAt, ...(foundAt !== undefined ? { foundAt } : {}) });
}

export const markHuntFound = (id: string) => updateHunt(id, { foundAt: Date.now() });
