import { moveDisplayName } from "./move-names";
/**
 * Converts a DesignerSlot into a CalcPokemon suitable for the damage calculator.
 */

import type { DesignerSlot } from "../store/useDesignerStore";
import type { Pokemon } from "../types";
import type { CalcPokemon, CalcStats } from "../types/battleTower";
import { computeStat } from "./damage-calc";
import { UNKNOWN_IV } from "./stat-calc";

export function designerSlotToCalcPokemon(slot: DesignerSlot, allPokemon: Pokemon[]): CalcPokemon | null {
  if (!slot.pokemonId) return null;

  const pokemon = allPokemon.find((p) => p.id === slot.pokemonId);
  if (!pokemon) return null;

  const baseStats = pokemon.baseStats;
  if (!baseStats) return null;

  const level = slot.level ?? 50;
  const nature = slot.natureName ?? "Hardy";

  // IV resolution: use confirmed IVs, fall back to inferred, then the same default the Designer shows
  const ivOf = (key: string): number => {
    const confirmed = slot.confirmedIVs?.[key as keyof typeof slot.confirmedIVs];
    if (confirmed != null) return confirmed;
    const inferred = slot.inferredIVs?.[key as keyof typeof slot.inferredIVs];
    if (inferred != null) return inferred;
    return UNKNOWN_IV;
  };

  const evOf = (key: string): number =>
    slot.evAllocation?.[key as keyof typeof slot.evAllocation] ?? 0;

  // Compute final stats using the Gen 4 formula
  const stats: CalcStats = {
    hp:  computeStat("hp",  baseStats.hp,  ivOf("hp"),  evOf("hp"),  nature, level),
    atk: computeStat("atk", baseStats.atk, ivOf("atk"), evOf("atk"), nature, level),
    def: computeStat("def", baseStats.def, ivOf("def"), evOf("def"), nature, level),
    spa: computeStat("spa", baseStats.spAtk ?? 0, ivOf("spAtk"), evOf("spAtk"), nature, level),
    spd: computeStat("spd", baseStats.spDef ?? 0, ivOf("spDef"), evOf("spDef"), nature, level),
    spe: computeStat("spe", baseStats.spe, ivOf("spe"), evOf("spe"), nature, level),
  };

  // Designer slots hold slugs; the calc shows and looks moves up by name ("U-turn")
  const moves = (slot.selectedMoves ?? []).map((slug) => ({
    name: slug ? moveDisplayName(slug) : "",
    power: 0,
    type: "normal",
    category: "special" as const,
  }));

  const types = pokemon.types as [string] | [string, string];

  return {
    source: "designer",
    species: pokemon.displayName,
    types,
    level,
    nature,
    ability: slot.ability ?? "",
    item: slot.item ?? "",
    status: "none",
    stats,
    moves,
    currentHp: stats.hp,
  };
}
