/**
 * Converts a Battle Tower set into a CalcPokemon for the damage calculator.
 * Tower Pokémon are level 50 and the sets list final stats, so nothing is
 * computed here. Moves start without power; the calculator looks them up.
 */
import type { Pokemon } from "../types";
import type { BattleTowerSet, CalcPokemon } from "../types/battleTower";

export function towerSetToCalcPokemon(set: BattleTowerSet, allPokemon: Pokemon[]): CalcPokemon {
  const pokemon = allPokemon.find((p) => p.displayName.toLowerCase() === set.species.toLowerCase());
  return {
    source: "tower-set",
    species: set.species,
    types: (pokemon?.types ?? ["normal"]) as [string] | [string, string],
    level: 50,
    nature: set.nature,
    ability: "",
    item: set.item,
    status: "none",
    stats: set.stats,
    moves: set.moves.map((name) => ({ name, power: 0, type: "normal", category: "physical" as const })),
    currentHp: set.stats.hp,
  };
}
