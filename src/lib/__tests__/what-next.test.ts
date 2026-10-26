import { describe, expect, it } from "vitest";
import { buildNextLocations, onlyInGame, whenText } from "../what-next";
import { POKEDEX, makePokemon } from "../../test/fixtures";
import type { Pokemon } from "../../types";
import allPokemon from "../../../public/data/pokemon.json";

const POKEMON = allPokemon as unknown as Pokemon[];

// Two Pokémon share a route in both games, a third is there in Diamond only
const ROUTE: Pokemon[] = [
  makePokemon(41, "Zubat", ["poison", "flying"], { encounters: { diamond: { "route-209": ["walk"] }, pearl: { "route-209": ["walk"] }, platinum: { "route-209": ["walk"] } } }),
  makePokemon(39, "Jigglypuff", ["normal"], { encounters: { diamond: { "route-209": ["walk"] }, pearl: { "route-209": ["walk"] }, platinum: { "route-209": ["walk"] } } }),
  makePokemon(355, "Duskull", ["ghost"], { encounters: { platinum: { "route-209": ["walk"] } } }),
  makePokemon(1, "Bulbasaur", ["grass", "poison"], { encounters: { pearl: { "pallet-town": ["gift"] } } }),
];
const GAMES = ["diamond", "pearl", "platinum"];

describe("What's next keeps caught Pokémon", () => {
  it("flags caught ones and counts only the uncaught", () => {
    const [loc] = buildNextLocations(ROUTE, GAMES, new Set([39]), true).filter((l) => l.slug === "route-209");
    expect(loc.count).toBe(2);
    expect(loc.total).toBe(3);
    const targets = loc.byMethod.flatMap((m) => m.targets);
    expect(targets.map((t) => [t.pokemon.displayName, t.caught])).toEqual([["Jigglypuff", true], ["Zubat", false], ["Duskull", false]]);
  });

  it("drops a location with nothing left to catch, unless asked to keep it", () => {
    const caught = new Set([1, 39, 41, 355]);
    expect(buildNextLocations(ROUTE, GAMES, caught, true)).toEqual([]);
    const kept = buildNextLocations(ROUTE, GAMES, caught, true, undefined, { keepComplete: true });
    expect(kept.map((l) => [l.slug, l.count, l.total])).toEqual([["pallet-town", 0, 1], ["route-209", 0, 3]]);
    expect(kept.find((l) => l.slug === "route-209")!.bestGame).toBeNull();
  });

  it("still ranks by uncaught count", () => {
    const locations = buildNextLocations(ROUTE, GAMES, new Set([39, 41]), true);
    expect(locations.map((l) => [l.slug, l.count])).toEqual([["pallet-town", 1], ["route-209", 1]]);
  });

  it("the fixture Pokédex: Gastly caught leaves Old Chateau out by default", () => {
    expect(buildNextLocations(POKEDEX, ["diamond", "pearl"], new Set([92]), true).some((l) => l.slug === "old-chateau")).toBe(false);
    const all = buildNextLocations(POKEDEX, ["diamond", "pearl"], new Set([92]), true, undefined, { keepComplete: true });
    expect(all.find((l) => l.slug === "old-chateau")!.byMethod[0].targets[0].caught).toBe(true);
  });
});

describe("What's next per game", () => {
  it("counts uncaught species per game and picks the best game", () => {
    const [loc] = buildNextLocations(ROUTE, GAMES, new Set([39]), true).filter((l) => l.slug === "route-209");
    expect(loc.perGame).toEqual({ diamond: 1, pearl: 1, platinum: 2 });
    expect(loc.bestGame).toBe("platinum");
  });

  it("breaks ties by the order the games were given", () => {
    const [loc] = buildNextLocations(ROUTE, ["pearl", "diamond"], new Set(), true).filter((l) => l.slug === "route-209");
    expect(loc.bestGame).toBe("pearl");
    expect(Object.keys(loc.perGame)).toEqual(["pearl", "diamond"]);
  });

  it("lists a target's games in the given order and flags the only game that has it", () => {
    const loc = buildNextLocations(ROUTE, ["platinum", "pearl", "diamond"], new Set(), true).find((l) => l.slug === "route-209")!;
    const byName = (n: string) => loc.byMethod.flatMap((m) => m.targets).find((t) => t.pokemon.displayName === n)!;
    expect(byName("Zubat").games).toEqual(["platinum", "pearl", "diamond"]);
    expect(byName("Zubat").onlyIn).toBeUndefined();
    expect(byName("Duskull").onlyIn).toBe("platinum");
  });

  it("doesn't flag 'only in' when only one game is selected", () => {
    const loc = buildNextLocations(ROUTE, ["platinum"], new Set(), true).find((l) => l.slug === "route-209")!;
    expect(loc.byMethod.flatMap((m) => m.targets).every((t) => t.onlyIn === undefined)).toBe(true);
  });
});

describe("Only what one game has", () => {
  it("narrows each location to that game and re-ranks", () => {
    const all = buildNextLocations(ROUTE, GAMES, new Set([39]), true);
    const pearl = onlyInGame(all, "pearl");
    expect(pearl.map((l) => [l.slug, l.count, l.total])).toEqual([["pallet-town", 1, 1], ["route-209", 1, 2]]);
    expect(pearl[1].byMethod.flatMap((m) => m.targets).some((t) => t.pokemon.displayName === "Duskull")).toBe(false);
    expect(onlyInGame(all, "diamond").map((l) => l.slug)).toEqual(["route-209"]);
  });
});

describe("What's next markers, from the real data", () => {
  const target = (games: string[], slug: string, name: string) =>
    buildNextLocations(POKEMON, games, new Set(), true).find((l) => l.slug === slug)!
      .byMethod.flatMap((m) => m.targets).find((t) => t.pokemon.displayName === name)!;

  it("flags one-time encounters and Pokémon that come back after the Elite Four", () => {
    const giratina = buildNextLocations(POKEMON, ["platinum"], new Set(), true)
      .flatMap((l) => l.byMethod.flatMap((m) => m.targets)).find((t) => t.pokemon.displayName === "Giratina")!;
    expect(giratina.isStatic).toBe(true);
    expect(target(["platinum"], "sinnoh-route-201-area", "Starly").isStatic).toBe(false);
    // FireRed's legendary birds come back after the Elite Four if they fainted (overrides.json)
    const zapdos = target(["firered"], "power-plant", "Zapdos");
    expect(zapdos.isStatic).toBe(true);
    expect(zapdos.respawnsAfterEliteFour).toBe(true);
    expect(target(["platinum"], "sinnoh-route-201-area", "Starly").respawnsAfterEliteFour).toBe(false);
  });
});

describe("whenText, short", () => {
  it("abbreviates the times of day for the printed table", () => {
    const t = { rates: [{ times: ["morning", "day"] as ("morning" | "day")[], min: 50, max: 50 }, { times: ["night" as const], min: 40, max: 40 }], times: [] };
    expect(whenText(t)).toBe("50% morning/day · 40% night");
    expect(whenText(t, { short: true })).toBe("50% M/D · 40% N");
    expect(whenText({ rates: [{ times: null, min: 10, max: 10 }], times: ["night"] }, { short: true })).toBe("N · 10%");
  });
});
