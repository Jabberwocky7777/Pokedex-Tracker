import { describe, expect, it } from "vitest";
import { buildNextLocations, whenText } from "../what-next";
import { rateHidden } from "../encounter-rates";
import type { Pokemon } from "../../types";
import allPokemon from "../../../public/data/pokemon.json";

// Against the real encounter data. Checked by hand (2026-10-23) against Platinum's
// encounter tables in pret/pokeplatinum (res/field/encounters/*.json: slots
// 20/20/10/10/10/10/5/5/4/4/1/1, slots 3–4 swapped by day and by night in
// src/overlay006/wild_encounters.c) and Serebii's Pokéarth pages. Serebii swaps
// Starly and Bidoof at night on Route 201; the decompilation gives Starly 40%,
// Bidoof 50%, as the data does.
const POKEMON = allPokemon as unknown as Pokemon[];
const row = (games: string[], slug: string, name: string, method?: string) => {
  const loc = buildNextLocations(POKEMON, games, new Set(), true).find((l) => l.slug === slug)!;
  const target = loc.byMethod.filter((m) => !method || m.method === method).flatMap((m) => m.targets).find((t) => t.pokemon.displayName === name)!;
  return whenText(target);
};

describe("What's next rates add up the slots per time of day", () => {
  it("Platinum Route 201 (decompilation: Starly 50/50/40, Bidoof 40/50/50, Kricketot 10/–/10)", () => {
    expect(row(["platinum"], "sinnoh-route-201-area", "Starly", "walk")).toBe("50% morning/day · 40% night");
    expect(row(["platinum"], "sinnoh-route-201-area", "Bidoof", "walk")).toBe("40% morning · 50% day/night");
    expect(row(["platinum"], "sinnoh-route-201-area", "Kricketot", "walk")).toBe("10% morning/night");
  });

  it("Platinum Trophy Garden (decompilation and Serebii: Staravia 20/30/10, Kricketune 10/–/20, Pichu 30, Roselia 30)", () => {
    expect(row(["platinum"], "trophy-garden-area", "Staravia")).toBe("20% morning · 30% day · 10% night");
    expect(row(["platinum"], "trophy-garden-area", "Kricketune")).toBe("10% morning · 20% night");
    expect(row(["platinum"], "trophy-garden-area", "Pichu")).toBe("30%");
    expect(row(["platinum"], "trophy-garden-area", "Roselia")).toBe("30%");
  });

  it("Diamond Trophy Garden (Serebii: Pichu 30/10/10, Staravia 20/40/20, Kricketune 10/10/30)", () => {
    expect(row(["diamond"], "trophy-garden-area", "Pichu")).toBe("30% morning · 10% day/night");
    expect(row(["diamond"], "trophy-garden-area", "Staravia")).toBe("20% morning/night · 40% day");
    expect(row(["diamond"], "trophy-garden-area", "Kricketune")).toBe("10% morning/day · 30% night");
  });

  it("marks Trophy Garden's daily Pokémon instead of giving them a fixed rate — Serebii's 16 per game", () => {
    const daily = (game: string) => buildNextLocations(POKEMON, [game], new Set(), true)
      .find((l) => l.slug === "trophy-garden-area")!.byMethod.flatMap((m) => m.targets)
      .filter((t) => t.daily === "trophy-garden").map((t) => t.pokemon.displayName).sort();
    const shared = ["Azurill", "Bonsly", "Castform", "Chansey", "Clefairy", "Cleffa", "Eevee", "Happiny", "Igglybuff", "Jigglypuff", "Marill", "Meowth", "Mime Jr.", "Minun", "Plusle"];
    expect(daily("diamond")).toEqual([...shared, "Porygon"].sort());
    expect(daily("platinum")).toEqual([...shared, "Ditto"].sort());
    expect(row(["platinum"], "trophy-garden-area", "Clefairy")).toBe("changes daily (ask Mr. Backlot) · 5% on its day");
  });

  it("adds up fishing slots: Magikarp is every Old Rod slot on Route 224", () => {
    expect(row(["platinum"], "sinnoh-route-224-area", "Magikarp", "old-rod")).toBe("100%");
  });

  it("marks the Great Marsh binoculars pool as daily", () => {
    expect(row(["platinum"], "great-marsh", "Kangaskhan")).toBe("changes daily (check the binoculars) · 10% on its day");
  });

  it("gives no rate where there isn't one table to read it from", () => {
    expect(row(["platinum"], "roaming-sinnoh", "Mesprit")).toBe("roams — no fixed place or rate");
    expect(row(["firered"], "pallet-town-area", "Bulbasaur")).toBe("");                              // a gift
    expect(row(["heartgold"], "johto-safari-zone-meadow", "Clefairy", "walk")).toMatch(/rate varies$/); // several tables
    expect(row(["heartgold"], "national-park-area", "Caterpie", "walk")).toMatch(/rate varies$/);
  });

  it("shows no rate for HG/SS Rock Smash, whose data is known to be wrong (90/10; the game rolls 80/20)", () => {
    expect(row(["heartgold"], "kanto-sea-route-19-area", "Kingler", "rock-smash")).toBe("");
    expect(row(["soulsilver"], "cianwood-city-area", "Krabby", "rock-smash")).toBe("");
    expect(rateHidden("heartgold", "rock-smash")).toBe(true);
    expect(rateHidden("heartgold", "walk")).toBe(false);
    expect(rateHidden("emerald", "rock-smash")).toBe(false);
    // Gen III Rock Smash still has its rate
    expect(row(["emerald"], "hoenn-route-111-area", "Geodude", "rock-smash")).toMatch(/^\d+%$/);
  });

  it("keeps the slot-replacing methods' rates: a swarm is slots 1–2, 40%", () => {
    expect(row(["diamond"], "sinnoh-route-229-area", "Pidgey", "swarm")).toBe("40%");
  });

  it("notes where the game swaps two slots daily", () => {
    const loc = (slug: string) => buildNextLocations(POKEMON, ["platinum"], new Set(), true).find((l) => l.slug === slug)!;
    expect(loc("trophy-garden-area").note).toMatch(/Mr. Backlot/);
    expect(loc("great-marsh-area-1").note).toMatch(/binoculars/);
    expect(loc("sinnoh-route-201-area").note).toBeUndefined();
  });

  it("only prints rates from tables that add up to 100% at every time of day", () => {
    for (const game of ["platinum", "diamond", "emerald", "firered", "heartgold"]) {
      for (const l of buildNextLocations(POKEMON, [game], new Set(), false)) {
        for (const m of l.byMethod) {
          if (!["walk", "surf", "old-rod", "good-rod", "super-rod", "rock-smash"].includes(m.method)) continue;
          const rated = m.targets.filter((t) => t.rates.length > 0);
          if (rated.length === 0 || rated.length < m.targets.filter((t) => !t.daily).length) continue;
          for (const time of ["morning", "day", "night"] as const) {
            const sum = rated.reduce((n, t) => n + (t.rates.find((r) => !r.times || r.times.includes(time))?.min ?? 0), 0);
            expect(sum, `${game} ${l.slug} ${m.method} ${time}`).toBe(100);
          }
        }
      }
    }
  });
});
