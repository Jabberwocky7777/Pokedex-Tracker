import { calcHPStat, calcStat, getNatureMultiplier, STAT_KEYS } from "./iv-calc";
import type { StatKey, Nature } from "./iv-calc";
import type { BaseStats } from "../types";

export type { StatKey, Nature };

/** The IV assumed for a stat nobody has confirmed or narrowed down yet — the worst case. */
export const UNKNOWN_IV = 0;

export function calcAllStats(
  baseStats: BaseStats,
  ivs: Record<StatKey, number>,
  evs: Record<StatKey, number>,
  nature: Nature,
  level: number
): Record<StatKey, number> {
  const result = {} as Record<StatKey, number>;
  for (const stat of STAT_KEYS) {
    const base = baseStats[stat as keyof BaseStats];
    const iv = ivs[stat] ?? UNKNOWN_IV;
    const ev = evs[stat] ?? 0;
    if (stat === "hp") {
      result[stat] = calcHPStat(base, iv, ev, level);
    } else {
      result[stat] = calcStat(base, iv, ev, level, getNatureMultiplier(nature, stat));
    }
  }
  return result;
}
