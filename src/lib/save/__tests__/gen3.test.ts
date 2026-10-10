import { describe, expect, it } from "vitest";
import type { GenSnapshot } from "../../../store/useDexStore";
import { NATURES } from "../../iv-calc";
import { GBA_SAVE_SIZE, parseGen3Save, sectionChecksum } from "../gen3";
import { analyzeProfile, homeSlot } from "../living-dex";
import { parseSave } from "../parse";
import { decodePk3, decodeText3, encodeText3, PK3_BOX_SIZE, SUBSTRUCTURE_ORDERS } from "../pk3";
import { Pk4Error } from "../pk4";
import { planImport } from "../reconcile";
import { toSummary, summaryMons } from "../summary";
import { abilityName, ballName, heldItemName, metLocationName, moveName, originGameName } from "../tables";
import { GEN_CONFIG, PARTY_BOX, SaveParseError, genConfigOf, type ProfileMons } from "../types";
import { buildSave } from "./build";
import { buildPk3, buildSave3, type Mon3Spec } from "./build3";

// Everything here is a synthetic round trip: it proves the reader and the test
// builder agree with each other and with the documented layout, not that the
// layout matches a real cartridge.

const BLAZIKEN: Mon3Spec = {
  species: 257,
  pid: 0x00c0ffee, // substructure order 14, nature 13 (Jolly)
  item: 179,
  friendship: 200,
  evs: { hp: 6, atk: 252, spe: 252 },
  ivs: { hp: 31, atk: 30, def: 29, spe: 28, spAtk: 27, spDef: 26 },
  moves: [299, 136, 89, 14],
  originGame: 3,
  metLocation: 16,
  metLevel: 5,
  ball: 4,
  nickname: "Sanji",
  otName: "May",
  level: 62,
};

describe("pk3", () => {
  it("round-trips a record through checksum → shuffle → encrypt", () => {
    expect(BLAZIKEN.pid! % 24).not.toBe(0);
    const mon = decodePk3(buildPk3(BLAZIKEN, true), PARTY_BOX, 0)!;
    // Hoenn species are stored by an internal index, not their National Dex number
    expect(mon.species).toBe(257);
    expect(mon.gen).toBe(3);
    expect(heldItemName(mon)).toBe("Bright Powder");
    expect(mon.friendship).toBe(200);
    expect(mon.evs).toEqual({ hp: 6, atk: 252, def: 0, spe: 252, spAtk: 0, spDef: 0 });
    expect(mon.ivs).toEqual({ hp: 31, atk: 30, def: 29, spe: 28, spAtk: 27, spDef: 26 });
    expect(mon.moves.map(moveName)).toEqual(["Blaze Kick", "High Jump Kick", "Earthquake", "Swords Dance"]);
    expect(NATURES[mon.nature].name).toBe(NATURES[BLAZIKEN.pid! % 25].name);
    expect(abilityName(mon.ability)).toBe("Blaze");
    expect(mon.level).toBe(62);
    expect([mon.nickname, mon.isNicknamed, mon.otName]).toEqual(["Sanji", true, "May"]);
    expect(originGameName(mon.originGame)).toBe("Emerald");
    expect(metLocationName(mon)).toBe("Route 101");
    expect(mon.metLevel).toBe(5);
    expect(ballName(mon.ball)).toBe("Poké Ball");
    expect(mon.shiny).toBe(false);
    expect([mon.box, mon.slot]).toEqual([PARTY_BOX, 0]);
  });

  it("covers every substructure order", () => {
    for (let order = 0; order < 24; order++) {
      // PIDs chosen so that pid % 24 === order
      const mon = decodePk3(buildPk3({ species: 252, pid: 240000 + order, exp: 135, moves: [1, 2, 3, 4] }), 0, 0)!;
      expect([mon.species, mon.exp, mon.moves], SUBSTRUCTURE_ORDERS[order]).toEqual([252, 135, [1, 2, 3, 4]]);
    }
  });

  it("tells a nickname from the species name the game fills in", () => {
    expect(decodePk3(buildPk3({ species: 252 }), 0, 0)).toMatchObject({ nickname: "TREECKO", isNicknamed: false });
    expect(decodePk3(buildPk3({ species: 252, nickname: "Woody" }), 0, 0)).toMatchObject({ nickname: "Woody", isNicknamed: true });
    expect(decodePk3(buildPk3({ species: 122 }), 0, 0)!.isNicknamed).toBe(false); // "MR. MIME"
  });

  it("derives level, shininess, ability slot, gender, egg flag and Unown's letter", () => {
    expect(decodePk3(buildPk3({ species: 10, exp: 125 }), 0, 0)!.level).toBe(5);
    expect(decodePk3(buildPk3({ species: 130, shiny: true }), 0, 0)!.shiny).toBe(true);
    // Zigzagoon has one ability in Gen III (Pickup); Gluttony came later, so both slots mean Pickup
    expect(abilityName(decodePk3(buildPk3({ species: 263, abilitySlot: 1 }), 0, 0)!.ability)).toBe("Pickup");
    // Ralts really has two
    expect(abilityName(decodePk3(buildPk3({ species: 280, abilitySlot: 0 }), 0, 0)!.ability)).toBe("Synchronize");
    expect(abilityName(decodePk3(buildPk3({ species: 280, abilitySlot: 1 }), 0, 0)!.ability)).toBe("Trace");
    expect(decodePk3(buildPk3({ species: 252, pid: 0x10 }), 0, 0)!.gender).toBe("female");   // 12.5% female: low byte < 31
    expect(decodePk3(buildPk3({ species: 252, pid: 0x80 }), 0, 0)!.gender).toBe("male");
    expect(decodePk3(buildPk3({ species: 81 }), 0, 0)!.gender).toBe("genderless");
    expect(decodePk3(buildPk3({ species: 175, isEgg: true }), 0, 0)).toMatchObject({ isEgg: true, isNicknamed: false });
    expect(decodePk3(buildPk3({ species: 201, pid: 0x00000001 }), 0, 0)!.form).toBe(1); // Unown B
  });

  it("treats blank slots as empty, and damaged or impossible records as unreadable", () => {
    expect(decodePk3(new Uint8Array(PK3_BOX_SIZE), 0, 0)).toBeNull();
    const raw = buildPk3(BLAZIKEN);
    const before = raw.slice();
    decodePk3(raw, 0, 0);
    expect(raw).toEqual(before); // input untouched
    raw[0x30] ^= 0x01;
    expect(() => decodePk3(raw, 0, 0)).toThrow(Pk4Error);
    // 252–276 are unused placeholders in the internal species list
    expect(() => decodePk3(buildPk3({ species: 252, internalIndex: 260 }), 0, 0)).toThrow(Pk4Error);
  });

  it("flags names from a Japanese cartridge instead of showing garbage", () => {
    expect(decodePk3(buildPk3({ species: 252, language: 1 }), 0, 0)).toMatchObject({ nameUnsupported: true, isNicknamed: false });
  });
});

describe("Gen III text", () => {
  it("round-trips the mapped characters and stops at the terminator", () => {
    expect(decodeText3(encodeText3("Mr. Mime-2♂", 12), 0, 12).text).toBe("Mr. Mime-2♂");
    expect(decodeText3(new Uint8Array([0xbb, 0xff, 0xbc]), 0, 3).text).toBe("A");
  });
});

describe("section checksum", () => {
  it("sums 32-bit words and folds the halves together", () => {
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setUint32(0, 0xffff0001, true);
    new DataView(bytes.buffer).setUint32(4, 0x00020003, true);
    // 0xFFFF0001 + 0x00020003 = 0x1_00010004 → low 32 bits 0x00010004 → 0x0001 + 0x0004
    expect(sectionChecksum(bytes, 0, 8)).toBe(0x0005);
  });
});

describe("parseGen3Save", () => {
  const spec = {
    trainerName: "May", tid: 4242, sid: 1717, saveIndex: 37, rotation: 5,
    party: [BLAZIKEN, { species: 25, level: 20 }],
    boxes: { "0:0": { species: 252, exp: 135 }, "1:6": { species: 7, shiny: true, tid: 1, sid: 2 }, "13:29": { species: 386 } },
    boxNames: ["STARTERS", "001-030"],
  };

  it("reads trainer, party, PC and box names, whatever order the sections are in", () => {
    const save = parseGen3Save(buildSave3(spec));
    expect(save.family).toBe("rse");
    expect(save.game).toBe("Emerald");
    expect(save.trainer).toEqual({ name: "May", tid: 4242, sid: 1717 });
    expect(save.saveCount).toBe(37);
    expect(save.warnings).toEqual([]);
    expect(save.boxNames).toHaveLength(14);
    expect(save.boxNames.slice(0, 3)).toEqual(["STARTERS", "001-030", "BOX 3"]);
    expect(save.mons.map((m) => [m.box, m.slot, m.species])).toEqual([
      [PARTY_BOX, 0, 257], [PARTY_BOX, 1, 25], [0, 0, 252], [1, 6, 7], [13, 29, 386],
    ]);
    expect(save.mons[1].level).toBe(20);
    expect(save.mons.map((m) => m.own)).toEqual([true, true, true, false, true]);
    // The same save with the sections unrotated reads identically
    expect(parseGen3Save(buildSave3({ ...spec, rotation: 0 })).mons).toEqual(save.mons);
  });

  it("uses the block with the higher save index, and the other one if that is damaged", () => {
    const damaged = parseGen3Save(buildSave3({ ...spec, damageNewest: true }));
    expect(damaged.saveCount).toBe(36);
    expect(damaged.mons.map((m) => m.species)).toEqual([257]); // the older block only had the first party member
    expect(damaged.warnings).toHaveLength(1);
    expect(damaged.warnings[0]).toMatch(/one save behind/);
  });

  it("detects FireRed/LeafGreen, whose party sits elsewhere in section 1", () => {
    const save = parseGen3Save(buildSave3({
      family: "frlg", party: [{ species: 6, level: 50, originGame: 5 }], boxes: { "0:0": { species: 1, originGame: 5 } },
    }));
    expect(save.family).toBe("frlg");
    expect(save.game).toBe("LeafGreen");
    expect(save.mons.map((m) => [m.species, m.level])).toEqual([[6, 50], [1, 1]]);
  });

  it("guesses Ruby/Sapphire/Emerald from the trainer's own Pokémon, then from the security key", () => {
    expect(parseGen3Save(buildSave3({ boxes: { "0:0": { species: 252, originGame: 2 } } })).game).toBe("Ruby");
    expect(parseGen3Save(buildSave3({ securityKey: 0x1234 })).game).toBe("Emerald");
    expect(parseGen3Save(buildSave3({})).game).toBe("Ruby/Sapphire");
  });

  it("does not modify the file, and rejects junk with a SaveParseError", () => {
    const bytes = buildSave3(spec);
    const before = bytes.slice();
    parseGen3Save(bytes);
    expect(bytes).toEqual(before);
    expect(() => parseGen3Save(new Uint8Array(GBA_SAVE_SIZE))).toThrow(SaveParseError);
    expect(() => parseGen3Save(new Uint8Array(GBA_SAVE_SIZE).map((_, i) => (i * 31) & 0xff))).toThrow(SaveParseError);
    expect(() => parseGen3Save(new Uint8Array(100))).toThrow(SaveParseError);
  });
});

describe("parseSave", () => {
  it("picks the format by file size", () => {
    expect(parseSave(buildSave3({})).family).toBe("rse");
    expect(parseSave(buildSave({})).family).toBe("platinum");
    expect(() => parseSave(new Uint8Array(4000))).toThrow(/too small/);
  });
});

describe("Gen III saves in the living-dex machinery", () => {
  const dex = new Map();
  const profileOf = (startBox: number, species: number[]): ProfileMons => {
    const save = parseGen3Save(buildSave3({
      boxes: Object.fromEntries(species.map((n) => {
        const home = homeSlot(n, startBox, 14)!;
        return [`${home.box}:${home.slot}`, { species: n }];
      })),
    }));
    const summary = toSummary(save);
    return {
      profile: {
        id: "rse-1-2", label: "Emerald", role: "living-dex", startBox, fileName: "", importedAt: 0, saveCount: 1,
        family: "rse", trainer: save.trainer,
      },
      boxNames: summary.boxNames,
      mons: summaryMons(summary),
    };
  };

  it("has 14 boxes and 386 species", () => {
    expect(genConfigOf("rse")).toBe(GEN_CONFIG[3]);
    expect(genConfigOf("frlg").gen).toBe(3);
    expect(homeSlot(386, 0, 14)).toEqual({ box: 12, slot: 25 });
    expect(homeSlot(386, 1, 14)).toEqual({ box: 13, slot: 25 });
    // Starting in box 3 leaves no room for the last 26 species
    expect(homeSlot(361, 2, 14)).toBeNull();
    expect(homeSlot(360, 2, 14)).toEqual({ box: 13, slot: 29 });

    const a = analyzeProfile(profileOf(0, [1, 252, 386]), dex);
    expect([...a.placed]).toEqual([1, 252, 386]);
    expect(a.slots.size).toBe(386);
    expect(analyzeProfile(profileOf(2, [1]), dex).slots.size).toBe(360);
  });

  it("plans marks for species 1–386 only", () => {
    const marks: GenSnapshot = { caught: [1, 300], pending: [], shiny: [], placed: [] };
    const plan = planImport([profileOf(0, [1, 252])], marks, { dex });
    expect(plan.changes.filter((c) => c.field === "placed").map((c) => c.id)).toEqual([1, 252]);
    expect(plan.changes.filter((c) => c.field === "caught").map((c) => [c.id, c.value])).toEqual([[252, true], [300, false]]);
    expect(plan.changes.every((c) => c.id <= 386)).toBe(true);
  });
});
