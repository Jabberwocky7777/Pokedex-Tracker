import { describe, expect, it } from "vitest";
import { availableNow, clockOf, describeClock, encounterIsOn, eventsToday, timeOfDay, type Clock } from "../available-now";
import { filterPokemon } from "../../hooks/usePokemonFilter";
import { buildNextLocations } from "../what-next";
import { DAILY_EVENT_SECTIONS } from "../../data/daily-events";
import metaData from "../../data/meta.json";
import type { MetaData, Pokemon } from "../../types";

// Loaded through a non-literal specifier so the app's type-check doesn't need Node's types
const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync: (path: string) => Uint8Array };
const allPokemon = JSON.parse(new TextDecoder().decode(fs.readFileSync("public/data/pokemon.json"))) as Pokemon[];
const meta = metaData as MetaData;
const id = (name: string) => allPokemon.find((p) => p.name === name)!.id;

// 2026-10-12 is a Monday
const at = (weekday: number, hour: number, minute = 0) => new Date(2026, 9, 11 + weekday, hour, minute);
const [SUN, MON, TUE, THU, FRI, SAT] = [0, 1, 2, 4, 5, 6];
const HGSS = ["heartgold", "soulsilver"];
const now = (weekday: number, hour: number): Clock => clockOf(at(weekday, hour));

describe("the clock", () => {
  it("splits the day the way Generation IV does", () => {
    expect([3, 4, 9, 10, 19, 20, 23, 0].map((h) => timeOfDay(at(MON, h)))).toEqual(
      ["night", "morning", "morning", "day", "day", "night", "night", "night"]);
    expect(timeOfDay(at(MON, 9, 59))).toBe("morning");
    expect(timeOfDay(at(MON, 19, 59))).toBe("day");
  });

  it("reads the weekday from the date", () => {
    expect(clockOf(at(FRI, 21))).toEqual({ time: "night", weekday: 5 });
    expect(clockOf(at(SUN, 12))).toEqual({ time: "day", weekday: 0 });
    expect(describeClock(clockOf(at(FRI, 21)))).toBe("Friday, night (20:00–3:59)");
  });
});

describe("encounterIsOn", () => {
  it("needs the right time of day for a timed row, and takes an untimed one at any time", () => {
    expect(encounterIsOn(163, "heartgold", "johto-route-29-area", { method: "walk", timeOfDay: "night" }, now(MON, 22))).toBe(true);
    expect(encounterIsOn(163, "heartgold", "johto-route-29-area", { method: "walk", timeOfDay: "night" }, now(MON, 12))).toBe(false);
    expect(encounterIsOn(16, "diamond", "sinnoh-route-229-area", { method: "walk" }, now(MON, 3))).toBe(true);
  });

  it("keeps weekday events to their day, in their games only", () => {
    const lapras = (version: string, clock: Clock) => encounterIsOn(131, version, "union-cave-b2f", { method: "static" }, clock);
    expect(lapras("heartgold", now(FRI, 12))).toBe(true);
    expect(lapras("heartgold", now(THU, 12))).toBe(false);
    expect(lapras("soulsilver", now(SAT, 12))).toBe(false);
    // The same Pokémon somewhere else is not the event
    expect(encounterIsOn(131, "heartgold", "somewhere-else", { method: "surf" }, now(MON, 12))).toBe(true);
    // Drifloon is the Sinnoh games' Friday event
    expect(encounterIsOn(425, "platinum", "valley-windworks-area", { method: "static" }, now(FRI, 8))).toBe(true);
    expect(encounterIsOn(425, "platinum", "valley-windworks-area", { method: "static" }, now(MON, 8))).toBe(false);
  });

  it("treats the National Park's untimed grass encounters as the Bug-Catching Contest", () => {
    const park = (pokemonId: number, detail: { method: "walk" | "headbutt"; timeOfDay?: "morning" | "day" | "night" }, clock: Clock) =>
      encounterIsOn(pokemonId, "heartgold", "national-park-area", detail, clock);
    expect(park(123, { method: "walk" }, now(TUE, 12))).toBe(true);
    expect(park(123, { method: "walk" }, now(THU, 12))).toBe(true);
    expect(park(123, { method: "walk" }, now(SAT, 12))).toBe(true);
    expect(park(123, { method: "walk" }, now(MON, 12))).toBe(false);
    // Ordinary park encounters carry a time of day and are there every day
    expect(park(10, { method: "walk", timeOfDay: "day" }, now(MON, 12))).toBe(true);
    // Headbutt trees are not the contest
    expect(park(204, { method: "headbutt" }, now(MON, 12))).toBe(true);
  });
});

describe("availableNow on the real data", () => {
  const gen4 = allPokemon.filter((p) => p.id <= 493);
  const set = (clock: Clock, games = HGSS) => availableNow(gen4, games, clock);

  it("follows the time of day in HeartGold/SoulSilver", () => {
    // In HeartGold, Gastly is only out at night and Sunkern only by day
    expect(set(now(MON, 22), ["heartgold"]).has(id("gastly"))).toBe(true);
    expect(set(now(MON, 12), ["heartgold"]).has(id("gastly"))).toBe(false);
    expect(set(now(MON, 12), ["heartgold"]).has(id("sunkern"))).toBe(true);
    expect(set(now(MON, 6), ["heartgold"]).has(id("sunkern"))).toBe(false);
    // Hoothoot can be shaken out of a tree at any hour, so it never drops out
    expect(set(now(MON, 12), ["heartgold"]).has(id("hoothoot"))).toBe(true);
  });

  it("follows the weekday for Drifloon and the contest's Scyther", () => {
    // (Lapras is also in the Safari Zone, so it stays available off Fridays — only its Union Cave row goes)
    expect(set(now(MON, 12)).has(id("lapras"))).toBe(true);
    expect(set(now(FRI, 12), ["diamond"]).has(id("drifloon"))).toBe(true);
    expect(set(now(SUN, 12), ["diamond"]).has(id("drifloon"))).toBe(false);
    // Scyther is only in the National Park in HeartGold (the contest), so off-days rule it out
    expect(set(now(TUE, 12), ["heartgold"]).has(id("scyther"))).toBe(true);
    expect(set(now(MON, 12), ["heartgold"]).has(id("scyther"))).toBe(false);
  });

  it("is never more than what is catchable", () => {
    const anyTime = new Set(gen4.filter((p) => p.encounters.some((e) => e.version === "platinum" && e.locations.some((l) => l.details.some((d) => d.method !== "trade")))).map((p) => p.id));
    for (const clock of [now(MON, 6), now(MON, 12), now(FRI, 22)]) {
      const on = set(clock, ["platinum"]);
      expect([...on].filter((x) => !anyTime.has(x))).toEqual([]);
      expect(on.size).toBeGreaterThan(200);
    }
    expect(set(now(MON, 12), ["platinum"]).has(id("mew"))).toBe(false);
  });

  it("lists today's events for the selected games", () => {
    expect(eventsToday(HGSS, now(FRI, 12)).map((e) => e.id)).toEqual(["lapras-friday"]);
    expect(eventsToday(["platinum"], now(FRI, 12)).map((e) => e.id)).toEqual(["drifloon-friday"]);
    expect(eventsToday(HGSS, now(SAT, 12)).map((e) => e.id)).toEqual(["bug-contest"]);
    expect(eventsToday(HGSS, now(MON, 12))).toEqual([]);
  });
});

describe("the tracker filter and What's next with a fixed clock", () => {
  const filter = (clock: Clock, games: string[]) =>
    filterPokemon({
      allPokemon, meta, activeGeneration: 4, dexMode: "national", activeGames: games as never,
      availabilityMode: "now", searchQuery: "", clock,
    });
  const bright = (clock: Clock, games: string[], name: string) => filter(clock, games).find((p) => p.name === name)!.isHighlighted;

  it("highlights only what is on right now", () => {
    expect(bright(now(MON, 22), ["heartgold"], "gastly")).toBe(true);
    expect(bright(now(MON, 12), ["heartgold"], "gastly")).toBe(false);
    expect(bright(now(TUE, 12), ["heartgold"], "scyther")).toBe(true);
    expect(bright(now(FRI, 12), ["heartgold"], "scyther")).toBe(false);
    // Everything stays in the list; the mode dims, it doesn't hide
    expect(filter(now(MON, 12), ["heartgold"])).toHaveLength(493);
  });

  it("What's next drops locations' Pokémon that are off right now", () => {
    const gen4 = allPokemon.filter((p) => p.id <= 493);
    const species = (clock?: Clock) =>
      new Set(buildNextLocations(gen4, ["heartgold"], new Set(), false, clock).flatMap((l) => l.byMethod.flatMap((m) => m.targets.map((t) => t.pokemon.name))));
    expect(species().has("scyther")).toBe(true);
    expect(species(now(MON, 12)).has("scyther")).toBe(false);
    expect(species(now(SAT, 12)).has("scyther")).toBe(true);
    expect(species(now(MON, 12)).has("gastly")).toBe(false);
    expect(species(now(MON, 22)).has("gastly")).toBe(true);
    // Lapras's Union Cave row is gone on a Monday, but its Safari Zone one is not
    const at = (clock: Clock) => buildNextLocations(gen4, ["heartgold"], new Set(), false, clock)
      .filter((l) => l.byMethod.some((m) => m.targets.some((t) => t.pokemon.name === "lapras"))).map((l) => l.slug);
    expect(at(now(MON, 12))).not.toContain("union-cave-b2f");
    expect(at(now(FRI, 12))).toContain("union-cave-b2f");
  });
});

describe("the daily checklist's weekly sections", () => {
  it("come from the weekly events, with the days as a note", () => {
    const weekly = DAILY_EVENT_SECTIONS.filter((s) => s.id.startsWith("weekly-"));
    expect(weekly.map((s) => s.games)).toEqual(["D/P/Pt", "HG/SS"]);
    const hgss = weekly[1].pokemon;
    expect(hgss.find((p) => p.name === "Lapras")).toMatchObject({ location: "Union Cave (B2F)", days: [5], note: "Fridays" });
    expect(hgss.find((p) => p.name === "Scyther")?.note).toBe("Tuesdays, Thursdays and Saturdays");
  });
});
