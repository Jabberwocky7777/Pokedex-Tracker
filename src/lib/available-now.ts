/**
 * "Available right now": which encounters are on at this moment by the device's
 * clock — the Generation IV morning / day / night encounters, and the
 * events tied to a day of the week (data/weekly-events.ts). Pure: every function
 * takes the clock, so the time logic is tested with a fixed one.
 *
 * The games use the console's clock, which this assumes is set like the device's.
 */
import type { EncounterDetail, Pokemon } from "../types";
import { WEEKLY_EVENTS, WEEKDAY_NAMES } from "../data/weekly-events";

export type TimeOfDay = "morning" | "day" | "night";

export interface Clock {
  time: TimeOfDay;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

/** Generation IV's day: morning 4:00–9:59, day 10:00–19:59, night 20:00–3:59. */
export function timeOfDay(date: Date): TimeOfDay {
  const hour = date.getHours();
  if (hour >= 4 && hour < 10) return "morning";
  if (hour >= 10 && hour < 20) return "day";
  return "night";
}

export const clockOf = (date: Date): Clock => ({ time: timeOfDay(date), weekday: date.getDay() });

const TIME_LABELS: Record<TimeOfDay, string> = {
  morning: "morning (4:00–9:59)", day: "day (10:00–19:59)", night: "night (20:00–3:59)",
};

/** "Friday, night (20:00–3:59)" */
export const describeClock = (clock: Clock): string => `${WEEKDAY_NAMES[clock.weekday]}, ${TIME_LABELS[clock.time]}`;

/** Is this one encounter row on at this time, on this weekday? */
export function encounterIsOn(
  pokemonId: number, version: string, areaSlug: string, detail: Pick<EncounterDetail, "timeOfDay" | "method">, clock: Clock,
): boolean {
  if (detail.timeOfDay && detail.timeOfDay !== clock.time) return false;
  const event = WEEKLY_EVENTS.find((e) =>
    e.slug === areaSlug && (e.games as string[]).includes(version) &&
    (e.rows === "untimed-walk" ? detail.method === "walk" && !detail.timeOfDay : e.pokemon.some((p) => p.id === pokemonId)));
  return !event || event.days.includes(clock.weekday);
}

/**
 * The Pokémon that can be met right now in one of the games: an encounter of
 * any kind except an NPC trade that is on at this time of day and weekday.
 */
export function availableNow(pokemon: readonly Pokemon[], games: readonly string[], clock: Clock): Set<number> {
  const ids = new Set<number>();
  for (const p of pokemon) {
    const on = p.encounters.some((enc) =>
      games.includes(enc.version) &&
      enc.locations.some((loc) =>
        loc.details.some((d) => d.method !== "trade" && encounterIsOn(p.id, enc.version, loc.locationAreaSlug, d, clock))));
    if (on) ids.add(p.id);
  }
  return ids;
}

/** The weekly events of these games that are on today. */
export function eventsToday(games: readonly string[], clock: Clock) {
  return WEEKLY_EVENTS.filter((e) => e.days.includes(clock.weekday) && e.games.some((g) => games.includes(g)));
}
