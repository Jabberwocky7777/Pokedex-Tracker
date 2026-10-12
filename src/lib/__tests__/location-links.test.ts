import { describe, expect, it } from "vitest";
import { normalizePlace, placeName, resolvePlace } from "../location-links";
import { generationOfVersion } from "../generation";
import { GEN3_TM_LOCATIONS, GEN4_TM_LOCATIONS } from "../tm-locations";
import { DAILY_EVENT_SECTIONS } from "../../data/daily-events";
import type { Pokemon } from "../../types";

// ── A small made-up world ────────────────────────────────────────────────────

/** A Pokémon found in these areas: [slug, display name, ...games]. */
function pokemonIn(...areas: [slug: string, name: string, ...games: string[]][]): Pokemon {
  const byGame = new Map<string, { locationAreaSlug: string; locationDisplayName: string; details: never[] }[]>();
  for (const [slug, name, ...games] of areas) {
    for (const game of games) {
      byGame.set(game, [...(byGame.get(game) ?? []), { locationAreaSlug: slug, locationDisplayName: name, details: [] }]);
    }
  }
  return { encounters: Array.from(byGame, ([version, locations]) => ({ version, locations })) } as unknown as Pokemon;
}

const world: Pokemon[] = [
  pokemonIn(
    ["johto-route-32-area", "Route 32", "heartgold", "soulsilver"],
    ["unova-route-320-area", "Route 320", "heartgold"],
    ["mt-ember-area", "Mt Ember", "firered", "leafgreen"],
    ["slowpoke-well-1f", "Slowpoke Well 1f", "heartgold", "soulsilver"],
    ["slowpoke-well-b1f", "Slowpoke Well B1f", "heartgold", "soulsilver"],
  ),
  pokemonIn(
    ["sinnoh-sea-route-226-area", "Sea Route 226", "diamond", "pearl", "platinum"],
    ["mt-coronet-2f", "Mt. Coronet (2F)", "diamond", "pearl", "platinum"],
    ["mt-coronet-3f", "Mt. Coronet (3F)", "diamond", "pearl", "platinum"],
    ["eterna-forest-area", "Eterna Forest", "diamond", "pearl", "platinum"],
    ["safari-zone-kanto", "Safari Zone", "firered", "leafgreen"],
    ["safari-zone-hoenn", "Safari Zone", "ruby", "sapphire", "emerald"],
    ["pokemon-mansion-1f", "Pokémon Mansion 1f", "firered", "leafgreen"],
  ),
];
const HGSS = ["heartgold", "soulsilver"];
const FRLG = ["firered", "leafgreen"];
const DPPT = ["diamond", "pearl", "platinum"];

describe("normalizePlace", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normalizePlace("Mt. Ember")).toBe(normalizePlace("Mt Ember"));
    expect(normalizePlace("Mt. Coronet (2F)")).toBe("mt coronet 2f");
    expect(normalizePlace("Pokémon Mansion")).toBe("pokemon mansion");
    expect(normalizePlace("  ROUTE   32 ")).toBe("route 32");
  });

  it("drops a possessive 's", () => {
    expect(normalizePlace("Slowpoke's Well")).toBe("slowpoke well");
    expect(normalizePlace("Slowpoke’s Well")).toBe("slowpoke well");
    // ...but not an s that belongs to the word
    expect(normalizePlace("Ruins of Alph")).toBe("ruins of alph");
  });

  it("treats Sea Route as Route", () => {
    expect(normalizePlace("Sea Route 226")).toBe("route 226");
    expect(normalizePlace("Route 226")).toBe("route 226");
  });
});

describe("placeName", () => {
  it("takes the text before the first bracket, slash, comma or dash", () => {
    expect(placeName("Mt. Ember (found in cave)")).toBe("Mt. Ember");
    expect(placeName("Route 1 (Kanto)")).toBe("Route 1");
    expect(placeName("Veilstone City, Game Corner")).toBe("Veilstone City");
    expect(placeName("Route 209 - Lost Tower")).toBe("Route 209");
    expect(placeName("Route 209 — Lost Tower")).toBe("Route 209");
    expect(placeName("Silence Bridge / Pewter City Museum")).toBe("Silence Bridge");
    // A hyphen inside a name is not a dash
    expect(placeName("Ho-Oh's Tower")).toBe("Ho-Oh's Tower");
  });
});

describe("resolvePlace", () => {
  it("opens the one area a place names", () => {
    expect(resolvePlace("Route 32", HGSS, world)).toEqual({ kind: "route", slug: "johto-route-32-area" });
    expect(resolvePlace("Eterna Forest (in the grass)", DPPT, world)).toEqual({ kind: "route", slug: "eterna-forest-area" });
  });

  it("matches across spellings: Mt. vs Mt, Sea Route, apostrophe-s", () => {
    expect(resolvePlace("Mt. Ember (found in cave)", FRLG, world)).toEqual({ kind: "route", slug: "mt-ember-area" });
    expect(resolvePlace("Route 226", DPPT, world)).toEqual({ kind: "route", slug: "sinnoh-sea-route-226-area" });
    expect(resolvePlace("Slowpoke's Well", HGSS, world)).toEqual({ kind: "search", text: "Slowpoke's Well" });
  });

  it("opens a search when a place has several areas", () => {
    expect(resolvePlace("Mt. Coronet (found in cave)", DPPT, world)).toEqual({ kind: "search", text: "Mt. Coronet" });
  });

  it("opens the area when exactly one starts with the name", () => {
    expect(resolvePlace("Pokémon Mansion", FRLG, world)).toEqual({ kind: "route", slug: "pokemon-mansion-1f" });
  });

  it("is null for a place with no encounter area", () => {
    expect(resolvePlace("Celadon City Gym (reward from Erika)", FRLG, world)).toBeNull();
    expect(resolvePlace("Any honey tree", DPPT, world)).toBeNull();
    expect(resolvePlace("", DPPT, world)).toBeNull();
    expect(resolvePlace("(gift)", DPPT, world)).toBeNull();
  });

  it("does not take Route 32 for Route 320, or the other way round", () => {
    // Only Route 320 exists in this made-up pair of games
    const only320 = [pokemonIn(["unova-route-320-area", "Route 320", "heartgold"])];
    expect(resolvePlace("Route 32", ["heartgold"], only320)).toBeNull();
    expect(resolvePlace("Route 32", ["heartgold"], world)).toEqual({ kind: "route", slug: "johto-route-32-area" });
    expect(resolvePlace("Route 320", ["heartgold"], world)).toEqual({ kind: "route", slug: "unova-route-320-area" });
    expect(resolvePlace("Route 3", ["heartgold"], world)).toBeNull();
  });

  it("only looks at the games it is given", () => {
    expect(resolvePlace("Route 32", DPPT, world)).toBeNull();
    expect(resolvePlace("Mt. Ember", HGSS, world)).toBeNull();
    // Two regions have a Safari Zone; the games decide which one is meant
    expect(resolvePlace("Safari Zone", FRLG, world)).toEqual({ kind: "route", slug: "safari-zone-kanto" });
    expect(resolvePlace("Safari Zone", ["emerald"], world)).toEqual({ kind: "route", slug: "safari-zone-hoenn" });
    expect(resolvePlace("Safari Zone", ["firered", "emerald"], world)).toEqual({ kind: "search", text: "Safari Zone" });
  });
});

// ── The real data ────────────────────────────────────────────────────────────

// Loaded through a non-literal specifier so the app's type-check doesn't need Node's types
const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync: (path: string) => Uint8Array };
const allPokemon = JSON.parse(new TextDecoder().decode(fs.readFileSync("public/data/pokemon.json"))) as Pokemon[];

describe("places written by hand, against pokemon.json", () => {
  it("resolves every daily-checklist place except the honey-tree lines", () => {
    const unresolved = new Set<string>();
    for (const section of DAILY_EVENT_SECTIONS) {
      for (const entry of section.pokemon) {
        if (!resolvePlace(entry.location, section.versions, allPokemon)) unresolved.add(entry.location);
      }
    }
    expect([...unresolved].sort()).toEqual(["4 specific trees", "Any honey tree"]);
  });

  it("still resolves them when only one of the section's games is selected", () => {
    for (const section of DAILY_EVENT_SECTIONS) {
      for (const entry of section.pokemon) {
        if (/tree/.test(entry.location)) continue;
        const somewhere = section.versions.some((game) => resolvePlace(entry.location, [game], allPokemon));
        expect(somewhere, `${section.id}: ${entry.location}`).toBe(true);
      }
    }
  });

  it("links most TM locations and leaves cities, shops and gyms as text", () => {
    const VERSION_GROUP_GAMES: Record<string, string[]> = {
      "ruby-sapphire": ["ruby", "sapphire"], emerald: ["emerald"], "firered-leafgreen": FRLG,
      "diamond-pearl": ["diamond", "pearl"], platinum: ["platinum"], "heartgold-soulsilver": HGSS,
    };
    const count = { route: 0, search: 0, none: 0 };
    for (const table of [GEN3_TM_LOCATIONS, GEN4_TM_LOCATIONS]) {
      for (const byVersionGroup of Object.values(table)) {
        for (const [versionGroup, text] of Object.entries(byVersionGroup)) {
          // An entry can name two places; each is resolved on its own
          for (const part of text.split(" / ")) {
            count[resolvePlace(part, VERSION_GROUP_GAMES[versionGroup], allPokemon)?.kind ?? "none"]++;
          }
        }
      }
    }
    // About a third lead straight to a route and a tenth to a search; a drop here
    // means the area names or the normalisation changed
    expect(count.route).toBeGreaterThan(150);
    expect(count.search).toBeGreaterThan(40);
    expect(resolvePlace("Celadon City Dept. Store", FRLG, allPokemon)).toBeNull();
    expect(resolvePlace("Mt. Ember (found in cave)", FRLG, allPokemon)?.kind).toBe("search");
    expect(resolvePlace("Mt. Coronet", ["platinum"], allPokemon)).toEqual({ kind: "search", text: "Mt. Coronet" });
  });
});

describe("generationOfVersion", () => {
  it("names the generation of each supported game", () => {
    expect(generationOfVersion("emerald")).toBe(3);
    expect(generationOfVersion("leafgreen")).toBe(3);
    expect(generationOfVersion("diamond")).toBe(4);
    expect(generationOfVersion("soulsilver")).toBe(4);
    expect(generationOfVersion("black")).toBeNull();
  });
});
