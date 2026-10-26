/**
 * Pal Park planner: the Gen III catches (from imported Ruby / Sapphire /
 * Emerald / FireRed / LeafGreen saves) whose species the Gen IV living-dex
 * save doesn't have yet — what to migrate. In Diamond, Pearl and Platinum
 * Pal Park only opens with the National Pokédex and takes six Pokémon from a
 * Gen III save once every 24 hours; HeartGold and SoulSilver dropped the wait
 * (Bulbapedia's Pal Park page, checked 2026-10-26). The gate is read from
 * Game Progress. Pure.
 */
import type { GameProgress } from "../game-progress";
import { genConfigOf, PARTY_BOX, type ProfileMons, type SlimMon } from "./types";

export interface PalParkSource {
  profileId: string;
  label: string;
  mon: SlimMon;
}

export interface PalParkItem {
  species: number;
  /** Every copy in the Gen III saves, best first (shiny, then highest level) */
  sources: PalParkSource[];
}

/** Species the living dex lacks that some Gen III save has, in dex order */
export function palParkPlan(livingDex: ProfileMons, gen3: readonly ProfileMons[]): PalParkItem[] {
  const have = new Set(livingDex.mons.filter((m) => !m.isEgg).map((m) => m.species));
  const bySpecies = new Map<number, PalParkSource[]>();
  for (const profile of gen3) {
    if (genConfigOf(profile.profile.family).gen !== 3) continue;
    for (const mon of profile.mons) {
      if (mon.isEgg || have.has(mon.species)) continue;
      const list = bySpecies.get(mon.species) ?? [];
      list.push({ profileId: profile.profile.id, label: profile.profile.label, mon });
      bySpecies.set(mon.species, list);
    }
  }
  return [...bySpecies.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([species, sources]) => ({
      species,
      sources: sources.sort((a, b) => Number(b.mon.shiny) - Number(a.mon.shiny) || b.mon.level - a.mon.level),
    }));
}

/** "Box 3, slot 8" or "Party" */
export const whereIn = (mon: SlimMon) => (mon.box === PARTY_BOX ? "Party" : `Box ${mon.box + 1}, slot ${mon.slot + 1}`);

/**
 * Whether Pal Park is open in the living dex's game, from Game Progress:
 * Diamond, Pearl and Platinum need the National Pokédex. `games` are the
 * versions the save could be (Diamond or Pearl when the save doesn't say).
 * HG/SS isn't gated here.
 */
export function palParkOpen(games: readonly string[], progressOf: (game: string) => GameProgress | undefined): boolean {
  const sinnoh = games.filter((g) => ["diamond", "pearl", "platinum"].includes(g));
  if (sinnoh.length === 0) return true;
  return sinnoh.some((g) => progressOf(g)?.milestones["national-dex"]?.done === true);
}
