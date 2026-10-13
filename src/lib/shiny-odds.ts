/**
 * Shiny odds in Generation III and IV, per hunting method. Pure.
 *
 *  - The base rate is 1 in 8192 for every encounter, egg and soft reset.
 *  - Masuda method (Gen IV only): an egg from parents of different languages is
 *    five times as likely, 5 in 8192.
 *  - Poké Radar (Diamond, Pearl, Platinum): the odds for a shaking patch rise
 *    with the chain, up to 1 in 200 at a chain of 40. The count is the chain.
 *  - Chain fishing has no effect before Generation VI: fishing is the base rate.
 */

export type HuntMethod = "random" | "soft-reset" | "masuda" | "radar" | "fishing";

export interface MethodInfo {
  id: HuntMethod;
  label: string;
  /** What one count is */
  unit: string;
  note: string;
  /** Generations the method exists in */
  generations: number[];
}

export const HUNT_METHODS: MethodInfo[] = [
  { id: "random", label: "Random encounters", unit: "encounter", note: "Every wild encounter is 1 in 8,192.", generations: [3, 4] },
  { id: "soft-reset", label: "Soft reset", unit: "reset", note: "Each reset in front of a legendary, gift or starter is 1 in 8,192.", generations: [3, 4] },
  { id: "masuda", label: "Masuda method", unit: "egg", note: "Eggs from two parents caught in games of different languages: 5 in 8,192 each.", generations: [4] },
  { id: "radar", label: "Poké Radar chain", unit: "in the chain", note: "Diamond, Pearl and Platinum. Count the chain, not the encounters: the odds are for each shaking patch and top out at a chain of 40.", generations: [4] },
  { id: "fishing", label: "Fishing", unit: "encounter", note: "Chain fishing only raises the odds from Generation VI on. Here every hooked Pokémon is 1 in 8,192.", generations: [3, 4] },
];

export const methodsFor = (generation: number) => HUNT_METHODS.filter((m) => m.generations.includes(generation));
export const methodInfo = (method: HuntMethod) => HUNT_METHODS.find((m) => m.id === method) ?? HUNT_METHODS[0];

const BASE = 1 / 8192;
export const RADAR_MAX_CHAIN = 40;

/** The chance that the next one is shiny. For the radar, `count` is the current chain length. */
export function oddsPerEncounter(method: HuntMethod, count: number): number {
  if (method === "masuda") return 5 / 8192;
  if (method === "radar") {
    const chain = Math.max(0, Math.min(count, RADAR_MAX_CHAIN));
    return Math.ceil(65535 / (8200 - chain * 200)) / 65536;
  }
  return BASE;
}

/**
 * The chance of having seen at least one shiny by now, after `count` tries.
 * Null for the radar, where the count is a chain length rather than a number of tries.
 */
export function chanceByNow(method: HuntMethod, count: number): number | null {
  if (method === "radar") return null;
  return 1 - (1 - oddsPerEncounter(method, count)) ** Math.max(0, count);
}

/** "1 in 8,192" */
export function formatOdds(probability: number): string {
  return `1 in ${Math.round(1 / probability).toLocaleString("en-US")}`;
}

/** "11.5%" — and "<0.1%" rather than "0.0%" */
export function formatChance(probability: number): string {
  const percent = probability * 100;
  if (percent > 0 && percent < 0.1) return "<0.1%";
  return `${percent.toFixed(1)}%`;
}
