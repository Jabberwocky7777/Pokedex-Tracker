import type { Pokemon } from "../types";
import { WEEKLY_EVENTS } from "../data/weekly-events";
import type { NextLocation, NextTarget, TimeOfDay } from "./what-next";

// Trip tools for What's next: effort ("~20 encounters expected"), the easiest-
// first ranking, time-of-day trip sheets, and what isn't on any printed route.

/**
 * Encounters you can expect before meeting it: 100 / rate, at the best time
 * and in the best game. Null for encounters without a rate (gifts, one-time
 * Pokémon, daily ones), which count as quick.
 */
export function expectedEncounters(t: Pick<NextTarget, "rates">): number | null {
  const best = Math.max(0, ...t.rates.map((r) => r.max));
  return best > 0 ? Math.round(100 / best) : null;
}

/** "~20 encounters expected", or "" for an unrated encounter */
export function effortText(t: Pick<NextTarget, "rates">): string {
  const n = expectedEncounters(t);
  return n === null ? "" : `~${n} encounter${n === 1 ? "" : "s"} expected`;
}

/** A route's effort: the expected encounters of every uncaught, reachable Pokémon there, counting unrated ones as 1 */
export function routeEffort(loc: NextLocation): number {
  const seen = new Map<number, number>();
  for (const { targets } of loc.byMethod) {
    for (const t of targets) {
      if (t.caught || t.locked) continue;
      const n = expectedEncounters(t) ?? 1;
      // A Pokémon met several ways here counts once, by its easiest way
      seen.set(t.pokemon.id, Math.min(n, seen.get(t.pokemon.id) ?? Infinity));
    }
  }
  return [...seen.values()].reduce((a, b) => a + b, 0);
}

/** "Easiest first": the least expected effort first; ties go to more Pokémon, then by name. */
export function byEffort(locations: readonly NextLocation[]): NextLocation[] {
  const effort = new Map(locations.map((l) => [l.slug, routeEffort(l)]));
  return [...locations].sort((a, b) =>
    effort.get(a.slug)! - effort.get(b.slug)! || b.count - a.count || a.displayName.localeCompare(b.displayName));
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The weekdays a target is limited to, from data/weekly-events.ts (Drifloon
 * and Lapras on Fridays, the Bug-Catching Contest). Null when it's there every day.
 * The contest is the National Park's untimed grass rows, so an untimed walking
 * target there counts as a contest one.
 */
export function weekdaysOf(slug: string, method: string, t: Pick<NextTarget, "pokemon" | "games" | "times">): number[] | null {
  const event = WEEKLY_EVENTS.find((e) =>
    e.slug === slug && e.games.some((g) => t.games.includes(g)) &&
    (e.rows === "untimed-walk" ? method === "walk" && t.times.length === 0 : e.pokemon.some((p) => p.id === t.pokemon.id)));
  return event ? event.days : null;
}

export const weekdayText = (days: number[]) => days.map((d) => WEEKDAYS[d]).join("/");

export type TripSectionId = "any" | TimeOfDay | "weekday";
export interface TripSection { id: TripSectionId; title: string; locations: NextLocation[] }

const SECTION_TITLES: Record<TripSectionId, string> = {
  any: "Any time",
  morning: "Morning (4:00–10:00)",
  day: "Day (10:00–20:00)",
  night: "Night (20:00–4:00)",
  weekday: "Only on some weekdays",
};

/**
 * Trip sheets: the locations split by when their Pokémon appear. A Pokémon
 * there at any time goes under "Any time"; one tied to times of day goes under
 * each of its times; one tied to weekdays goes under "Only on some weekdays".
 * Sections and locations with nothing in them are left out; order is kept.
 */
export function tripSections(locations: readonly NextLocation[]): TripSection[] {
  const sectionOf = (slug: string, method: string, t: NextTarget): TripSectionId[] => {
    if (weekdaysOf(slug, method, t)) return ["weekday"];
    return t.times.length === 0 ? ["any"] : t.times;
  };
  const ids: TripSectionId[] = ["any", "morning", "day", "night", "weekday"];
  return ids.map((id) => ({
    id,
    title: SECTION_TITLES[id],
    locations: locations.flatMap((loc) => {
      const byMethod = loc.byMethod
        .map((m) => ({ ...m, targets: m.targets.filter((t) => sectionOf(loc.slug, m.method, t).includes(id)) }))
        .filter((m) => m.targets.length > 0);
      return byMethod.length > 0 ? [{ ...loc, byMethod }] : [];
    }),
  })).filter((s) => s.locations.length > 0);
}

export type AppendixGroup = "evolve" | "trade" | "breed" | "event";
export interface AppendixEntry { id: number; name: string; group: AppendixGroup; how: string }

export const APPENDIX_TITLES: Record<AppendixGroup, string> = {
  evolve: "Evolve",
  trade: "Trade (in-game trades and trade evolutions)",
  breed: "Breed",
  event: "Event or another game",
};

/**
 * "Not on any route": the uncaught Pokémon that none of the printed routes has,
 * with how to get them instead — evolve (from what), trade (an in-game trade or
 * a trade evolution), breed (from a later stage) or an event / another game.
 */
export function notOnRoutes(
  pokemon: readonly Pokemon[],
  onRoutes: ReadonlySet<number>,
  caught: ReadonlySet<number>,
  games: readonly string[],
): AppendixEntry[] {
  const byId = new Map(pokemon.map((p) => [p.id, p]));
  const out: AppendixEntry[] = [];
  for (const p of pokemon) {
    if (caught.has(p.id) || onRoutes.has(p.id)) continue;
    const from = p.evolvesFrom !== null ? byId.get(p.evolvesFrom) : undefined;
    const step = from?.evolvesTo.find((s) => s.speciesId === p.id);
    const npcTrade = p.encounters.some((e) => games.includes(e.version) && e.locations.some((l) => l.details.some((d) => d.method === "trade")));
    const later = pokemon.filter((q) => q.evolvesFrom === p.id);
    if (from && step?.trigger === "trade") out.push({ id: p.id, name: p.displayName, group: "trade", how: `trade ${from.displayName}${step.details && step.details !== "Trade" ? ` (${step.details})` : ""}` });
    else if (npcTrade) out.push({ id: p.id, name: p.displayName, group: "trade", how: "in-game trade" });
    else if (from) out.push({ id: p.id, name: p.displayName, group: "evolve", how: `from ${from.displayName}${step?.details ? ` (${step.details})` : ""}` });
    else if (later.length > 0 && (p.isBaby || !p.eggGroups.includes("no-eggs"))) {
      out.push({ id: p.id, name: p.displayName, group: "breed", how: `breed ${later.map((q) => q.displayName).join(" or ")}` });
    } else out.push({ id: p.id, name: p.displayName, group: "event", how: p.isMythical ? "event" : "another game or an event" });
  }
  return out;
}
