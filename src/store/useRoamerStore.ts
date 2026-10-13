import { createEntryStore } from "./createEntryStore";

/** One roaming Pokémon in one game: has the player met it yet? (Caught comes from the tracker's own mark.) */
export interface RoamerStatus {
  met: boolean;
}

/** Key for a roamer: the game it roams in and its dex number. */
export const roamerKey = (game: string, pokemonId: number) => `${game}:${pokemonId}`;

/** Roaming-legendary statuses, per game. Synced as the `roamers` section. */
export const useRoamerStore = createEntryStore<RoamerStatus>("pokedex-roamers-v1");
