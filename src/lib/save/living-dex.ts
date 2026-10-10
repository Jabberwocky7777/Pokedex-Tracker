/**
 * Living-dex model: a save whose boxes hold the National Dex in order, 30 per
 * box, starting at `startBox`. Pure functions over the slim per-Pokémon data,
 * so they work the same from a full save or a synced summary.
 */
import {
  BOX_COUNT, BOX_SIZE, MAX_SPECIES_GEN4, PARTY_BOX,
  type ProfileMons, type SlimMon, type SpeciesMap,
} from "./types";

export interface SlotRef {
  box: number;
  slot: number;
}

/** Where species `n` lives, or null when the dex would run past the last box. */
export function homeSlot(species: number, startBox: number, boxCount = BOX_COUNT): SlotRef | null {
  const box = startBox + Math.floor((species - 1) / BOX_SIZE);
  if (species < 1 || box < 0 || box >= boxCount) return null;
  return { box, slot: (species - 1) % BOX_SIZE };
}

/** The species that belongs in a box slot, or null if the slot is outside the dex. */
export function speciesForSlot(box: number, slot: number, startBox: number, maxSpecies = MAX_SPECIES_GEN4): number | null {
  if (box < startBox) return null;
  const species = (box - startBox) * BOX_SIZE + slot + 1;
  return species <= maxSpecies ? species : null;
}

const FIRST_DEX_BOX_NAME = /^0*1\D+0*30$/;

/**
 * Finds the box the dex most plausibly starts in: 2 points for every slot that
 * already holds the right species, plus 1 if the box is named like "001-030".
 */
export function detectStartBox(mons: SlimMon[], boxNames: string[]): { startBox: number; placed: number } {
  let best = { startBox: 0, placed: 0, score: -1 };
  for (let startBox = 0; startBox < BOX_COUNT; startBox++) {
    const placed = mons.filter(
      (m) => !m.isEgg && m.box !== PARTY_BOX && speciesForSlot(m.box, m.slot, startBox) === m.species,
    ).length;
    const score = placed * 2 + (FIRST_DEX_BOX_NAME.test((boxNames[startBox] ?? "").trim()) ? 1 : 0);
    if (score > best.score) best = { startBox, placed, score };
  }
  return { startBox: best.startBox, placed: best.placed };
}

/** True when `ancestor` is an earlier stage of `species` (Caterpie for Butterfree). */
export function isEarlierStage(dex: SpeciesMap, ancestor: number, species: number): boolean {
  let at = dex.get(species)?.evolvesFrom ?? null;
  for (let guard = 0; at !== null && guard < 8; guard++) {
    if (at === ancestor) return true;
    at = dex.get(at)?.evolvesFrom ?? null;
  }
  return false;
}

/** Later stages of `species`, nearest first: [[stage+1 …], [stage+2 …]], each sorted by dex number. */
export function laterStages(dex: SpeciesMap, species: number, maxSpecies = MAX_SPECIES_GEN4): number[][] {
  const tiers: number[][] = [];
  let frontier = [species];
  for (let guard = 0; guard < 8; guard++) {
    const next = frontier
      .flatMap((id) => dex.get(id)?.evolvesTo.map((step) => step.speciesId) ?? [])
      .filter((id) => id <= maxSpecies)
      .sort((a, b) => a - b);
    if (next.length === 0) break;
    tiers.push(next);
    frontier = next;
  }
  return tiers;
}

export type SlotState = "placed" | "placeholder" | "wrong" | "empty";

export interface DexSlot extends SlotRef {
  species: number;
  state: SlotState;
  /** Whatever sits in the slot (an egg counts as "wrong") */
  occupant: SlimMon | null;
}

export interface SaveAnalysis {
  /** Species that sit in their own slot */
  placed: Set<number>;
  /** Slot species → the earlier-stage Pokémon holding its slot */
  placeholders: Map<number, SlimMon>;
  /** Species with at least one non-egg copy anywhere in the save, party included */
  owned: Set<number>;
  /** Species with at least one shiny non-egg copy */
  shinyOwned: Set<number>;
  /** Non-egg copies that are not the placed one in their own slot */
  spares: SlimMon[];
  /** Home slot of every species that has one (living-dex saves only) */
  slots: Map<number, DexSlot>;
}

/** What a save holds, read as a living dex starting at `startBox` (null = not a living dex). */
export function analyzeSave(
  mons: SlimMon[],
  startBox: number | null,
  dex: SpeciesMap,
  maxSpecies = MAX_SPECIES_GEN4,
): SaveAnalysis {
  const result: SaveAnalysis = {
    placed: new Set(), placeholders: new Map(), owned: new Set(), shinyOwned: new Set(), spares: [], slots: new Map(),
  };
  const bySlot = new Map<string, SlimMon>();
  for (const m of mons) {
    bySlot.set(`${m.box}:${m.slot}`, m);
    if (m.isEgg) continue;
    result.owned.add(m.species);
    if (m.shiny) result.shinyOwned.add(m.species);
  }

  const placedMons = new Set<SlimMon>();
  if (startBox !== null) {
    for (let species = 1; species <= maxSpecies; species++) {
      const home = homeSlot(species, startBox);
      if (!home) continue;
      const occupant = bySlot.get(`${home.box}:${home.slot}`) ?? null;
      let state: SlotState = "empty";
      if (occupant) {
        if (!occupant.isEgg && occupant.species === species) state = "placed";
        else if (!occupant.isEgg && isEarlierStage(dex, occupant.species, species)) state = "placeholder";
        else state = "wrong";
      }
      if (state === "placed") { result.placed.add(species); placedMons.add(occupant!); }
      if (state === "placeholder") result.placeholders.set(species, occupant!);
      result.slots.set(species, { ...home, species, state, occupant });
    }
  }
  result.spares = mons.filter((m) => !m.isEgg && !placedMons.has(m));
  return result;
}

export function analyzeProfile(p: ProfileMons, dex: SpeciesMap, maxSpecies = MAX_SPECIES_GEN4): SaveAnalysis {
  return analyzeSave(p.mons, p.profile.role === "living-dex" ? p.profile.startBox : null, dex, maxSpecies);
}

export interface PendingReason {
  /** The earlier stage that is waiting to evolve */
  from: number;
  /** placeholder: it sits in this species' slot. spare: a loose copy was counted towards it. */
  kind: "placeholder" | "spare";
  profileId: string;
  /** Other uncaught species the same copy could have become */
  alternatives: number[];
}

export interface Allocation {
  /** Uncaught species that have an earlier stage waiting to evolve into them */
  pending: Map<number, PendingReason>;
  /** Uncaught species a spare could become, but which it wasn't counted towards */
  couldAlso: Map<number, { from: number; assignedTo: number }>;
  /** Owned in any of the profiles */
  owned: Set<number>;
  shinyOwned: Set<number>;
  /** In its own slot in a living-dex profile */
  placed: Set<number>;
  /** Placed, and the Pokémon in the slot is shiny */
  shinyPlaced: Set<number>;
  hasLivingDex: boolean;
}

/**
 * Works out which species are "pending" (an earlier stage is waiting to evolve)
 * without letting one Pokémon count several times over.
 *
 * The naive rule — "an earlier stage is owned" — marks all seven Eeveelutions
 * from a single Eevee. Instead each physical copy is spent once:
 *   1. A placeholder in a living-dex slot is spent on that slot's species.
 *   2. Every other spare copy is spent on at most one uncaught later stage:
 *      nearest stage first, then lowest dex number. The branches it could have
 *      gone to instead are kept as "could also become".
 * A species that is owned in any profile is never pending.
 */
export function allocatePending(
  profiles: ProfileMons[],
  dex: SpeciesMap,
  maxSpecies = MAX_SPECIES_GEN4,
): Allocation {
  const out: Allocation = {
    pending: new Map(), couldAlso: new Map(), owned: new Set(), shinyOwned: new Set(),
    placed: new Set(), shinyPlaced: new Set(), hasLivingDex: false,
  };
  const analyses = profiles.map((p) => ({ p, a: analyzeProfile(p, dex, maxSpecies) }));

  for (const { p, a } of analyses) {
    a.owned.forEach((id) => out.owned.add(id));
    a.shinyOwned.forEach((id) => out.shinyOwned.add(id));
    if (p.profile.role !== "living-dex") continue;
    out.hasLivingDex = true;
    for (const id of a.placed) {
      out.placed.add(id);
      if (a.slots.get(id)?.occupant?.shiny) out.shinyPlaced.add(id);
    }
  }

  // 1. Placeholders: the copy is spent on its slot's species either way
  const spent = new Set<SlimMon>();
  for (const { p, a } of analyses) {
    for (const [species, mon] of a.placeholders) {
      spent.add(mon);
      if (out.owned.has(species) || out.pending.has(species)) continue;
      out.pending.set(species, { from: mon.species, kind: "placeholder", profileId: p.profile.id, alternatives: [] });
    }
  }

  // 2. Remaining spares, in a stable order so the result doesn't depend on box layout quirks
  const spares = analyses
    .flatMap(({ p, a }) => a.spares.filter((m) => !spent.has(m)).map((mon) => ({ mon, profileId: p.profile.id })))
    .sort((x, y) => x.mon.species - y.mon.species);

  for (const { mon, profileId } of spares) {
    const open = laterStages(dex, mon.species, maxSpecies)
      .flat()
      .filter((id) => !out.owned.has(id) && !out.pending.has(id) && !dex.get(id)?.isBaby);
    if (open.length === 0) continue;
    const [target, ...alternatives] = open;
    out.pending.set(target, { from: mon.species, kind: "spare", profileId, alternatives });
    for (const alt of alternatives) {
      if (!out.couldAlso.has(alt)) out.couldAlso.set(alt, { from: mon.species, assignedTo: target });
    }
  }
  // A later spare may have claimed a species that was only a "could also" before
  for (const id of out.pending.keys()) out.couldAlso.delete(id);

  return out;
}

/**
 * Babies the user doesn't have but could breed: baby species → the owned
 * later stage to breed from. Shown as advice, never as a pending mark.
 */
export function breedingHints(
  owned: ReadonlySet<number>,
  dex: SpeciesMap,
  maxSpecies = MAX_SPECIES_GEN4,
): Map<number, number> {
  const hints = new Map<number, number>();
  for (const info of dex.values()) {
    if (!info.isBaby || info.id > maxSpecies || owned.has(info.id)) continue;
    const parent = laterStages(dex, info.id, maxSpecies).flat().find((id) => owned.has(id));
    if (parent !== undefined) hints.set(info.id, parent);
  }
  return hints;
}

export interface LivingDexStats {
  placed: number;
  /** Slots held by an earlier stage */
  needsEvolving: number;
  /** Species owned in this save that aren't in their own slot */
  ownedNotInSlot: number;
  /** Species with neither a copy nor a placeholder */
  missing: number;
}

export function livingDexStats(a: SaveAnalysis, maxSpecies = MAX_SPECIES_GEN4): LivingDexStats {
  let ownedNotInSlot = 0;
  let missing = 0;
  for (let id = 1; id <= maxSpecies; id++) {
    if (a.placed.has(id)) continue;
    if (a.owned.has(id)) ownedNotInSlot++;
    else if (!a.placeholders.has(id)) missing++;
  }
  return { placed: a.placed.size, needsEvolving: a.placeholders.size, ownedNotInSlot, missing };
}
