/**
 * Breeding in Generation III/IV: who can breed with whom, what hatches, and
 * which Pokémon can hand an egg move down. Pure functions over pokemon.json
 * (egg groups, gender ratio, evolutions) and the precomputed learnsets.
 *
 * The rules used:
 *  - Two Pokémon breed when they share an egg group and are a male and a female;
 *    or one of them is Ditto. "no-eggs" (Undiscovered) never breeds: babies,
 *    legendaries, Nidorina and Nidoqueen.
 *  - Genderless and male-only species can only breed with Ditto.
 *  - The egg is the lowest stage of the mother's line (of the non-Ditto parent
 *    with Ditto). Nine babies introduced after their parents only hatch when a
 *    parent holds an incense; without it the next stage hatches.
 *  - Egg moves come from the father: a move he knows that is an egg move of
 *    the baby. He may know it by level-up, TM or tutor — or have got it as an
 *    egg move himself, which is how chains form.
 */
import type { Pokemon } from "../types";
import type { LearnedMove } from "./move-fetch";

const DITTO = 132;
const NO_EGGS = "no-eggs";

export const EGG_GROUP_NAMES: Record<string, string> = {
  monster: "Monster", water1: "Water 1", bug: "Bug", flying: "Flying", ground: "Field", fairy: "Fairy",
  plant: "Grass", humanshape: "Human-Like", water3: "Water 3", mineral: "Mineral", indeterminate: "Amorphous",
  water2: "Water 2", ditto: "Ditto", dragon: "Dragon", "no-eggs": "Undiscovered",
};

/** Baby → the incense a parent must hold for it to hatch, and the generation that added it. */
const INCENSE_BABIES: Record<number, { incense: string; since: number }> = {
  298: { incense: "Sea Incense", since: 3 },   // Azurill
  360: { incense: "Lax Incense", since: 3 },   // Wynaut
  406: { incense: "Rose Incense", since: 4 },  // Budew
  433: { incense: "Pure Incense", since: 4 },  // Chingling
  438: { incense: "Rock Incense", since: 4 },  // Bonsly
  439: { incense: "Odd Incense", since: 4 },   // Mime Jr.
  440: { incense: "Luck Incense", since: 4 },  // Happiny
  446: { incense: "Full Incense", since: 4 },  // Munchlax
  458: { incense: "Wave Incense", since: 4 },  // Mantyke
};

/** "♂ 87.5% · ♀ 12.5%", "Genderless", "Always female" */
export function genderLabel(genderRate: number): string {
  if (genderRate === -1) return "Genderless";
  if (genderRate === 0) return "Always male";
  if (genderRate === 8) return "Always female";
  const female = (genderRate / 8) * 100;
  return `♂ ${100 - female}% · ♀ ${female}%`;
}

export const canBreed = (p: Pokemon) => !p.eggGroups.includes(NO_EGGS);
const isGenderless = (p: Pokemon) => p.genderRate === -1;
const canBeMale = (p: Pokemon) => p.genderRate >= 0 && p.genderRate < 8;
const canBeFemale = (p: Pokemon) => p.genderRate > 0;
const sharesGroup = (a: Pokemon, b: Pokemon) => a.eggGroups.some((g) => b.eggGroups.includes(g));

export type PokemonMap = ReadonlyMap<number, Pokemon>;

/** The lowest stage of a Pokémon's line that exists in the generation. */
export function baseStage(p: Pokemon, byId: PokemonMap): Pokemon {
  let stage = p;
  for (let guard = 0; guard < 5 && stage.evolvesFrom !== null; guard++) {
    const parent = byId.get(stage.evolvesFrom);
    if (!parent) break;
    stage = parent;
  }
  return stage;
}

/** Every member of the line a Pokémon belongs to, within the generation. */
export function family(p: Pokemon, byId: PokemonMap, maxId: number): Pokemon[] {
  const members: Pokemon[] = [];
  const walk = (stage: Pokemon) => {
    if (stage.id > maxId) return;
    members.push(stage);
    for (const step of stage.evolvesTo) {
      const next = byId.get(step.speciesId);
      if (next) walk(next);
    }
  };
  walk(baseStage(p, byId));
  return members;
}

export interface BreedingAdvice {
  /** False when no member of the line can breed at all (a legendary, Unown) */
  possible: boolean;
  /** What the egg hatches into */
  hatches: Pokemon;
  /** Set when the egg only hatches as `hatches` if a parent holds this */
  incense: string | null;
  /** What hatches instead without the incense */
  withoutIncense: Pokemon | null;
  /** The target is a later stage than what hatches, so the hatchling has to be evolved */
  needsEvolving: boolean;
  /** Members of the line that can be a parent, and the ones of those that are caught */
  parents: Pokemon[];
  caughtParents: Pokemon[];
  /** The line can only breed with Ditto (genderless, or no females) */
  dittoOnly: boolean;
  dittoCaught: boolean;
  /** Caught Pokémon of another line that could be the other parent (a male sharing an egg group) */
  caughtPartners: Pokemon[];
  /** Can it be done with what is caught right now? */
  ready: boolean;
}

/**
 * Can `target` be bred, from what, and with what?
 * @param pokemon the Pokémon of the generation
 * @param caught  caught ids for that generation
 */
export function breedingAdvice(target: Pokemon, pokemon: readonly Pokemon[], caught: ReadonlySet<number>, generation: number): BreedingAdvice {
  const byId = new Map(pokemon.map((p) => [p.id, p]));
  const maxId = pokemon.reduce((max, p) => Math.max(max, p.id), 0);
  // A target outside the pool (a Gen IV species looked up while Gen III is selected) is its own line
  const inPool = family(target, byId, maxId);
  const line = inPool.length > 0 ? inPool : [target];
  const base = line[0];
  const parents = line.filter(canBreed);
  const caughtParents = parents.filter((p) => caught.has(p.id));

  // An incense baby only exists as an egg from the generation that introduced its incense
  const rule = INCENSE_BABIES[base.id];
  const incenseApplies = rule !== undefined && rule.since <= generation;
  const nextStage = base.evolvesTo.map((step) => byId.get(step.speciesId)).find((p) => p !== undefined) ?? null;

  const dittoOnly = parents.length > 0 && parents.every((p) => isGenderless(p) || !canBeFemale(p));
  const dittoCaught = caught.has(DITTO);
  const lineIds = new Set(line.map((p) => p.id));
  const mothers = parents.filter(canBeFemale);
  const caughtPartners = dittoOnly ? [] : pokemon.filter((p) =>
    caught.has(p.id) && !lineIds.has(p.id) && p.id !== DITTO && canBreed(p) && canBeMale(p) && mothers.some((m) => sharesGroup(p, m)));

  // With a caught parent: Ditto works for any of them; a caught partner needs a caught
  // member that can be female; two of the same line (a male and a female) also works,
  // which one caught species can cover when it has both genders.
  const caughtMothers = caughtParents.filter(canBeFemale);
  const selfPair = caughtMothers.some((m) => canBeMale(m)) || (caughtMothers.length > 0 && caughtParents.some(canBeMale));
  const ready = caughtParents.length > 0 && (dittoCaught || (!dittoOnly && (caughtPartners.length > 0 || selfPair)));

  return {
    possible: parents.length > 0 && target.id !== DITTO,
    hatches: base,
    incense: incenseApplies ? rule.incense : null,
    withoutIncense: incenseApplies ? nextStage : null,
    needsEvolving: target.id !== base.id,
    parents, caughtParents, dittoOnly, dittoCaught, caughtPartners, ready,
  };
}

// ── Egg-move chains ──────────────────────────────────────────────────────────

export interface ChainLink {
  pokemon: Pokemon;
  /** How this one comes to know the move */
  how: "level-up" | "machine" | "tutor" | "egg";
  /** Level for level-up */
  level: number;
  caught: boolean;
}

export interface EggMoveChain {
  /** From the Pokémon that learns the move by itself, down to the last father before the target */
  links: ChainLink[];
  /** The first link is caught, so the chain can be started now */
  startsCaught: boolean;
}

/**
 * Who can pass an egg move down to `target`. Each chain starts with a Pokémon
 * that learns the move without breeding and ends with a father for the target;
 * every later link gets the move as an egg move from the one before.
 *
 * @param learnsetOf the learnset of a species in the game being played (one version group)
 * @param maxLinks   longest chain of fathers to look for
 */
export function findEggMoveChains(
  target: Pokemon, move: string, pokemon: readonly Pokemon[], caught: ReadonlySet<number>,
  learnsetOf: (id: number) => readonly LearnedMove[], maxLinks = 3,
): EggMoveChain[] {
  const byId = new Map(pokemon.map((p) => [p.id, p]));
  const maxId = pokemon.reduce((max, p) => Math.max(max, p.id), 0);
  const mothers = family(target, byId, maxId).filter((p) => canBreed(p) && canBeFemale(p));
  if (mothers.length === 0) return [];
  const targetLine = new Set(family(target, byId, maxId).map((p) => p.id));

  const fathers = pokemon.filter((p) => canBreed(p) && canBeMale(p) && p.id !== DITTO);
  const knows = new Map<number, ChainLink>();     // learns it without breeding
  const asEggMove = new Set<number>();            // has it as an egg move (so its line's males can carry it)
  for (const p of fathers) {
    const rows = learnsetOf(p.id).filter((m) => m.move === move);
    const own = rows.find((m) => m.method === "level-up") ?? rows.find((m) => m.method === "machine") ?? rows.find((m) => m.method === "tutor");
    if (own) knows.set(p.id, { pokemon: p, how: own.method as ChainLink["how"], level: own.level, caught: caught.has(p.id) });
    // Egg moves are listed on the baby; the whole line can carry them
    if (learnsetOf(baseStage(p, byId).id).some((m) => m.move === move && m.method === "egg")) asEggMove.add(p.id);
  }

  // Breadth-first, backwards from the target: who can father the current recipient?
  const chains: EggMoveChain[] = [];
  type Path = { recipientMothers: Pokemon[]; links: ChainLink[]; seenLines: Set<number> };
  let frontier: Path[] = [{ recipientMothers: mothers, links: [], seenLines: new Set([baseStage(target, byId).id]) }];
  for (let depth = 1; depth <= maxLinks && frontier.length > 0; depth++) {
    const next: Path[] = [];
    for (const path of frontier) {
      for (const father of fathers) {
        if (targetLine.has(father.id)) continue;
        if (!path.recipientMothers.some((m) => sharesGroup(father, m))) continue;
        const line = baseStage(father, byId).id;
        if (path.seenLines.has(line)) continue;
        const own = knows.get(father.id);
        if (own) {
          const links = [own, ...path.links];
          chains.push({ links, startsCaught: own.caught });
        } else if (asEggMove.has(father.id) && depth < maxLinks) {
          next.push({
            recipientMothers: family(father, byId, maxId).filter((p) => canBreed(p) && canBeFemale(p)),
            links: [{ pokemon: father, how: "egg", level: 0, caught: caught.has(father.id) }, ...path.links],
            seenLines: new Set([...path.seenLines, line]),
          });
        }
      }
    }
    // The shortest chains are the useful ones: only look a step further when there are none yet
    if (chains.length > 0) break;
    frontier = next.slice(0, 400);
  }

  // One chain per starting line and length, caught starts first, then shortest
  const seen = new Set<string>();
  return chains
    .sort((a, b) => Number(b.startsCaught) - Number(a.startsCaught) || a.links.length - b.links.length
      || Number(b.links.every((l) => l.caught)) - Number(a.links.every((l) => l.caught)) || a.links[0].pokemon.id - b.links[0].pokemon.id)
    .filter((chain) => {
      const key = chain.links.map((l) => l.pokemon.id).join(">");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
