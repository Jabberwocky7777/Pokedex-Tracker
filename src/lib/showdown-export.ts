import { STAT_KEYS, type StatKey } from "./iv-calc";
import { moveDisplayName } from "./move-names";
import type { DesignerSlot } from "../store/useDesignerStore";
import type { Pokemon } from "../types";

const SHOWDOWN_STAT: Record<StatKey, string> = {
  hp: "HP", atk: "Atk", def: "Def",
  spAtk: "SpA", spDef: "SpD", spe: "Spe",
};

/** A Designer slot in Pokémon Showdown's import/export text format. */
export function buildShowdownExport(slot: DesignerSlot, pokemon: Pokemon): string {
  const lines: string[] = [];

  // Showdown reads a bare name as the species, so a nickname needs the species after it
  const nickname = slot.nickname.trim();
  let header = nickname && nickname !== pokemon.displayName
    ? `${nickname} (${pokemon.displayName})`
    : pokemon.displayName;
  if (slot.item) header += ` @ ${slot.item}`;
  lines.push(header);

  if (slot.ability) {
    const abilityObj = pokemon.abilities?.find((a) => a.name === slot.ability);
    lines.push(`Ability: ${abilityObj?.displayName ?? slot.ability}`);
  }

  lines.push(`Level: ${slot.level}`);

  const evParts = STAT_KEYS
    .filter((k) => (slot.evAllocation[k] ?? 0) > 0)
    .map((k) => `${slot.evAllocation[k]} ${SHOWDOWN_STAT[k]}`);
  if (evParts.length > 0) lines.push(`EVs: ${evParts.join(" / ")}`);

  lines.push(`${slot.natureName} Nature`);

  const ivParts = STAT_KEYS
    .filter((k) => slot.confirmedIVs[k] != null && slot.confirmedIVs[k] !== 31)
    .map((k) => `${slot.confirmedIVs[k]} ${SHOWDOWN_STAT[k]}`);
  if (ivParts.length > 0) lines.push(`IVs: ${ivParts.join(" / ")}`);

  for (const move of slot.selectedMoves) {
    if (move) lines.push(`- ${moveDisplayName(move)}`);
  }

  return lines.join("\n");
}
