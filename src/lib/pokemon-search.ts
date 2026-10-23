import type { Pokemon } from "../types";

/**
 * Tracker search syntax. Terms are separated by spaces and must all match.
 *
 *   gengar        name contains "gengar"
 *   94  #094      dex number (the regional number in a regional dex mode)
 *   ghost         type name
 *   caught:yes    caught:no · shiny:yes · shiny:no · pending:yes · pending:no
 *   note:yes      has a note in this generation (note:no: has none)
 */
export const SEARCH_PLACEHOLDER = "Name, #094, ghost, caught:no…";
/** For a phone's narrower box; the title still has the whole syntax */
export const SEARCH_PLACEHOLDER_SHORT = "Name, #094 or type…";
export const SEARCH_HELP =
  "Search by name, dex number (94 or #094), type (ghost), or caught:yes / caught:no / shiny:yes / pending:yes / note:yes. Combine terms with spaces.";

const TYPE_NAMES = new Set([
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground",
  "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel",
]);

type FlagField = "caught" | "shiny" | "pending" | "note";

/** Accepted spellings for the value of a flag such as caught:yes (shared with the box search). */
export const YES = new Set(["yes", "y", "true", "1"]);
export const NO = new Set(["no", "n", "false", "0"]);

export type SearchTerm =
  | { kind: "flag"; field: FlagField; value: boolean }
  | { kind: "number"; value: number; text: string }
  | { kind: "type"; value: string }
  | { kind: "name"; value: string };

export function parseSearch(query: string): SearchTerm[] {
  const terms: SearchTerm[] = [];
  for (const token of query.trim().toLowerCase().split(/\s+/)) {
    if (!token) continue;

    const flag = token.match(/^(caught|shiny|pending|note):(.*)$/);
    if (flag && (YES.has(flag[2]) || NO.has(flag[2]))) {
      terms.push({ kind: "flag", field: flag[1] as FlagField, value: YES.has(flag[2]) });
      continue;
    }

    const num = token.match(/^#?(\d+)$/);
    if (num) {
      terms.push({ kind: "number", value: parseInt(num[1], 10), text: num[1] });
      continue;
    }

    if (TYPE_NAMES.has(token)) {
      terms.push({ kind: "type", value: token });
      continue;
    }

    terms.push({ kind: "name", value: token });
  }
  return terms;
}

export interface SearchContext {
  /** The number shown for this Pokémon — regional in a regional dex mode, national otherwise. */
  displayNumber: number;
  caught: ReadonlySet<number>;
  pending: ReadonlySet<number>;
  shiny: ReadonlySet<number>;
  /** Pokémon with a note in this generation (note:yes) */
  noted?: ReadonlySet<number>;
}

export function matchesSearch(pokemon: Pokemon, terms: SearchTerm[], ctx: SearchContext): boolean {
  const name = pokemon.displayName.toLowerCase();
  return terms.every((term) => {
    switch (term.kind) {
      case "flag":
        return (term.field === "note" ? ctx.noted?.has(pokemon.id) ?? false : ctx[term.field].has(pokemon.id)) === term.value;
      case "number":
        // Also allow digits inside a name (Porygon2)
        return ctx.displayNumber === term.value || name.includes(term.text);
      case "type":
        return pokemon.types.includes(term.value) || name.includes(term.value);
      case "name":
        return name.includes(term.value);
    }
  });
}
