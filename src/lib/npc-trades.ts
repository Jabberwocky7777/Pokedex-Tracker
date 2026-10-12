import type { GameEncounters, LocationEncounter } from "../types";

// In-game (NPC) trades come from PokéAPI as ordinary encounter rows with
// method "trade" — the requirement field says what the NPC wants in return.
// They count as "obtainable" but not "directly catchable", so the helpers here
// let callers tell the two apart.

export interface NpcTradeRow {
  games: string[];
  note: string;
  /** Where the NPC is: the area's slug and name, so the place can link to Routes */
  slug: string;
  location: string;
}

function isTradeOnlyLocation(loc: LocationEncounter): boolean {
  return loc.details.length > 0 && loc.details.every((d) => d.method === "trade");
}

/** True when the Pokémon has any non-trade encounter in one of the given games. */
export function hasNonTradeEncounter(encounters: GameEncounters[], games: readonly string[]): boolean {
  return encounters.some(
    (e) => games.includes(e.version) && e.locations.some((l) => !isTradeOnlyLocation(l)),
  );
}

/** True when the Pokémon can be received in an NPC trade in one of the given games. */
export function hasNpcTrade(encounters: GameEncounters[], games: readonly string[]): boolean {
  return encounters.some(
    (e) => games.includes(e.version) && e.locations.some(isTradeOnlyLocation),
  );
}

/**
 * Splits encounters into wild/gift/static ones (for the location table) and
 * NPC trades (shown as their own cards, grouped across games).
 */
export function splitNpcTrades(
  encounters: GameEncounters[],
  displayName: string,
): { wild: GameEncounters[]; trades: NpcTradeRow[] } {
  const wild: GameEncounters[] = [];
  const byNote = new Map<string, NpcTradeRow>();

  for (const enc of encounters) {
    const locations = enc.locations.filter((l) => !isTradeOnlyLocation(l));
    if (locations.length > 0) wild.push({ ...enc, locations });

    for (const loc of enc.locations.filter(isTradeOnlyLocation)) {
      const wants = loc.details[0].requirement;
      const note = wants
        ? `${loc.locationDisplayName} — ${wants.replace(/^Trade/, "trade")} for ${displayName}`
        : `${loc.locationDisplayName} — in-game trade for ${displayName}`;
      const row = byNote.get(note) ?? { games: [], note, slug: loc.locationAreaSlug, location: loc.locationDisplayName };
      if (!row.games.includes(enc.version)) row.games.push(enc.version);
      byNote.set(note, row);
    }
  }

  return { wild, trades: [...byNote.values()] };
}
