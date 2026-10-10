import { describe, expect, it } from "vitest";
import { matchesMon, needsFullSave, parseMonSearch, type SearchEntry } from "../mon-search";
import { decodePk4 } from "../pk4";
import type { ProfileMons } from "../types";
import { buildPk4, type MonSpec } from "./build";

const profile = { profile: { id: "pt", label: "Platinum" } } as ProfileMons;
const NAMES: Record<number, string> = { 445: "Garchomp", 94: "Gengar", 122: "Mr. Mime", 175: "Togepi" };

function entry(spec: MonSpec, withFull = true): SearchEntry {
  const full = decodePk4(buildPk4(spec), 0, 0)!;
  return { profile, mon: full, full: withFull ? full : undefined, speciesName: NAMES[spec.species] };
}
const hit = (e: SearchEntry, query: string) => matchesMon(e, parseMonSearch(query));

const garchomp = entry({
  species: 445, pid: 0x12344 /* Naive */, ability: 8, heldItem: 234, nickname: "Chomper", otName: "Brendan", originGame: 10, exp: 300000,
  ivs: { hp: 31, atk: 31, def: 20, spe: 31, spAtk: 3, spDef: 31 }, evs: { atk: 252, spe: 252, hp: 4 }, moves: [89, 337],
});
const gengar = entry({ species: 94, shiny: true, exp: 1000, ivs: { hp: 1, atk: 2, def: 3, spe: 4, spAtk: 5, spDef: 6 } });
const egg = entry({ species: 175, isEgg: true });

describe("parseMonSearch", () => {
  it("parses names, numbers, flags, text fields and numeric conditions", () => {
    expect(parseMonSearch("Garchomp #445 shiny egg:no nature:Adamant spe:31 ivtotal>=150 lv:10-20 atk<5")).toEqual([
      { kind: "name", value: "garchomp" },
      { kind: "dex", value: 445 },
      { kind: "flag", field: "shiny", value: true },
      { kind: "flag", field: "egg", value: false },
      { kind: "text", field: "nature", value: "adamant" },
      { kind: "number", field: "spe", op: "=", a: 31, b: 31 },
      { kind: "number", field: "ivtotal", op: ">=", a: 150, b: 150 },
      { kind: "number", field: "level", op: "range", a: 10, b: 20 },
      { kind: "number", field: "atk", op: "<", a: 5, b: 5 },
    ]);
  });

  it("treats an unknown field as part of a name, and ignores empty input", () => {
    expect(parseMonSearch("colour:red")).toEqual([{ kind: "name", value: "colourred" }]);
    expect(parseMonSearch("   ")).toEqual([]);
  });

  it("knows which searches need the full save", () => {
    expect(needsFullSave(parseMonSearch("garchomp shiny level>=50"))).toBe(false);
    expect(needsFullSave(parseMonSearch("spe:31"))).toBe(true);
    expect(needsFullSave(parseMonSearch("move:surf"))).toBe(true);
  });
});

describe("matchesMon", () => {
  it("matches species name, nickname and dex number", () => {
    expect(hit(garchomp, "garch")).toBe(true);
    expect(hit(garchomp, "chomper")).toBe(true);
    expect(hit(garchomp, "445")).toBe(true);
    expect(hit(garchomp, "#94")).toBe(false);
    expect(hit(entry({ species: 122 }), "mr.mime")).toBe(true);
  });

  it("matches nature, ability, item, move, OT and origin game", () => {
    expect(hit(garchomp, "nature:naive")).toBe(true);
    expect(hit(garchomp, "nature:adamant")).toBe(false);
    expect(hit(garchomp, "ability:sand-veil")).toBe(true);
    expect(hit(garchomp, "item:leftovers")).toBe(true);
    expect(hit(garchomp, "move:earthquake")).toBe(true);
    expect(hit(garchomp, "move:dragon_claw")).toBe(true);
    expect(hit(garchomp, "move:surf")).toBe(false);
    expect(hit(garchomp, "ot:brendan game:diamond")).toBe(true);
    expect(hit(garchomp, "game:pearl")).toBe(false);
  });

  it("matches IV conditions, totals and perfect counts", () => {
    expect(hit(garchomp, "spe:31")).toBe(true);
    expect(hit(garchomp, "spa<5 def:20")).toBe(true);
    expect(hit(garchomp, "def>20")).toBe(false);
    expect(hit(garchomp, "atk:28-31")).toBe(true);
    expect(hit(garchomp, "ivtotal>=147")).toBe(true);
    expect(hit(garchomp, "ivtotal>147")).toBe(false);
    expect(hit(garchomp, "perfect>=4")).toBe(true);
    expect(hit(garchomp, "perfect:5")).toBe(false);
    expect(hit(gengar, "ivtotal<=21 perfect:0")).toBe(true);
  });

  it("matches EV totals and level ranges", () => {
    expect(hit(garchomp, "evtotal>=508")).toBe(true);
    expect(hit(gengar, "evtotal:0")).toBe(true);
    expect(hit(garchomp, `level:${garchomp.mon.level}`)).toBe(true);
    expect(hit(garchomp, "lv:1-5")).toBe(false);
  });

  it("matches shiny and eggs, and keeps eggs out of everything else", () => {
    expect(hit(gengar, "shiny")).toBe(true);
    expect(hit(garchomp, "shiny")).toBe(false);
    expect(hit(garchomp, "shiny:no")).toBe(true);
    expect(hit(egg, "egg")).toBe(true);
    expect(hit(egg, "togepi")).toBe(false);
    expect(hit(egg, "shiny:no")).toBe(false);
    expect(hit(garchomp, "egg")).toBe(false);
  });

  it("requires every term", () => {
    expect(hit(garchomp, "garchomp spe:31 nature:naive")).toBe(true);
    expect(hit(garchomp, "garchomp spe:31 nature:jolly")).toBe(false);
  });

  it("on a summary-only device, answers what the summary knows and nothing else", () => {
    const slim = entry({ species: 94, shiny: true, exp: 1000 }, false);
    expect(hit(slim, "gengar shiny")).toBe(true);
    expect(hit(slim, "level>=1")).toBe(true);
    expect(hit(slim, "spe:4")).toBe(false);
    expect(hit(slim, "nature:hardy")).toBe(false);
  });
});
