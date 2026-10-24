/**
 * Encounter rates in the data that are known to be wrong, so the app shows no
 * rate for them rather than a wrong one (the data itself is left as it is).
 *
 * - HeartGold / SoulSilver Rock Smash: the data has 90% / 10% for the two slots;
 *   the game rolls 80% / 20% (pret/pokeheartgold, src/field/encounter_check.c,
 *   EncounterSlot_WildMonSlotRoll_RockSmash). Found 2026-10-23.
 */
const HGSS = new Set(["heartgold", "soulsilver"]);

export function rateHidden(version: string, method: string): boolean {
  return method === "rock-smash" && HGSS.has(version);
}

export const RATE_HIDDEN_TITLE = "Rate not shown: the encounter data's figure for this is known to be wrong";
