import { describe, expect, it } from "vitest";
import { XP_SPOTS } from "../../data/xp-spots";
import xpJson from "../../data/xp-trainers.json";
import type { Pokemon } from "../../types";
import { boostFactor, defeatExp, spotValue, trainerExp, type XpData } from "../xp";

const data = xpJson as unknown as XpData;
// Loaded through a non-literal specifier so the app's type-check doesn't need Node's types
const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync: (path: string) => Uint8Array };
const pokemon = JSON.parse(new TextDecoder().decode(fs.readFileSync("public/data/pokemon.json"))) as Pokemon[];
const value = (id: string) => {
  const spot = XP_SPOTS.find((s) => s.id === id);
  if (!spot) throw new Error(id);
  const v = spotValue(spot, data, pokemon);
  if (!v) throw new Error(`no value for ${id}`);
  return v;
};
const exp = (id: string) => value(id).exp;
const trainer = (game: keyof XpData["games"], id: string) => {
  const t = data.games[game].find((x) => x.id === id);
  if (!t) throw new Error(id);
  return t.exp;
};

describe("EXP formula", () => {
  it("matches the games' integer steps", () => {
    // Bulbasaur (64) at Lv 10: floor(640 / 7) = 91; × 1.5 in a trainer battle, rounded down = 136
    expect(defeatExp(64, 10)).toBe(91);
    expect(trainerExp([[1, 10]], data.baseExp["4"])).toBe(136);
  });
  it("applies Lucky Egg and traded bonuses", () => {
    expect(boostFactor(4, { luckyEgg: true, traded: true })).toBeCloseTo(2.25);
    expect(boostFactor(4, { traded: true, foreign: true })).toBeCloseTo(1.7);
    expect(boostFactor(3, { traded: true, foreign: true })).toBeCloseTo(1.5);
  });
});

describe("XP spots", () => {
  it("every spot has data behind it", () => {
    for (const spot of XP_SPOTS) expect(spotValue(spot, data, pokemon), spot.id).not.toBeNull();
  });

  // Each verdict in src/data/xp-spots.ts, checked against the data
  it("Emerald", () => {
    const league = exp("em-league");
    for (const id of ["em-leaders", "em-wally", "em-gabby-ty"]) expect(league).toBeGreaterThan(exp(id));
    const members = value("em-league").battles.map((t) => t.exp);
    expect(trainer("emerald", "TRAINER_JUAN_5")).toBeGreaterThan(Math.max(...members));
    const others = data.games.emerald.filter((t) => t.kind === "rematch" && !t.id.startsWith("TRAINER_WALLY"));
    expect(exp("em-wally")).toBeGreaterThan(Math.max(...others.map((t) => t.exp)) * 1.3);
    expect(exp("em-gabby-ty")).toBeLessThan(exp("em-wally") / 3);
    for (const slug of ["meteor-falls-back", "sky-pillar-1f", "hoenn-victory-road-1f"]) {
      expect(exp("em-victory-road")).toBeGreaterThan(
        spotValue({ wild: { game: "emerald", slug, method: "walk" } }, data, pokemon)!.exp,
      );
    }
  });

  it("FireRed / LeafGreen", () => {
    for (const id of ["fr-league", "fr-sevault"]) expect(exp("fr-league-rematch")).toBeGreaterThan(exp(id));
    expect(exp("fr-league")).toBeGreaterThan(exp("fr-sevault"));
    const vs = data.games.firered.filter((t) => t.kind === "rematch");
    expect(Math.max(...vs.map((t) => t.exp))).toBe(trainer("firered", "TRAINER_COOLTRAINER_LEROY_2"));
    expect(exp("fr-cerulean-cave")).toBeGreaterThan(exp("fr-kindle-road") * 1.8);
  });

  it("Platinum", () => {
    const all = XP_SPOTS.filter((s) => s.games.includes("platinum") && s.id !== "pt-league-rematch").map((s) =>
      exp(s.id),
    );
    expect(exp("pt-league-rematch")).toBeGreaterThan(Math.max(...all));
    const singles = data.games.platinum.filter((t) => t.kind !== "league");
    expect(exp("pt-league")).toBeGreaterThan(Math.max(...singles.map((t) => t.exp)));
    const e4 = value("pt-league")
      .battles.filter((t) => t.cls === "Elite Four")
      .map((t) => t.exp);
    for (const t of value("pt-battleground").battles) expect(t.exp).toBeGreaterThan(Math.min(...e4));
    const vs = data.games.platinum.filter((t) => t.kind === "rematch");
    expect(Math.max(...vs.map((t) => t.exp))).toBe(trainer("platinum", "TRAINER_RANCHER_MARCO_REMATCH_2"));
    const r225 = spotValue(
      { wild: { game: "platinum", slug: "sinnoh-route-225-area", method: "walk" } },
      data,
      pokemon,
    )!.exp;
    expect(exp("pt-stark")).toBeGreaterThan(r225);
    expect(exp("pt-iron-island")).toBeLessThan(exp("pt-stark") * 0.6);
  });

  it("Diamond / Pearl", () => {
    const dp = XP_SPOTS.filter((s) => s.games.includes("diamond") && s.id !== "dp-league").map((s) => exp(s.id));
    expect(exp("dp-league")).toBeGreaterThan(Math.max(...dp));
    // One party per Elite Four member and Cynthia: no rematch teams in D/P
    const league = data.games.diamond.filter((t) => t.kind === "league");
    expect(league).toHaveLength(5);
    const e4 = league.filter((t) => t.cls === "Elite Four").map((t) => t.exp);
    const avg = e4.reduce((s, x) => s + x, 0) / e4.length;
    for (const t of value("dp-vs-seeker").battles) {
      expect(t.exp).toBeGreaterThan(avg * 0.5);
      expect(t.exp).toBeLessThan(avg * 0.75);
    }
    const vs = data.games.diamond.filter((t) => t.kind === "rematch");
    expect(Math.max(...vs.map((t) => t.exp))).toBe(trainer("diamond", "TRAINER_VETERAN_ARMANDO_2"));
    expect(exp("dp-iron-island")).toBeLessThan(exp("dp-turnback") * 0.6);
  });

  it("HeartGold / SoulSilver", () => {
    for (const id of ["hg-league", "hg-leaders", "hg-phone", "hg-mt-silver"]) {
      expect(exp("hg-league-red")).toBeGreaterThan(exp(id));
    }
    expect(exp("hg-league")).toBeLessThan(exp("hg-league-red") * 0.7);
    const e4 = value("hg-league-red")
      .battles.filter((t) => t.cls === "Elite Four")
      .map((t) => t.exp);
    const avg = e4.reduce((s, x) => s + x, 0) / e4.length;
    const leaders = value("hg-leaders").battles;
    expect(leaders).toHaveLength(16);
    for (const t of leaders) expect(t.exp).toBeGreaterThan(avg * 0.75);
    expect(Math.max(...leaders.map((t) => t.exp))).toBeGreaterThan(Math.max(...e4));
    const blue = leaders.find((t) => t.id === "TRAINER_LEADER_BLUE_BLUE_2")!;
    expect(blue.exp).toBe(Math.max(...leaders.map((t) => t.exp)));
    expect(blue.call).toEqual({ weekday: 0, time: "night" });
    expect(new Set(leaders.map((t) => t.call?.weekday))).toEqual(new Set([0, 1, 2, 3, 4, 5, 6]));
    expect(new Set(leaders.map((t) => t.where))).toEqual(new Set(["Saffron City Fighting Dojo"]));
    for (const t of value("hg-phone").battles) expect(t.call, t.id).toBeDefined();
    const r28 = spotValue(
      { wild: { game: "heartgold", slug: "kanto-route-28-area", method: "walk" } },
      data,
      pokemon,
    )!.exp;
    expect(exp("hg-mt-silver")).toBeGreaterThan(r28);
  });
});
