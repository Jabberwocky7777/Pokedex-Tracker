/**
 * Battle Tower sets: their stats at a trainer's IVs, and a set as a
 * CalcPokemon for the damage calculator. Tower Pokémon are level 50 and share
 * 510 EVs equally among the stats their set names (at most 255 each).
 */
import type { Pokemon } from "../types";
import type { BattleTowerSet, CalcPokemon, CalcStats } from "../types/battleTower";
import { calcHPStat, calcStat, NATURES, type StatKey } from "./iv-calc";

const TOWER_LEVEL = 50;
const SHEDINJA = 292;

/** The stat labels an `evSpread` uses ("HP/SpA"), in the order they are written */
const SPREAD_STATS: Array<[label: string, calc: keyof CalcStats, base: StatKey]> = [
  ["HP", "hp", "hp"],
  ["Atk", "atk", "atk"],
  ["Def", "def", "def"],
  ["SpA", "spa", "spAtk"],
  ["SpD", "spd", "spDef"],
  ["Spe", "spe", "spe"],
];

/** The EVs a set's spread gives each stat */
export function towerEvs(evSpread: string): CalcStats {
  const named = new Set(evSpread.split("/").map((s) => s.trim()).filter(Boolean));
  const each = named.size ? Math.min(255, Math.floor(510 / named.size)) : 0;
  const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  for (const [label, key] of SPREAD_STATS) if (named.has(label)) evs[key] = each;
  return evs;
}

/** A set's stats at level 50 with every IV at `iv` (the trainer's IV tier) */
export function towerStats(
  set: Pick<BattleTowerSet, "nature" | "evSpread">,
  pokemon: Pick<Pokemon, "id" | "baseStats">,
  iv: number,
): CalcStats {
  const evs = towerEvs(set.evSpread);
  const nature = NATURES.find((n) => n.name.toLowerCase() === set.nature.toLowerCase());
  const stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  for (const [, key, base] of SPREAD_STATS) {
    const b = pokemon.baseStats[base];
    if (key === "hp") {
      stats.hp = pokemon.id === SHEDINJA ? 1 : calcHPStat(b, iv, evs.hp, TOWER_LEVEL);
    } else {
      const mult = nature?.plus === base ? 1.1 : nature?.minus === base ? 0.9 : 1;
      stats[key] = calcStat(b, iv, evs[key], TOWER_LEVEL, mult);
    }
  }
  return stats;
}

/** A species name for matching: case and the two kinds of apostrophe ("Farfetch’d") don't count */
export function speciesKey(name: string): string {
  return name.toLowerCase().replace(/’/g, "'");
}

export function towerPokemon(set: BattleTowerSet, allPokemon: Pokemon[]): Pokemon | undefined {
  const key = speciesKey(set.species);
  return allPokemon.find((p) => speciesKey(p.displayName) === key);
}

/**
 * The set as a damage-calc Pokémon. `iv` is the trainer's IV tier (31 when
 * there is no trainer). A species with only one possible ability gets it, so
 * the calculator can apply Pure Power and the like; otherwise it is left blank.
 * Moves start without power; the calculator looks them up.
 */
export function towerSetToCalcPokemon(set: BattleTowerSet, allPokemon: Pokemon[], iv = 31): CalcPokemon {
  const pokemon = towerPokemon(set, allPokemon);
  const stats = pokemon ? towerStats(set, pokemon, iv) : set.stats;
  const abilities = pokemon?.abilities ?? [];
  return {
    source: "tower-set",
    species: set.species,
    types: (pokemon?.types ?? ["normal"]) as [string] | [string, string],
    level: TOWER_LEVEL,
    nature: set.nature,
    ability: abilities.length === 1 ? abilities[0].displayName : "",
    item: set.item,
    status: "none",
    stats,
    moves: set.moves.map((name) => ({ name, power: 0, type: "normal", category: "physical" as const })),
    currentHp: stats.hp,
  };
}
