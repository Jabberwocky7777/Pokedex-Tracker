/**
 * The Cute Charm glitch in Diamond, Pearl, Platinum, HeartGold and SoulSilver.
 *
 * In Generation IV, when a Cute Charm lead forces a wild Pokémon's gender, the
 * game doesn't generate a personality value (PID) normally: it picks one of 25
 * fixed PIDs, one per nature. With a TID/SID chosen so those PIDs are shiny,
 * the forced encounters are shiny far more often than 1/8192.
 *
 * - Genderless, always-male and always-female species are never affected.
 * - A male Cute Charm lead forces a female target, PIDs 0x00–0x18. Their gender
 *   byte (0–24) is below every mixed ratio's threshold, so this one table — and
 *   one save setup — works for every species that can be both genders.
 * - A female lead forces a male target, PIDs 25 × ⌈threshold / 25⌉ + nature:
 *   0x32–0x4A (87.5% male), 0x4B–0x63 (75% male), 0x96–0xAE (50%), 0xC8–0xE0
 *   (25% male). Each ratio has its own table, so a save set up for one ratio
 *   doesn't work for the others (PIDs 0x48–0x4F happen to share a shiny value
 *   across the 87.5% and 75% tables).
 *
 * Gen I–IV species have only these four mixed ratios (genderRate 1, 2, 4, 6
 * in eighths female) — none is 87.5% female.
 *
 * Sources (checked 2026-10-23; they agree):
 * - Smogon, "DPP / HGSS RNG Manipulation Guide Part 5 — Cute Charm TID/SID":
 *   https://www.smogon.com/ingame/rng/dpphgss_rng_part5
 * - PokemonRNG, "Diamond, Pearl, and Platinum Cute Charm Glitch Mechanics":
 *   https://www.pokemonrng.com/dppt-cute-charm/
 * - Bulbapedia, "Personality value" (Cute Charm, Generation IV) and "Cute Charm glitch":
 *   https://bulbapedia.bulbagarden.net/wiki/Personality_value
 */

/** PokéAPI's genderRate (eighths female, -1 genderless) → the game's gender threshold. */
const THRESHOLDS: Record<number, number> = { 1: 31, 2: 63, 4: 127, 6: 191 };

export type CuteCharmInfo =
  | { affected: false }
  | {
      affected: true;
      /** "87.5% male" — the female-lead table this species uses */
      ratioLabel: string;
      /** Female Cute Charm lead → male target: the 25 PIDs, first and last */
      femaleLeadPids: [number, number];
    };

/** Male lead → female target: one table for every mixed ratio. */
export const MALE_LEAD_PIDS: [number, number] = [0x00, 0x18];

export function cuteCharmInfo(genderRate: number): CuteCharmInfo {
  const threshold = THRESHOLDS[genderRate];
  if (threshold === undefined) return { affected: false };
  const base = 25 * Math.ceil(threshold / 25);
  return { affected: true, ratioLabel: `${100 - (genderRate / 8) * 100}% male`, femaleLeadPids: [base, base + 24] };
}

/** Whether Cute Charm can affect the species at all (both genders possible). */
export const cuteCharmAffects = (genderRate: number): boolean => cuteCharmInfo(genderRate).affected;

export const hex = (n: number) => `0x${n.toString(16).toUpperCase().padStart(2, "0")}`;
