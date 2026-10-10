/**
 * Best-copy picker: when a species has several copies across the imported
 * saves, which one deserves the living-dex slot?
 *
 * Ranked by, in order: shiny (only when "Shiny living dex" is on), caught by
 * the save's own trainer, native to the living-dex game, IV total, level.
 * OT, origin and IVs need the full save; a copy known only from a synced
 * summary is compared on shiny and level alone.
 */
import { analyzeProfile, slotLabel } from "./living-dex";
import { isNative, isOwnCatch } from "./origin";
import { findFull } from "./summary";
import type { ParsedSave, ProfileMons, SaveFamily, SaveMon, SlimMon, SpeciesMap } from "./types";

export interface Copy {
  profile: ProfileMons;
  mon: SlimMon;
  full?: SaveMon;
}

export interface RankOptions {
  shinyLivingDex: boolean;
  /** The living-dex save's family — decides what "native" means */
  livingFamily: SaveFamily;
}

export const ivTotal = (full: SaveMon): number => Object.values(full.ivs).reduce((sum, iv) => sum + iv, 0);

/** Higher is better, compared left to right. */
export function copyRank(copy: Copy, opts: RankOptions): number[] {
  const { mon, full, profile } = copy;
  return [
    opts.shinyLivingDex && mon.shiny ? 1 : 0,
    full && isOwnCatch(full, profile.profile.trainer) ? 1 : 0,
    full && isNative(full, opts.livingFamily) ? 1 : 0,
    full ? ivTotal(full) : 0,
    mon.level,
  ];
}

export function compareCopies(a: Copy, b: Copy, opts: RankOptions): number {
  const [ra, rb] = [copyRank(a, opts), copyRank(b, opts)];
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return rb[i] - ra[i];
  return 0;
}

/** "shiny, your catch, 142 IV total" — the things that make this copy stand out. */
export function describeCopy(copy: Copy, opts: RankOptions): string {
  const { mon, full, profile } = copy;
  return [
    mon.shiny ? "shiny" : "",
    full && isOwnCatch(full, profile.profile.trainer) ? "your catch" : "",
    full && isNative(full, opts.livingFamily) ? "" : full ? "from another game" : "",
    full ? `${ivTotal(full)} IV total` : "",
    `Lv. ${mon.level}`,
  ].filter(Boolean).join(", ");
}

export interface BetterCopy {
  species: number;
  placed: Copy;
  best: Copy;
  /** "BOX 18 · slot 3" — prefixed with the save's name when it is in another save */
  where: string;
  description: string;
}

/**
 * For every placed species, the copy that outranks the one in the slot (if any).
 * A copy is only called better when both are known equally well — a full
 * record never loses to a summary just because the summary has no IVs.
 */
export function betterCopies(
  profiles: ProfileMons[],
  dex: SpeciesMap,
  opts: { shinyLivingDex: boolean; fullSaves?: Record<string, ParsedSave>; maxSpecies: number },
): Map<number, BetterCopy> {
  const out = new Map<number, BetterCopy>();
  const living = profiles.find((p) => p.profile.role === "living-dex");
  if (!living) return out;
  const rank: RankOptions = { shinyLivingDex: opts.shinyLivingDex, livingFamily: living.profile.family };
  const asCopy = (profile: ProfileMons, mon: SlimMon): Copy => ({ profile, mon, full: findFull(opts.fullSaves, profile.profile.id, mon) });

  const bySpecies = new Map<number, Copy[]>();
  for (const p of profiles) {
    for (const mon of p.mons) {
      if (mon.isEgg) continue;
      bySpecies.set(mon.species, [...(bySpecies.get(mon.species) ?? []), asCopy(p, mon)]);
    }
  }

  const a = analyzeProfile(living, dex, opts.maxSpecies);
  for (const species of a.placed) {
    const occupant = a.slots.get(species)!.occupant!;
    const placed = asCopy(living, occupant);
    const rivals = (bySpecies.get(species) ?? [])
      .filter((c) => c.mon !== occupant && !!c.full === !!placed.full)
      .sort((x, y) => compareCopies(x, y, rank));
    const best = rivals[0];
    if (!best || compareCopies(best, placed, rank) >= 0) continue;
    const spot = slotLabel(best.profile.boxNames, best.mon.box, best.mon.slot);
    out.set(species, {
      species, placed, best,
      where: best.profile === living ? spot : `${best.profile.profile.label}, ${spot}`,
      description: describeCopy(best, rank),
    });
  }
  return out;
}
