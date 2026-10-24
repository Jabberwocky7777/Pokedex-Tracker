import { describe, expect, it } from "vitest";
import { bulbapediaPage, bulbapediaUrl, regionOf } from "../bulbapedia";
import allPokemon from "../../../public/data/pokemon.json";

const page = (slug: string, name: string, games: string[]) => bulbapediaPage({ slug, name, games });
const title = (slug: string, name: string, games: string[]) => page(slug, name, games)?.title ?? null;

describe("Bulbapedia pages for encounter areas", () => {
  it("names numbered routes with their region, in every region", () => {
    expect(title("kanto-route-1-area", "Route 1", ["firered"])).toBe("Kanto Route 1");
    expect(title("kanto-sea-route-21-area", "Sea Route 21", ["heartgold"])).toBe("Kanto Route 21");
    expect(title("johto-route-29-area", "Route 29", ["heartgold"])).toBe("Johto Route 29");
    expect(title("hoenn-route-101-area", "Route 101", ["emerald"])).toBe("Hoenn Route 101");
    expect(title("hoenn-route-119-weather-institute", "Route 119 Weather Institute", ["emerald"])).toBe("Hoenn Route 119");
    expect(title("sinnoh-route-205-east-towards-eterna-city", "Route 205 East Towards Eterna City", ["platinum"])).toBe("Sinnoh Route 205");
    expect(title("sinnoh-sea-route-230-area", "Sea Route 230", ["platinum"])).toBe("Sinnoh Route 230");
    // No region in the slug: the route number says which
    expect(title("route-209", "Route 209 (Hiker)", ["platinum"])).toBe("Sinnoh Route 209");
    expect(title("iceberg-ruins", "Iceberg Ruins (Route 216)", ["platinum"])).toBe("Sinnoh Route 216");
  });

  it("goes from a floor or room to its place", () => {
    expect(title("cave-of-origin-b1f", "Cave Of Origin B1f", ["ruby"])).toBe("Cave of Origin");
    expect(title("cave-of-origin", "Cave of Origin (Sootopolis City)", ["ruby"])).toBe("Cave of Origin");
    expect(title("mt-coronet-1f-route-211", "Mt Coronet 1f Route 211", ["platinum"])).toBe("Mt. Coronet");
    expect(title("mt-coronet-4f", "Mt. Coronet (4F)", ["platinum"])).toBe("Mt. Coronet");
    expect(title("great-marsh-area-1", "Great Marsh Area 1", ["platinum"])).toBe("Great Marsh");
    expect(title("lost-cave-room-6", "Lost Cave Room 6", ["firered"])).toBe("Lost Cave");
    expect(title("turnback-cave-before-pillar-1", "Turnback Cave Before Pillar 1", ["platinum"])).toBe("Turnback Cave");
    expect(title("eterna-forest-area", "Eterna Forest", ["platinum"])).toBe("Eterna Forest");
    expect(title("pokemon-tower-3f", "Pokemon Tower 3f", ["firered"])).toBe("Pokémon Tower");
    expect(title("eterna-city-west-gate", "Eterna City West Gate", ["platinum"])).toBe("Eterna City");
    expect(title("shoal-cave-low-tide", "Shoal Cave Low Tide", ["emerald"])).toBe("Shoal Cave");
  });

  it("uses the override table where the name doesn't map, with the region where pages share a name", () => {
    expect(title("sinnoh-victory-road-1f", "Victory Road 1f", ["platinum"])).toBe("Victory Road (Sinnoh)");
    expect(title("hoenn-victory-road-1f", "Victory Road 1f", ["emerald"])).toBe("Victory Road (Hoenn)");
    expect(title("kanto-victory-road-1-3f", "Victory Road 1 3f", ["heartgold"])).toBe("Victory Road (Kanto)");
    expect(title("kanto-safari-zone-area-3-west", "Safari Zone Area 3 West", ["firered"])).toBe("Kanto Safari Zone");
    expect(title("hoenn-safari-zone-neacro-bike-area", "Safari Zone Neacro Bike", ["emerald"])).toBe("Hoenn Safari Zone");
    expect(title("johto-safari-zone-wetland", "Safari Zone Wetland", ["heartgold"])).toBe("Johto Safari Zone");
    expect(title("desert-tomb", "Desert Tomb (Route 111)", ["emerald"])).toBe("Hoenn Route 111");
    expect(title("celadon-city-prize-corner", "Celadon City Prize Corner", ["firered"])).toBe("Celadon Game Corner");
    expect(title("ss-anne", "Ss Anne", ["firered"])).toBe("S.S. Anne");
    expect(title("viapos-chamber", "Viapos Chamber", ["firered"])).toBe("Tanoby Chambers");
  });

  it("has no page for the roaming lists and catch-alls", () => {
    expect(page("roaming-sinnoh", "Roaming (Sinnoh)", ["platinum"])).toBeNull();
    expect(page("hoenn-pokecenter-area", "Pokecenter", ["emerald"])).toBeNull();
    expect(bulbapediaUrl({ slug: "unknown-location", name: "Unknown Location", games: ["diamond"] })).toBeNull();
  });

  it("links straight to checked titles and through Bulbapedia's go-search otherwise", () => {
    expect(bulbapediaUrl({ slug: "hoenn-route-101-area", name: "Route 101", games: ["emerald"] })).toBe("https://bulbapedia.bulbagarden.net/wiki/Hoenn_Route_101");
    expect(bulbapediaUrl({ slug: "sinnoh-victory-road-1f", name: "Victory Road 1f", games: ["platinum"] })).toBe("https://bulbapedia.bulbagarden.net/wiki/Victory_Road_(Sinnoh)");
    expect(bulbapediaUrl({ slug: "eterna-forest-area", name: "Eterna Forest", games: ["platinum"] })).toBe(
      "https://bulbapedia.bulbagarden.net/w/index.php?title=Special:Search&go=Go&search=Eterna%20Forest");
  });

  it("reads the region from the slug, then the games", () => {
    expect(regionOf("johto-route-32-area", ["heartgold"])).toBe("Johto");
    expect(regionOf("trophy-garden-area", ["platinum"])).toBe("Sinnoh");
    expect(regionOf("tanoby-ruins", ["firered"])).toBe("Kanto");
  });

  it("gives every area in the data a page or a deliberate none, never an empty title", () => {
    const seen = new Set<string>();
    for (const p of allPokemon as { encounters: { version: string; locations: { locationAreaSlug: string; locationDisplayName: string }[] }[] }[]) {
      for (const e of p.encounters) for (const l of e.locations) {
        if (seen.has(l.locationAreaSlug)) continue;
        seen.add(l.locationAreaSlug);
        const result = page(l.locationAreaSlug, l.locationDisplayName, [e.version]);
        if (result) expect(result.title.trim().length, l.locationDisplayName).toBeGreaterThan(2);
      }
    }
    expect(seen.size).toBeGreaterThan(500);
  });
});
