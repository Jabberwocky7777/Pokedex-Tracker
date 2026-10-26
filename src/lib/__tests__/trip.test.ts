import { describe, expect, it } from "vitest";
import { buildNextLocations } from "../what-next";
import { byEffort, effortText, expectedEncounters, notOnRoutes, routeEffort, tripSections, weekdaysOf } from "../trip";
import { makePokemon } from "../../test/fixtures";
import type { Pokemon } from "../../types";
import allPokemon from "../../../public/data/pokemon.json";

const POKEMON = allPokemon as unknown as Pokemon[];

describe("effort", () => {
  it("expects 100 / rate encounters, at the best rate", () => {
    expect(expectedEncounters({ rates: [{ times: null, min: 5, max: 10 }] })).toBe(10);
    expect(expectedEncounters({ rates: [{ times: ["night"], min: 1, max: 1 }, { times: ["day"], min: 4, max: 4 }] })).toBe(25);
    expect(expectedEncounters({ rates: [] })).toBeNull();
    expect(effortText({ rates: [{ times: null, min: 20, max: 20 }] })).toBe("~5 encounters expected");
    expect(effortText({ rates: [] })).toBe("");
  });

  it("adds up a route's uncaught Pokémon, unrated ones as 1, and sorts the easiest first", () => {
    const locs = buildNextLocations(POKEMON, ["platinum"], new Set(), false);
    const r201 = locs.find((l) => l.slug === "sinnoh-route-201-area")!;
    // Starly 50% → 2, Bidoof 50% → 2, Kricketot 10% → 10, and the three starters (gifts) → 1 each
    expect(routeEffort(r201)).toBe(17);
    const sorted = byEffort(locs);
    for (let i = 1; i < sorted.length; i++) expect(routeEffort(sorted[i])).toBeGreaterThanOrEqual(routeEffort(sorted[i - 1]));
  });
});

describe("trip sheets", () => {
  it("knows the weekday events", () => {
    const lapras = buildNextLocations(POKEMON, ["heartgold"], new Set(), false).find((l) => l.slug === "union-cave-b2f")!
      .byMethod.flatMap((m) => m.targets.map((t) => ({ m: m.method, t }))).find(({ t }) => t.pokemon.name === "lapras")!;
    expect(weekdaysOf("union-cave-b2f", lapras.m, lapras.t)).toEqual([5]);
  });

  it("splits by time of day: any time, each timed one under its times, weekday events apart", () => {
    const locs = buildNextLocations(POKEMON, ["platinum"], new Set(), false).filter((l) => l.slug === "sinnoh-route-201-area");
    const sections = tripSections(locs);
    const names = (id: string) => sections.find((s) => s.id === id)?.locations.flatMap((l) => l.byMethod.flatMap((m) => m.targets.map((t) => t.pokemon.displayName))) ?? [];
    expect(sections.map((s) => s.id)).toEqual(["any", "morning", "night"]);
    expect(names("any").sort()).toEqual(["Bidoof", "Chimchar", "Piplup", "Starly", "Turtwig"]);
    expect(names("morning")).toEqual(["Kricketot"]);
    expect(names("night")).toEqual(["Kricketot"]);
  });
});

describe("not on any route", () => {
  const DEX: Pokemon[] = [
    makePokemon(92, "Gastly", ["ghost"], { encounters: { pearl: { chateau: ["walk"] } }, evolvesTo: [{ speciesId: 93, trigger: "level-up", details: "Level 25" }] }),
    makePokemon(93, "Haunter", ["ghost"], { evolvesFrom: 92, evolvesTo: [{ speciesId: 94, trigger: "trade", details: "Trade" }] }),
    makePokemon(94, "Gengar", ["ghost"], { evolvesFrom: 93 }),
    makePokemon(172, "Pichu", ["electric"], { isBaby: true }),
    makePokemon(25, "Pikachu", ["electric"], { evolvesFrom: 172, encounters: { pearl: { garden: ["walk"] } } }),
    makePokemon(63, "Abra", ["psychic"], { encounters: { pearl: { house: ["trade"] } } }),
    makePokemon(151, "Mew", ["psychic"]),
  ];
  DEX.find((p) => p.id === 172)!.eggGroups = ["no-eggs"];
  DEX.find((p) => p.id === 151)!.eggGroups = ["no-eggs"];
  DEX.find((p) => p.id === 151)!.isMythical = true;
  DEX.find((p) => p.id === 92)!.evolvesTo[0].displayName = "Haunter";

  it("groups what the printed routes don't have", () => {
    const entries = notOnRoutes(DEX, new Set([92]), new Set([25]), ["pearl"]);
    expect(entries.map((e) => [e.id, e.group, e.how])).toEqual([
      [93, "evolve", "from Gastly (Level 25)"],
      [94, "trade", "trade Haunter"],
      [172, "breed", "breed Pikachu"],
      [63, "trade", "in-game trade"],
      [151, "event", "event"],
    ]);
  });
});
