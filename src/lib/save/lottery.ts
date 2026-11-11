/**
 * The Gen IV lottery (Jubilife TV in Diamond, Pearl and Platinum; the Goldenrod
 * Radio Tower in HeartGold and SoulSilver): each day's five-digit Loto-ID is
 * compared with the trainer ID (OT ID) of every Pokémon in the party and the
 * boxes, digit by digit from the right; the more digits match, the better the
 * prize. Pure: what is matched is passed in.
 */
import type { SaveMon } from "./types";

/** How many digits match from the right (0–5), both numbers as five digits. */
export function matchingDigits(lotoId: number, trainerId: number): number {
  const a = String(lotoId % 100000).padStart(5, "0");
  const b = String(trainerId % 100000).padStart(5, "0");
  let n = 0;
  while (n < 5 && a[4 - n] === b[4 - n]) n++;
  return n;
}

export interface LotteryHit {
  profileId: string;
  mon: SaveMon;
  digits: number;
}

/** The Pokémon matching at least one digit, best first (several per save; the game takes the best one). */
export function lotteryHits(lotoId: number, saves: { profileId: string; mons: SaveMon[] }[]): LotteryHit[] {
  return saves
    .flatMap(({ profileId, mons }) =>
      mons.filter((m) => !m.isEgg).map((mon) => ({ profileId, mon, digits: matchingDigits(lotoId, mon.otTid) })),
    )
    .filter((h) => h.digits > 0)
    .sort((a, b) => b.digits - a.digits || a.mon.species - b.mon.species);
}
