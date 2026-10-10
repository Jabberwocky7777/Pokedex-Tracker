import { describe, expect, it } from "vitest";
import { betterCopies, compareCopies, copyRank, describeCopy, type Copy } from "../best-copy";
import { homeSlot } from "../living-dex";
import { originBadges } from "../origin";
import { decodePk4 } from "../pk4";
import type { ParsedSave, ProfileMons, SaveMon, SaveRole } from "../types";
import { buildPk4, miniDex, type MonSpec } from "./build";

const dex = miniDex();
const TRAINER = { name: "Brendan", tid: 9331, sid: 9338 };
const OWN = { tid: TRAINER.tid, sid: TRAINER.sid };

/** A fully decoded Pokémon at a given position. `home` puts it in its living-dex slot (dex from box 1). */
function full(spec: MonSpec, at: { box: number; slot: number } | "home"): SaveMon {
  const where = at === "home" ? homeSlot(spec.species, 1)! : at;
  return decodePk4(buildPk4({ ...OWN, originGame: 12, ...spec }), where.box, where.slot)!;
}

function save(id: string, role: SaveRole, mons: SaveMon[], withFull = true) {
  const profile: ProfileMons = {
    profile: { id, label: id, role, startBox: 1, fileName: "", importedAt: 0, saveCount: 1, family: "platinum", trainer: TRAINER },
    boxNames: ["BOX 1", "001-030", "031-060"],
    mons, // a SaveMon is a SlimMon with more fields
  };
  return { profile, fullSaves: withFull ? { [id]: { mons } as ParsedSave } : {} };
}
const copy = (s: ReturnType<typeof save>, mon: SaveMon): Copy => ({ profile: s.profile, mon, full: s.fullSaves[s.profile.profile.id] ? mon : undefined });
const rank = { shinyLivingDex: false, livingFamily: "platinum" as const };

describe("ranking copies", () => {
  const ivs = (n: number) => ({ hp: n, atk: n, def: n, spe: n, spAtk: n, spDef: n });

  it("orders by own catch, then native, then IV total, then level", () => {
    const traded = full({ species: 41, tid: 1, sid: 2, ivs: ivs(31) }, { box: 0, slot: 0 });
    const own = full({ species: 41, ivs: ivs(5) }, { box: 0, slot: 1 });
    const ownForeign = full({ species: 41, ivs: ivs(31), originGame: 8 }, { box: 0, slot: 2 });
    const ownBetterIvs = full({ species: 41, ivs: ivs(20) }, { box: 0, slot: 3 });
    const s = save("pt", "living-dex", [traded, own, ownForeign, ownBetterIvs]);
    const sorted = s.profile.mons.map((m) => copy(s, m as SaveMon)).sort((a, b) => compareCopies(a, b, rank));
    expect(sorted.map((c) => c.mon.slot)).toEqual([3, 1, 2, 0]);
    expect(copyRank(copy(s, ownBetterIvs), rank)).toEqual([0, 1, 1, 120, ownBetterIvs.level]);
  });

  it("only lets shiny decide when Shiny living dex is on", () => {
    const shiny = full({ species: 41, shiny: true, ivs: ivs(0) }, { box: 0, slot: 0 });
    const plain = full({ species: 41, ivs: ivs(31) }, { box: 0, slot: 1 });
    const s = save("pt", "living-dex", [shiny, plain]);
    expect(compareCopies(copy(s, shiny), copy(s, plain), rank)).toBeGreaterThan(0);
    expect(compareCopies(copy(s, shiny), copy(s, plain), { ...rank, shinyLivingDex: true })).toBeLessThan(0);
  });

  it("describes what makes a copy stand out", () => {
    const m = full({ species: 41, shiny: true, ivs: ivs(20), originGame: 8, exp: 1000 }, { box: 0, slot: 0 });
    const s = save("pt", "living-dex", [m]);
    expect(describeCopy(copy(s, m), rank)).toBe(`shiny, your catch, from another game, 120 IV total, Lv. ${m.level}`);
  });
});

describe("betterCopies", () => {
  const good = { hp: 31, atk: 31, def: 31, spe: 31, spAtk: 31, spDef: 30 };

  it("points a placed Pokémon at a better copy in the same save", () => {
    const placed = full({ species: 41 }, "home");
    const spare = full({ species: 41, ivs: good }, { box: 0, slot: 2 });
    const s = save("pt", "living-dex", [placed, spare]);
    const found = betterCopies([s.profile], dex, { shinyLivingDex: false, fullSaves: s.fullSaves, maxSpecies: 493 });
    expect(found.get(41)).toMatchObject({ where: "BOX 1 · slot 3", description: `your catch, 185 IV total, Lv. ${spare.level}` });
  });

  it("names the save when the better copy is elsewhere, and stays quiet when the slot already has the best", () => {
    const placed = full({ species: 41, ivs: good }, "home");
    const worse = full({ species: 41 }, { box: 0, slot: 2 });
    const pt = save("pt", "living-dex", [placed, worse, full({ species: 133 }, "home")]);
    const ss = save("SoulSilver", "playthrough", [full({ species: 133, ivs: good }, { box: 2, slot: 0 })]);
    const found = betterCopies([pt.profile, ss.profile], dex, {
      shinyLivingDex: false, fullSaves: { ...pt.fullSaves, ...ss.fullSaves }, maxSpecies: 493,
    });
    expect(found.has(41)).toBe(false);
    expect(found.get(133)?.where).toBe("SoulSilver, 031-060 · slot 1");
  });

  it("never prefers a copy just because less is known about the placed one", () => {
    // The living dex is known only from its summary (another device imported it)
    const pt = save("pt", "living-dex", [full({ species: 41 }, "home")], false);
    const ss = save("ss", "playthrough", [full({ species: 41, ivs: good }, { box: 0, slot: 0 })]);
    const found = betterCopies([pt.profile, ss.profile], dex, { shinyLivingDex: false, fullSaves: ss.fullSaves, maxSpecies: 493 });
    expect(found.size).toBe(0);
  });
});

describe("originBadges", () => {
  it("tells own catches, trades, natives, Pal Park migrants and events apart", () => {
    const own = full({ species: 41 }, { box: 0, slot: 0 });
    expect(originBadges(own, TRAINER, "platinum")).toEqual(["own", "native"]);
    const traded = full({ species: 41, tid: 5, sid: 6, originGame: 8 }, { box: 0, slot: 0 });
    expect(originBadges(traded, TRAINER, "platinum")).toEqual(["traded"]);
    expect(originBadges(traded, TRAINER, "hgss")).toEqual(["traded", "native"]);
    const migrated = full({ species: 150, originGame: 4, metLocation: 55 }, { box: 0, slot: 0 });
    expect(originBadges(migrated, TRAINER, "platinum")).toEqual(["own", "pal-park"]);
    expect(originBadges({ ...own, fateful: true }, TRAINER, "platinum")).toEqual(["own", "native", "event"]);
  });
});
