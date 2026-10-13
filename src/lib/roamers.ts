/**
 * Roaming legendaries: the Pokémon flagged `isRoaming` in the encounter data,
 * per game, with what unlocks them. Pure.
 */
import type { GameVersion, Pokemon } from "../types";

export interface Roamer {
  pokemon: Pokemon;
  game: GameVersion;
  level: number;
  /** What has to happen before it starts roaming, as the data words it */
  unlock: string | null;
}

export function roamersIn(pokemon: readonly Pokemon[], games: readonly GameVersion[]): Roamer[] {
  const found: Roamer[] = [];
  for (const game of games) {
    for (const p of pokemon) {
      const detail = p.encounters.find((e) => e.version === game)?.locations.flatMap((l) => l.details).find((d) => d.isRoaming);
      if (detail) found.push({ pokemon: p, game, level: detail.minLevel, unlock: detail.requirement ?? null });
    }
  }
  return found;
}

export type RoamerState = "caught" | "met" | "roaming";

export function roamerState(caught: boolean, met: boolean): RoamerState {
  return caught ? "caught" : met ? "met" : "roaming";
}

/** The usual advice, for the generation of the games shown. */
export function roamerTips(generation: number): string[] {
  const common = [
    "Meet it once and its location shows on the map" + (generation === 4 ? " (the Pokétch Marking Map in Sinnoh, the Pokégear map in Johto)." : " in its Pokédex entry (Area)."),
    "It moves to a neighbouring route every time you change area, and somewhere at random when you Fly. Crossing back and forth between two routes brings it to you.",
    "Lead with a Pokémon a level or two below the roamer and use a Repel: nothing weaker than your lead appears, so any encounter is the roamer.",
    "It flees on its first turn. Trap it (Mean Look, Block, Wobbuffet's Shadow Tag, Arena Trap) or put it to sleep first. Damage and status stay between encounters.",
  ];
  if (generation === 4) {
    return [...common, "A Quick Ball on the first turn is the best throw; in HeartGold and SoulSilver a Fast Ball works on anything that flees."];
  }
  return [
    ...common,
    "FireRed and LeafGreen: if Raikou or Entei uses Roar it ends the battle and the Pokémon is gone for good — trap it before it can.",
    "In Generation III a roamer that faints does not come back. Save before you start looking.",
  ];
}
