import { createEntryStore } from "./createEntryStore";

/** A free-text note on one Pokémon in one generation. */
export interface PokemonNote {
  text: string;
}

export const NOTE_MAX_LENGTH = 2000;

/** Key for a note: the generation whose tracker it belongs to, and the dex number. */
export const noteKey = (generation: number, pokemonId: number) => `${generation}:${pokemonId}`;

/** Per-Pokémon notes. Synced as the `notes` section, merged note by note. */
export const useNotesStore = createEntryStore<PokemonNote>("pokedex-notes-v1");
