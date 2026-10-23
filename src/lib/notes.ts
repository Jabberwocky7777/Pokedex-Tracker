/**
 * Per-Pokémon notes (store/useNotesStore.ts) as lists: which Pokémon have one
 * in a generation, and the rows of the Notes tab's "All notes" section. Pure.
 */
import { liveEntries, type Entries } from "./entries";
import type { PokemonNote } from "../store/useNotesStore";

export interface NoteRow {
  pokemonId: number;
  text: string;
  /** Last edited (epoch ms) */
  at: number;
}

/** The generation's notes that have text, from keys "<generation>:<dex number>". */
export function notesIn(entries: Entries<PokemonNote> | undefined, generation: number): NoteRow[] {
  const prefix = `${generation}:`;
  return liveEntries(entries)
    .filter(([key, note]) => key.startsWith(prefix) && note.text.trim() !== "")
    .map(([key, note]) => ({ pokemonId: Number(key.slice(prefix.length)), text: note.text, at: note.at }));
}

export const notedIdsIn = (entries: Entries<PokemonNote> | undefined, generation: number): number[] =>
  notesIn(entries, generation).map((n) => n.pokemonId);

export type NoteSort = "recent" | "dex";

/** Search (name or note text) and sort. `nameOf` gives a Pokémon's name. */
export function findNotes(rows: readonly NoteRow[], query: string, sort: NoteSort, nameOf: (id: number) => string): NoteRow[] {
  const q = query.trim().toLowerCase();
  const found = q ? rows.filter((r) => r.text.toLowerCase().includes(q) || nameOf(r.pokemonId).toLowerCase().includes(q)) : [...rows];
  return found.sort(sort === "recent" ? (a, b) => b.at - a.at : (a, b) => a.pokemonId - b.pokemonId);
}
