/**
 * Level-up plan: the Pokémon still pending because something has to be
 * levelled up, which copy in your saves to level for each, and how much EXP
 * that takes.
 *
 * - A target counts when the first step from the copy towards it is a plain
 *   level evolution ("Level 18"); its required level is the highest level on
 *   the run of level steps that follows. A later step of another kind (a
 *   stone, a trade) is kept as `then`.
 * - Every spare copy of an earlier stage, in any save, is a candidate — not
 *   only the one `allocatePending` happened to count. Targets that need the
 *   most levels choose first and each takes the candidate needing the least
 *   EXP, so with a Lv 15 and a Lv 20 Pidgey the Lv 20 one goes to Pidgeot and
 *   the Lv 15 one to Pidgeotto (cheaper in total than the other way round).
 * - EXP is the copy's real EXP where this device has the full save, otherwise
 *   the least it can have at its level.
 */
import { allocatePending, analyzeProfile, reservedForOwnSlot, slotLabel, WURMPLE, wurmpleLine } from "./living-dex";
import { findFull, pidLookup } from "./summary";
import { expForLevel } from "./tables";
import type { ParsedSave, ProfileMons, SlimMon, SpeciesMap } from "./types";

export interface LevelCandidate {
  mon: SlimMon;
  profileId: string;
  profileLabel: string;
  where: string;
  /** Its EXP now (exact when `expExact`) */
  exp: number;
  expExact: boolean;
  /** EXP still needed to reach the required level (or, already there, the next level) */
  expToGo: number;
  /** Not its original trainer's: × 1.5 EXP in battle */
  traded: boolean;
  /** A Wurmple whose personality value this device doesn't have: it may turn into the other line */
  branchUnknown?: boolean;
}

export interface LevelJob {
  /** The pending species this gets you */
  target: number;
  /** The level the copy has to reach */
  needLevel: number;
  /** The level evolutions on the way: [species it becomes, at level] */
  steps: [number, number][];
  /** What is left after the levels: "Trade holding King's Rock" */
  then?: string;
  /** The copy to level */
  pick: LevelCandidate;
  levelsToGo: number;
  /** Already at the level: it evolves on its next level-up */
  readyNow: boolean;
  /** The other copies that could have done it, cheapest first */
  others: LevelCandidate[];
}

export interface LevelPlanOptions {
  maxSpecies: number;
  fullSaves?: Record<string, ParsedSave>;
}

interface Path {
  /** Species from the copy's stage up to the target, the copy's own first */
  chain: number[];
  needLevel: number;
  steps: [number, number][];
  then?: string;
}

/** The evolution path from `from` to `target` when it starts with level evolutions; null otherwise */
export function levelPath(dex: SpeciesMap, from: number, target: number): Path | null {
  // Walk back from the target to `from`
  const chain = [target];
  for (let at = target; at !== from;) {
    const prev = dex.get(at)?.evolvesFrom ?? null;
    if (prev === null || chain.length > 4) return null;
    chain.unshift(prev);
    at = prev;
  }
  const steps: [number, number][] = [];
  const rest: string[] = [];
  for (let i = 0; i + 1 < chain.length; i++) {
    const step = dex.get(chain[i])?.evolvesTo.find((s) => s.speciesId === chain[i + 1]);
    if (!step) return null;
    const plainLevel =
      step.trigger === "level-up" && step.minLevel && !/\(|knowing|holding|friendship/i.test(step.details ?? "");
    if (plainLevel && rest.length === 0) steps.push([chain[i + 1], step.minLevel!]);
    else rest.push(step.details || step.trigger || "special");
  }
  if (steps.length === 0) return null;
  return {
    chain,
    needLevel: Math.max(...steps.map(([, l]) => l)),
    steps,
    then: rest.length > 0 ? rest.join(", then ") : undefined,
  };
}

export function buildLevelPlan(profiles: ProfileMons[], dex: SpeciesMap, opts: LevelPlanOptions): LevelJob[] {
  const allocation = allocatePending(profiles, dex, opts.maxSpecies, pidLookup(opts.fullSaves));

  // Every copy that isn't needed in its own slot, by species
  const pool = new Map<number, { mon: SlimMon; p: ProfileMons }[]>();
  for (const p of profiles) {
    const a = analyzeProfile(p, dex, opts.maxSpecies);
    const reserved = new Set(reservedForOwnSlot(a).values());
    for (const mon of a.spares) {
      if (mon.isEgg || reserved.has(mon)) continue;
      if (!pool.has(mon.species)) pool.set(mon.species, []);
      pool.get(mon.species)!.push({ mon, p });
    }
  }

  // Copies allocatePending spent on a target that isn't a level job (a Gloom kept for Vileplume) stay out
  const wanted: { target: number; path: Path }[] = [];
  const keepOut = new Set<SlimMon>();
  for (const [target, reason] of allocation.pending) {
    const path = levelPath(dex, reason.from, target);
    if (path) wanted.push({ target, path });
    else keepOut.add(reason.mon);
  }

  const candidate = (mon: SlimMon, p: ProfileMons, needLevel: number): LevelCandidate => {
    const full = findFull(opts.fullSaves, p.profile.id, mon);
    const floor = expForLevel(mon.species, mon.level);
    const exp = full && full.exp >= floor ? full.exp : floor;
    const goal = mon.level >= needLevel ? expForLevel(mon.species, mon.level + 1) : expForLevel(mon.species, needLevel);
    return {
      ...(mon.species === WURMPLE && !full ? { branchUnknown: true } : {}),
      mon,
      profileId: p.profile.id,
      profileLabel: p.profile.label,
      where: slotLabel(p.boxNames, mon.box, mon.slot),
      exp,
      expExact: !!full,
      expToGo: Math.max(0, goal - exp),
      traded: mon.own === false,
    };
  };

  // Most levels first; each takes the cheapest copy left
  // One copy as an option for one target: null when it can't become it by levelling
  const optionFor = (mon: SlimMon, p: ProfileMons, target: number, path: Path) => {
    if (!path.chain.slice(0, -1).includes(mon.species) || keepOut.has(mon)) return null;
    // A Wurmple only becomes the line its personality value picks
    if (mon.species === WURMPLE) {
      const pid = findFull(opts.fullSaves, p.profile.id, mon)?.pid;
      if (pid !== undefined && !wurmpleLine(pid).includes(target)) return null;
    }
    // A copy further along only needs the steps still ahead of it
    const ahead = path.steps.filter(([s]) => path.chain.indexOf(s) > path.chain.indexOf(mon.species));
    if (ahead.length === 0) return null;
    const need = Math.max(...ahead.map(([, l]) => l));
    return { c: candidate(mon, p, need), need, ahead };
  };
  type Option = NonNullable<ReturnType<typeof optionFor>>;
  const jobOf = (target: number, path: Path, best: Option, others: Option[]): LevelJob => ({
    target,
    needLevel: best.need,
    steps: best.ahead,
    then: path.then,
    pick: best.c,
    levelsToGo: Math.max(0, best.need - best.c.mon.level),
    readyNow: best.c.mon.level >= best.need,
    others: others.map((o) => o.c),
  });

  // Most levels first; each takes the cheapest copy left
  wanted.sort((x, y) => y.path.needLevel - x.path.needLevel || x.target - y.target);
  const used = new Set<SlimMon>();
  let jobs: LevelJob[] = [];
  for (const { target, path } of wanted) {
    const options = path.chain
      .slice(0, -1)
      .flatMap((species) => pool.get(species) ?? [])
      .filter(({ mon }) => !used.has(mon))
      .map(({ mon, p }) => optionFor(mon, p, target, path))
      .filter((o): o is Option => o !== null)
      // A Wurmple known to fit beats one that might not, whatever the EXP
      .sort(
        (a, b) =>
          Number(!!a.c.branchUnknown) - Number(!!b.c.branchUnknown) ||
          a.c.expToGo - b.c.expToGo ||
          b.c.mon.level - a.c.mon.level,
      );
    const best = options[0];
    if (!best) continue;
    used.add(best.c.mon);
    jobs.push(jobOf(target, path, best, options.slice(1)));
  }

  // Where the copies allocatePending counted (a placeholder sits in its target's slot) cost no more EXP in total
  // for an evolution family, keep them: moving Pokémon between slots for nothing is worse
  const rootOf = (id: number) => {
    let at = id;
    for (let guard = 0; guard < 4; guard++) at = dex.get(at)?.evolvesFrom ?? at;
    return at;
  };
  const families = new Map<number, LevelJob[]>();
  for (const job of jobs) {
    const root = rootOf(job.target);
    if (!families.has(root)) families.set(root, []);
    families.get(root)!.push(job);
  }
  const profileById = new Map(profiles.map((p) => [p.profile.id, p]));
  for (const group of families.values()) {
    const kept = group.map((job) => {
      const reason = allocation.pending.get(job.target)!;
      const p = profileById.get(reason.profileId);
      const path = wanted.find((w) => w.target === job.target)!.path;
      return p ? optionFor(reason.mon, p, job.target, path) : null;
    });
    if (kept.some((o) => o === null) || new Set(kept.map((o) => o!.c.mon)).size !== kept.length) continue;
    const cost = (list: { expToGo: number }[]) => list.reduce((sum, c) => sum + c.expToGo, 0);
    if (cost(kept.map((o) => o!.c)) > cost(group.map((j) => j.pick))) continue;
    jobs = jobs.map((job) => {
      const i = group.indexOf(job);
      if (i < 0) return job;
      const o = kept[i]!;
      if (o.c.mon === job.pick.mon) return job;
      used.delete(job.pick.mon);
      used.add(o.c.mon);
      const path = wanted.find((w) => w.target === job.target)!.path;
      const others = [job.pick, ...job.others].filter((c) => c.mon !== o.c.mon);
      return { ...jobOf(job.target, path, o, []), others };
    });
  }
  for (const job of jobs) used.add(job.pick.mon);

  // "Others" are only the copies nothing else ended up using
  for (const job of jobs) job.others = job.others.filter((o) => !used.has(o.mon));
  return jobs.sort((a, b) => a.pick.expToGo - b.pick.expToGo || a.target - b.target);
}

/**
 * Who should hold the one Exp. Share: the Pokémon with the most EXP still to
 * go (the rest can be switch-trained). Null when nothing needs more than a
 * level-up.
 */
export function expShareHolder(jobs: readonly LevelJob[]): LevelJob | null {
  const open = jobs.filter((j) => !j.readyNow);
  if (open.length === 0) return null;
  return open.reduce((a, b) => (b.pick.expToGo > a.pick.expToGo ? b : a));
}
