import type { EncounterMethod, Pokemon } from "../types";
import { encounterIsOn, type Clock } from "./available-now";
import { rateHidden } from "./encounter-rates";

// "What can I get next": locations ranked by how many uncaught Pokémon they hold.

/** Encounter methods that need extra setup (a daily outbreak, the Poké Radar, a GBA cartridge, the radio). */
export const SETUP_METHODS: ReadonlySet<string> = new Set([
  "swarm", "poke-radar", "radio",
  "slot2", "slot2-ruby", "slot2-sapphire", "slot2-emerald", "slot2-firered", "slot2-leafgreen",
]);

export type TimeOfDay = "morning" | "day" | "night";
const TIME_ORDER = ["morning", "day", "night"] as const;

export interface NextTarget {
  pokemon: Pokemon;
  /** Already caught — kept so the print can tick it off; not counted in `NextLocation.count` */
  caught: boolean;
  minLevel: number;
  maxLevel: number;
  /** The times of day it can appear; empty when it appears at any time. */
  times: TimeOfDay[];
  /** The selected games that have it here, in the order the games were given */
  games: string[];
  /** The one selected game that has it here, when several games are selected and only one does */
  onlyIn?: string;
  /** A one-time encounter (a legendary, Snorlax) */
  isStatic: boolean;
  /** Comes back after the Elite Four is beaten (from the overrides) */
  respawnsAfterEliteFour: boolean;
  /** What reaching it needs ("Requires Surf"), from the overrides; one per distinct text */
  requirements: string[];
  /**
   * Its encounter rate in percent for each time it appears (null: the same at
   * every time), lowest and highest across the games. Empty for encounters
   * without a rate (gifts, static Pokémon) and for daily ones (see `daily`).
   */
  rates: { times: TimeOfDay[] | null; min: number; max: number }[];
  /** Set when it is only there on some days, so no fixed rate applies */
  daily?: "trophy-garden" | "great-marsh";
  /** Why there is no rate when one might be expected */
  rateNote?: "varies" | "roams";
}

export interface NextLocation {
  slug: string;
  displayName: string;
  /** Distinct uncaught species found here — what the ranking uses. */
  count: number;
  /** Distinct species found here, caught or not. */
  total: number;
  /** Uncaught species here per selected game that has anything here, in the order the games were given */
  perGame: Record<string, number>;
  /** The game with the most uncaught species here (ties: the earlier one in the list); null when none is left */
  bestGame: string | null;
  byMethod: { method: EncounterMethod; targets: NextTarget[] }[];
  /** A caveat about the rates here, when the game changes them day by day */
  note?: string;
}

/**
 * Where the game swaps slots 7–8 (5% each) of the walking table day by day
 * (Platinum's src/overlay006/wild_encounters.c), so the listed rates of the
 * Pokémon normally in those slots are lower on those days.
 */
function locationNote(slug: string): string | undefined {
  if (slug === "trophy-garden-area") {
    return "With the National Dex, Mr. Backlot's two daily Pokémon take this table's two 5% slots, so the regular Pokémon in those slots are up to 10% rarer than listed.";
  }
  if (/^great-marsh-area-\d$/.test(slug)) {
    return "Each day one Pokémon from the binoculars pool takes this area's two 5% slots, so the Pokémon normally in them are up to 10% rarer than listed.";
  }
  return undefined;
}

/**
 * The encounter data lists one row per slot of the game's encounter table, so
 * a Pokémon's rate is the sum of its slots. A slot tied to a time of day (Gen IV)
 * replaces a slot at that time only, so the rate at a time is the untimed slots
 * plus that time's slots — e.g. Starly on Platinum's Route 201: 40% untimed +
 * 10% morning + 10% day = 50% morning, 50% day, 40% night.
 */
interface SlotSums {
  untimed: number;
  timed: Record<TimeOfDay, number>;
  /** Has a slot of its own at some time (rather than only static / gift rows) */
  anyRow: boolean;
  /** The individual untimed slot chances, for the Trophy Garden rule */
  untimedSlots: number[];
  hasTimed: boolean;
  /** Part of a table that doesn't add up to 100% in this game */
  irregular?: boolean;
}

const emptySums = (): SlotSums => ({ untimed: 0, timed: { morning: 0, day: 0, night: 0 }, anyRow: false, untimedSlots: [], hasTimed: false });

function addSlot(sums: SlotSums, d: { chance: number; isStatic?: boolean; timeOfDay?: TimeOfDay }): void {
  const chance = d.isStatic ? 0 : d.chance;
  if (chance > 0) sums.anyRow = true;
  if (d.timeOfDay) {
    sums.timed[d.timeOfDay] += chance;
    sums.hasTimed = true;
  } else {
    sums.untimed += chance;
    sums.untimedSlots.push(chance);
  }
}

/**
 * Methods whose rows are slots of one encounter table, so a rate means
 * something. Walking, surfing and fishing tables must also add up to 100% (see
 * `regularTable`). Swarms, the Poké Radar and Slot 2 replace fixed slots of the
 * walking table (slots 1–2, 5–6 + 11–12, and 9–10 in Platinum's
 * src/overlay006/wild_encounters.c), so their rates hold while they are active.
 * Not rated: gifts, fossils, trades, roamers, honey trees, headbutt trees (one
 * table per tree) and the HG/SS radio, whose slots aren't confirmed.
 */
const TABLE_METHODS = new Set(["walk", "surf", "old-rod", "good-rod", "super-rod", "rock-smash", "dark-grass"]);
const OVERLAY_METHODS = new Set(["swarm", "poke-radar", "slot2", "slot2-ruby", "slot2-sapphire", "slot2-emerald", "slot2-firered", "slot2-leafgreen"]);

/** Rate at each time of day for one game */
function ratesFor(s: SlotSums): Record<TimeOfDay, number> {
  return { morning: s.untimed + s.timed.morning, day: s.untimed + s.timed.day, night: s.untimed + s.timed.night };
}

/**
 * Trophy Garden's daily Pokémon (the ones Mr. Backlot mentions) hold the
 * garden's two 5% slots and nothing else; the regular ones hold other slots too.
 * Checked against Serebii's Trophy Garden page: this gives exactly its 16 daily
 * Pokémon per game (Porygon in Diamond/Pearl, Ditto in Platinum).
 */
const isTrophyGardenDaily = (slug: string, s: SlotSums) =>
  slug === "trophy-garden-area" && !s.hasTimed && s.untimedSlots.length === 2 && s.untimedSlots.every((c) => c === 5);

/** The Great Marsh's binoculars pool: a few of these are in the marsh each day. */
const isGreatMarshDaily = (slug: string, method: string) => slug === "great-marsh" && method === "safari";

const SHORT_TIMES: Record<TimeOfDay, string> = { morning: "M", day: "D", night: "N" };
const timesText = (times: readonly TimeOfDay[], short: boolean) =>
  times.map((t) => (short ? SHORT_TIMES[t] : t)).join("/");

/** "50% morning/day · 40% night", "30%", "10–20%"; "" when there is no rate. */
function rateText(t: Pick<NextTarget, "rates">, short: boolean): string {
  return t.rates
    .map((r) => {
      const pct = r.min === r.max ? `${r.min}%` : `${r.min}–${r.max}%`;
      return r.times ? `${pct} ${timesText(r.times, short)}` : pct;
    })
    .join(" · ");
}

/**
 * Times of day and rate, as one piece: "50% morning/day · 40% night", or "night · 10%".
 * `short` is for the printed table: times as M / D / N and shorter daily notes.
 */
export function whenText(t: Pick<NextTarget, "rates" | "times" | "daily" | "rateNote">, { short = false } = {}): string {
  if (t.daily === "trophy-garden") return short ? "daily (Mr. Backlot) · 5%" : "changes daily (ask Mr. Backlot) · 5% on its day";
  if (t.daily === "great-marsh") return short ? "daily (binoculars) · 10%" : "changes daily (check the binoculars) · 10% on its day";
  if (t.rateNote === "roams") return short ? "roams" : "roams — no fixed place or rate";
  if (t.rateNote === "varies") return [timesText(t.times, short), "rate varies"].filter(Boolean).join(" · ");
  const rate = rateText(t, short);
  // The rate names its own times when they differ; otherwise say the times once
  if (t.rates.some((r) => r.times)) return rate;
  return [timesText(t.times, short), rate].filter(Boolean).join(" · ");
}

/**
 * @param pokemon      the Pokémon of the active generation
 * @param games        the games to look in
 * @param caught       caught ids for the active generation
 * @param includeSetup include outbreak / Poké Radar / Slot 2 / radio encounters
 * @param now          when given, only encounters that are on at that time of day and weekday
 * @param options      keepComplete: also return locations where everything is caught (count 0)
 *
 * Caught Pokémon are kept, flagged `caught`, so a printed sheet can tick them
 * off; the ranking counts only the uncaught ones.
 */
export function buildNextLocations(
  pokemon: Pokemon[],
  games: readonly string[],
  caught: ReadonlySet<number>,
  includeSetup: boolean,
  now?: Clock,
  options: { keepComplete?: boolean } = {},
): NextLocation[] {

  // Every table's total per time of day (all Pokémon, caught or not, without the
  // daily ones): only a table that adds up to 100% is one regular table whose
  // rates can be printed. Several variants listed together (Johto's Safari Zone,
  // National Park's contest days) add up to more.
  const tableTotals = new Map<string, SlotSums>();
  for (const p of pokemon) {
    for (const enc of p.encounters) {
      if (!games.includes(enc.version)) continue;
      for (const loc of enc.locations) {
        const own = new Map<string, SlotSums>();
        for (const d of loc.details) {
          if (!TABLE_METHODS.has(d.method) || d.isStatic) continue;
          let s = own.get(d.method);
          if (!s) own.set(d.method, (s = emptySums()));
          addSlot(s, d);
        }
        for (const [method, s] of own) {
          if (isTrophyGardenDaily(loc.locationAreaSlug, s)) continue;
          const key = `${enc.version}|${loc.locationAreaSlug}|${method}`;
          let total = tableTotals.get(key);
          if (!total) tableTotals.set(key, (total = emptySums()));
          total.untimed += s.untimed;
          for (const t of TIME_ORDER) total.timed[t] += s.timed[t];
        }
      }
    }
  }
  const regularTable = (version: string, slug: string, method: string) => {
    const total = tableTotals.get(`${version}|${slug}|${method}`);
    return !!total && TIME_ORDER.every((t) => Math.abs(ratesFor(total)[t] - 100) < 0.01);
  };
  const locations = new Map<
    string,
    { displayName: string; species: Set<number>; methods: Map<string, Map<number, Acc>> }
  >();

  for (const p of pokemon) {
    for (const enc of p.encounters) {
      if (!games.includes(enc.version)) continue;
      for (const loc of enc.locations) {
        for (const d of loc.details) {
          // NPC trades aren't something you find at a location
          if (d.method === "trade") continue;
          if (!includeSetup && SETUP_METHODS.has(d.method)) continue;
          if (now && !encounterIsOn(p.id, enc.version, loc.locationAreaSlug, d, now)) continue;

          let entry = locations.get(loc.locationAreaSlug);
          if (!entry) {
            entry = { displayName: loc.locationDisplayName, species: new Set(), methods: new Map() };
            locations.set(loc.locationAreaSlug, entry);
          }
          entry.species.add(p.id);

          let targets = entry.methods.get(d.method);
          if (!targets) entry.methods.set(d.method, (targets = new Map()));
          let acc = targets.get(p.id);
          if (!acc) {
            acc = { pokemon: p, minLevel: d.minLevel, maxLevel: d.maxLevel, games: [], sums: new Map(), isStatic: true, respawns: false, requirements: [] };
            targets.set(p.id, acc);
          }
          // One-time only when every row of it here is
          acc.isStatic &&= d.isStatic;
          if (d.respawnsAfterEliteFour) acc.respawns = true;
          if (d.requirement && !acc.requirements.includes(d.requirement)) acc.requirements.push(d.requirement);
          acc.minLevel = Math.min(acc.minLevel, d.minLevel);
          acc.maxLevel = Math.max(acc.maxLevel, d.maxLevel);
          if (!acc.games.includes(enc.version)) acc.games.push(enc.version);

          let sums = acc.sums.get(enc.version);
          if (!sums) acc.sums.set(enc.version, (sums = emptySums()));
          addSlot(sums, d);
          if (TABLE_METHODS.has(d.method) && !regularTable(enc.version, loc.locationAreaSlug, d.method)) sums.irregular = true;
        }
      }
    }
  }

  const order = (list: string[]) => [...list].sort((a, b) => games.indexOf(a) - games.indexOf(b));
  const result: NextLocation[] = [];
  for (const [slug, entry] of locations) {
    const byMethod = Array.from(entry.methods, ([method, targets]) => ({
      method: method as EncounterMethod,
      targets: Array.from(targets.values())
        .map((acc) => toTarget(slug, method, { ...acc, games: order(acc.games) }, caught.has(acc.pokemon.id), games.length))
        .sort((a, b) => a.pokemon.id - b.pokemon.id),
    }));
    // Each uncaught species once per game, whatever the method
    const perGameSets = new Map<string, Set<number>>();
    for (const { targets } of byMethod) {
      for (const t of targets) {
        for (const g of t.games) {
          let set = perGameSets.get(g);
          if (!set) perGameSets.set(g, (set = new Set()));
          if (!t.caught) set.add(t.pokemon.id);
        }
      }
    }
    const perGame: Record<string, number> = {};
    for (const g of order([...perGameSets.keys()])) perGame[g] = perGameSets.get(g)!.size;
    let bestGame: string | null = null;
    for (const [g, n] of Object.entries(perGame)) if (n > 0 && (bestGame === null || n > perGame[bestGame])) bestGame = g;

    const count = [...entry.species].filter((id) => !caught.has(id)).length;
    if (count === 0 && !options.keepComplete) continue;
    result.push({
      slug,
      displayName: entry.displayName,
      count,
      total: entry.species.size,
      perGame,
      bestGame,
      ...(locationNote(slug) ? { note: locationNote(slug) } : {}),
      byMethod,
    });
  }
  return result.sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName));
}

/**
 * "Only show what I can get in [game]": the locations narrowed to the Pokémon
 * that game has there, re-counted and re-ranked for that game alone.
 */
export function onlyInGame(locations: readonly NextLocation[], game: string, keepComplete = false): NextLocation[] {
  const out: NextLocation[] = [];
  for (const loc of locations) {
    if (!(game in loc.perGame)) continue;
    const byMethod = loc.byMethod
      .map((m) => ({ ...m, targets: m.targets.filter((t) => t.games.includes(game)) }))
      .filter((m) => m.targets.length > 0);
    const total = new Set(byMethod.flatMap((m) => m.targets.map((t) => t.pokemon.id))).size;
    const count = loc.perGame[game];
    if (count === 0 && !keepComplete) continue;
    out.push({ ...loc, byMethod, count, total, perGame: { [game]: count }, bestGame: count > 0 ? game : null });
  }
  return out.sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName));
}

type Acc = {
  pokemon: Pokemon; minLevel: number; maxLevel: number; games: string[]; sums: Map<string, SlotSums>;
  isStatic: boolean; respawns: boolean; requirements: string[];
};

function toTarget(slug: string, method: string, acc: Acc, caught: boolean, gameCount: number): NextTarget {
  const perGame = [...acc.sums.values()];
  const base = {
    pokemon: acc.pokemon, caught, minLevel: acc.minLevel, maxLevel: acc.maxLevel, games: acc.games,
    ...(gameCount > 1 && acc.games.length === 1 ? { onlyIn: acc.games[0] } : {}),
    isStatic: acc.isStatic, respawnsAfterEliteFour: acc.respawns, requirements: acc.requirements,
  };

  // When it's there: any time with a slot in some game; a static or gift row counts for every time
  const at = (t: TimeOfDay) => perGame.some((s) => !s.anyRow || ratesFor(s)[t] > 0);
  const present = TIME_ORDER.filter(at);
  const times = present.length === TIME_ORDER.length ? [] : [...present];

  const daily = isGreatMarshDaily(slug, method) ? "great-marsh" as const
    : perGame.length > 0 && perGame.every((s) => isTrophyGardenDaily(slug, s)) ? "trophy-garden" as const
    : undefined;
  if (daily || perGame.every((s) => !s.anyRow)) return { ...base, times, rates: [], ...(daily ? { daily } : {}) };
  if (slug.startsWith("roaming")) return { ...base, times, rates: [], rateNote: "roams" };
  if (!TABLE_METHODS.has(method) && !OVERLAY_METHODS.has(method)) return { ...base, times, rates: [] };
  if (acc.games.some((g) => rateHidden(g, method))) return { ...base, times, rates: [] };
  if (perGame.some((s) => s.irregular)) return { ...base, times, rates: [], rateNote: "varies" };

  // The rate at each time it appears, lowest and highest across the games that have it
  const range = (t: TimeOfDay) => {
    const values = perGame.filter((s) => s.anyRow).map((s) => ratesFor(s)[t]).filter((v) => v > 0);
    return values.length ? { min: Math.min(...values), max: Math.max(...values) } : null;
  };
  const groups: { times: TimeOfDay[]; min: number; max: number }[] = [];
  for (const t of present) {
    const r = range(t);
    if (!r) continue;
    const same = groups.find((g) => g.min === r.min && g.max === r.max);
    if (same) same.times.push(t);
    else groups.push({ times: [t], ...r });
  }
  const rates = groups.length === 1 && groups[0].times.length === TIME_ORDER.length
    ? [{ times: null, min: groups[0].min, max: groups[0].max }]
    : groups.map((g) => ({ ...g, times: g.times as TimeOfDay[] | null }));
  return { ...base, times, rates };
}
