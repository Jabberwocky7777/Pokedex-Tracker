/**
 * Where a Pokémon came from: caught by this save's trainer or traded in,
 * native to this game or brought from another, Pal Park, event.
 */
import type { SaveFamily, SaveMon, SaveTrainer } from "./types";

/** Origin-game codes that count as "this game" for each save family. */
export const FAMILY_ORIGIN_CODES: Record<SaveFamily, number[]> = {
  platinum: [12],
  dp: [10, 11],
  hgss: [7, 8],
  rse: [1, 2, 3],
  frlg: [4, 5],
};

/** Ruby, Sapphire, Emerald, FireRed, LeafGreen and Colosseum/XD */
const GEN3_ORIGINS = [1, 2, 3, 4, 5, 15];
export const PAL_PARK_LOCATION = 55;

export function isOwnCatch(mon: Pick<SaveMon, "otTid" | "otSid">, trainer: SaveTrainer): boolean {
  return mon.otTid === trainer.tid && mon.otSid === trainer.sid;
}

export function isNative(mon: Pick<SaveMon, "originGame">, family: SaveFamily): boolean {
  return FAMILY_ORIGIN_CODES[family].includes(mon.originGame);
}

export type OriginBadge = "own" | "traded" | "native" | "pal-park" | "event";

export const ORIGIN_BADGES: Record<OriginBadge, { label: string; marker: string; hint: string; className: string }> = {
  own: { label: "Your catch", marker: "", hint: "Its original trainer is this save's trainer", className: "bg-emerald-900/50 text-emerald-300 border-emerald-700/50" },
  traded: { label: "Traded", marker: "T", hint: "Its original trainer is someone else", className: "bg-sky-900/50 text-sky-300 border-sky-700/50" },
  native: { label: "Native", marker: "", hint: "It comes from this game", className: "bg-gray-800 text-gray-300 border-gray-700" },
  "pal-park": { label: "Pal Park", marker: "P", hint: "Migrated from a Game Boy Advance game", className: "bg-orange-900/50 text-orange-300 border-orange-700/50" },
  event: { label: "Event", marker: "E", hint: "Fateful encounter", className: "bg-purple-900/50 text-purple-300 border-purple-700/50" },
};

/** The badges that apply to one Pokémon in a save of the given family. */
export function originBadges(mon: SaveMon, trainer: SaveTrainer, family: SaveFamily): OriginBadge[] {
  const badges: OriginBadge[] = [isOwnCatch(mon, trainer) ? "own" : "traded"];
  if (isNative(mon, family)) badges.push("native");
  // In a Gen IV save, anything from a Gen III game came through Pal Park
  const gen4Save = family !== "rse" && family !== "frlg";
  if (gen4Save && (GEN3_ORIGINS.includes(mon.originGame) || mon.metLocation === PAL_PARK_LOCATION)) badges.push("pal-park");
  if (mon.fateful) badges.push("event");
  return badges;
}
