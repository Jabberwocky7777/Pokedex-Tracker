/**
 * Encounters that only happen on certain days of the week. The encounter data
 * lists them as ordinary rows, so the "available right now" filter needs this
 * to know when they are off. Hand-written; only events that are certain.
 */
import type { GameVersion } from "../types";

export interface WeeklyEvent {
  id: string;
  title: string;
  /** For the daily checklist's tab, e.g. "D/P/Pt" */
  gamesLabel: string;
  games: GameVersion[];
  /** 0 = Sunday … 6 = Saturday, as Date.getDay() */
  days: number[];
  /** The encounter area the event happens in (a locationAreaSlug) and what to call it */
  slug: string;
  place: string;
  /** The Pokémon whose rows in that area belong to the event */
  pokemon: { id: number; name: string }[];
  /**
   * "untimed-walk": the event is every grass encounter in the area that has no
   * time of day, whichever Pokémon it is, and `pokemon` is only what the
   * checklist names. (The National Park's ordinary encounters all have a time
   * of day in the data; the contest's have none.)
   */
  rows?: "untimed-walk";
  how: string;
}

export const WEEKLY_EVENTS: WeeklyEvent[] = [
  {
    id: "drifloon-friday",
    title: "Drifloon",
    gamesLabel: "D/P/Pt",
    games: ["diamond", "pearl", "platinum"],
    days: [5],
    slug: "valley-windworks-area",
    place: "Valley Windworks",
    pokemon: [{ id: 425, name: "Drifloon" }],
    how: "Drifloon floats outside the Valley Windworks on Fridays, once Team Galactic has been cleared out.",
  },
  {
    id: "lapras-friday",
    title: "Lapras",
    gamesLabel: "HG/SS",
    games: ["heartgold", "soulsilver"],
    days: [5],
    slug: "union-cave-b2f",
    place: "Union Cave (B2F)",
    pokemon: [{ id: 131, name: "Lapras" }],
    how: "Lapras surfaces at the bottom of Union Cave every Friday. It needs Surf to reach.",
  },
  {
    id: "bug-contest",
    title: "Bug-Catching Contest",
    gamesLabel: "HG/SS",
    games: ["heartgold", "soulsilver"],
    days: [2, 4, 6],
    slug: "national-park-area",
    place: "National Park",
    rows: "untimed-walk",
    // The ones found in the park only during the contest
    pokemon: [
      { id: 123, name: "Scyther" }, { id: 127, name: "Pinsir" }, { id: 12, name: "Butterfree" }, { id: 15, name: "Beedrill" },
      { id: 46, name: "Paras" }, { id: 48, name: "Venonat" },
    ],
    how: "The contest runs in the National Park on Tuesdays, Thursdays and Saturdays. You keep the Pokémon you enter.",
  },
];

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Fridays", "Tuesdays, Thursdays and Saturdays" */
export function daysLabel(days: readonly number[]): string {
  const names = days.map((d) => `${WEEKDAY_NAMES[d]}s`);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
}
