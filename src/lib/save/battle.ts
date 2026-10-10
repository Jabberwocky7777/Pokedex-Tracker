/**
 * Bridges from a real, imported Pokémon to the battle tools: a Designer slot
 * filled with its actual nature, IVs, EVs and moves, and from there the
 * damage calculator.
 */
import type { DesignerSlot } from "../../store/useDesignerStore";
import { NATURES } from "../iv-calc";
import type { VersionGroup } from "../move-fetch";
import { abilityName, itemName, moveName } from "./tables";
import type { SaveFamily, SaveMon } from "./types";

/** The move list the Designer should show for a save of each family. */
export const FAMILY_VERSION_GROUP: Record<SaveFamily, VersionGroup> = {
  platinum: "platinum",
  dp: "diamond-pearl",
  hgss: "heartgold-soulsilver",
  rse: "emerald",
  frlg: "firered-leafgreen",
};

/** "Sand Veil" → "sand-veil", "Farfetch'd" → "farfetchd" — PokéAPI's slug form, which the Designer stores. */
export function slugify(name: string): string {
  return name.toLowerCase().replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** The Designer fields a saved Pokémon fills in. Everything else in the slot is left as it was. */
export function monToDesignerPatch(mon: SaveMon, family: SaveFamily): Partial<DesignerSlot> {
  const moves = mon.moves.map((id) => (id > 0 ? slugify(moveName(id)) : null));
  return {
    pokemonId: mon.species,
    nickname: mon.isNicknamed && !mon.nameUnsupported ? mon.nickname : "",
    natureName: NATURES[mon.nature]?.name ?? "Hardy",
    level: mon.level,
    selectedVersionGroup: FAMILY_VERSION_GROUP[family],
    selectedMoves: [moves[0] ?? null, moves[1] ?? null, moves[2] ?? null, moves[3] ?? null],
    ability: mon.ability > 0 ? slugify(abilityName(mon.ability)) : null,
    item: mon.heldItem > 0 ? itemName(mon.heldItem) : null,
    // Read straight from the save, so these are exact rather than inferred
    confirmedIVs: { ...mon.ivs },
    inferredIVs: {},
    ivDataPoints: [],
    evAllocation: { ...mon.evs },
  };
}
