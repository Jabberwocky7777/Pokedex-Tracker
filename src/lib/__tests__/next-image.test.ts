import { describe, expect, it } from "vitest";
import { buildNextLocations } from "../what-next";
import { PAGE_HEIGHT, paginate, pageHeightOf, routeLines, type ImageLine } from "../next-image";
import { makePokemon } from "../../test/fixtures";
import type { Pokemon } from "../../types";

const ROUTE: Pokemon[] = [
  makePokemon(41, "Zubat", ["poison", "flying"], { encounters: { diamond: { "route-209": ["walk"] }, pearl: { "route-209": ["walk"] } } }),
  makePokemon(129, "Magikarp", ["water"], { encounters: { diamond: { "route-209": ["old-rod"] } } }),
];

const mon = (n: number): ImageLine[] =>
  Array.from({ length: n }, (_, i) => ({ kind: "mon", caught: false, unique: false, name: `#${i}`, detail: "", games: "", height: 50 }));
const route = (name: string, mons: number): ImageLine[] => [{ kind: "route", text: name, right: "", height: 64 }, ...mon(mons)];
const height = (lines: ImageLine[]) => lines.reduce((s, l) => s + l.height, 0);

describe("What's next as images", () => {
  it("lists a route's methods, then its Pokémon, without the caught ones when asked", () => {
    const [loc] = buildNextLocations(ROUTE, ["diamond", "pearl"], new Set([129]), true, undefined, { keepComplete: true });
    const lines = routeLines(loc, { showCaught: false, showGames: true });
    expect(lines.map((l) => l.kind)).toEqual(["route", "info", "method", "mon"]);
    expect(lines[0]).toMatchObject({ right: "1 to catch" });
    expect(lines[3]).toMatchObject({ name: "#041 Zubat", games: "D P" });
    expect(routeLines(loc, { showCaught: true, showGames: false }).filter((l) => l.kind === "mon")).toHaveLength(2);
  });

  it("keeps a route on one page, moving it to the next when it doesn't fit", () => {
    const pages = paginate([route("A", 15), route("B", 15), route("C", 15)]);
    expect(pages).toHaveLength(2);
    expect(pages[1][0]).toMatchObject({ kind: "route", text: "C" });
    for (const p of pages) expect(pageHeightOf(p)).toBeLessThanOrEqual(PAGE_HEIGHT);
  });

  it("splits a route taller than a page, naming it again on the next", () => {
    const pages = paginate([route("Big", 60)]);
    expect(pages.length).toBe(2);
    expect(pages[1][0]).toMatchObject({ kind: "route", text: "Big (continued)" });
    expect(pages.flat().filter((l) => l.kind === "mon")).toHaveLength(60);
    for (const p of pages) expect(pageHeightOf(p)).toBeLessThanOrEqual(PAGE_HEIGHT);
    expect(height(pages[0])).toBeGreaterThan(0);
  });
});
