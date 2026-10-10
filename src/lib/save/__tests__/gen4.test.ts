import { describe, expect, it } from "vitest";
import { NATURES } from "../../iv-calc";
import { decodeText, encodeText } from "../charset4";
import { formName } from "../forms";
import { crc16ccitt, detectFamily, parseGen4Save, SAVE_SIZE } from "../gen4";
import { blockShift, cryptWords, decodePk4, Pk4Error, PK4_BOX_SIZE } from "../pk4";
import { summaryMons, toSummary } from "../summary";
import { abilityName, ballName, itemName, levelFromExp, locationName, moveName } from "../tables";
import { PARTY_BOX, SaveParseError, type SaveFamily, type SlimMon } from "../types";
import { buildPk4, buildSave, type MonSpec } from "./build";

const GARCHOMP: MonSpec = {
  species: 445,
  pid: 0x12344, // block shift 9, nature 14 (Naive)
  ability: 8,
  evs: { hp: 4, atk: 252, spe: 252 },
  ivs: { hp: 31, atk: 30, def: 29, spe: 28, spAtk: 27, spDef: 26 },
  moves: [89, 337, 14, 242],
  originGame: 12,
  metLocation: 65,
  ball: 13,
  metLevel: 20,
  level: 83,
  otName: "Brendan",
};

describe("pk4", () => {
  it("round-trips a record through checksum → shuffle → encrypt", () => {
    expect(blockShift(GARCHOMP.pid!)).not.toBe(0);
    const mon = decodePk4(buildPk4(GARCHOMP, true), PARTY_BOX, 5)!;
    expect(mon.species).toBe(445);
    expect(mon.ability).toBe(8);
    expect(abilityName(mon.ability)).toBe("Sand Veil");
    // EVs and IVs are stored HP, Atk, Def, Spe, SpA, SpD — not the usual display order
    expect(mon.evs).toEqual({ hp: 4, atk: 252, def: 0, spe: 252, spAtk: 0, spDef: 0 });
    expect(mon.ivs).toEqual({ hp: 31, atk: 30, def: 29, spe: 28, spAtk: 27, spDef: 26 });
    expect(mon.moves).toEqual([89, 337, 14, 242]);
    expect(moveName(mon.moves[0])).toBe("Earthquake");
    expect(NATURES[mon.nature].name).toBe("Naive");
    expect(mon.originGame).toBe(12);
    expect(mon.level).toBe(83);
    expect(mon.otName).toBe("Brendan");
    expect(ballName(mon.ball)).toBe("Dusk Ball");
    expect(mon.metLevel).toBe(20);
    expect(mon.metDate).toEqual([2009, 4, 28]);
    expect(mon.shiny).toBe(false);
    expect(mon.isEgg).toBe(false);
    expect([mon.box, mon.slot]).toEqual([PARTY_BOX, 5]);
  });

  it("reads the form, gender, egg flag and nickname", () => {
    const rotom = decodePk4(buildPk4({ species: 479, form: 2, nickname: "Washer" }), 0, 0)!;
    expect(rotom.form).toBe(2);
    expect(formName(rotom.species, rotom.form)).toBe("Wash");
    expect(rotom.isNicknamed).toBe(true);
    expect(rotom.nickname).toBe("Washer");
    expect(decodePk4(buildPk4({ species: 10, female: true }), 0, 0)!.gender).toBe("female");
    expect(decodePk4(buildPk4({ species: 175, isEgg: true }), 0, 0)!.isEgg).toBe(true);
  });

  it("computes a boxed Pokémon's level from its EXP", () => {
    expect(decodePk4(buildPk4({ species: 10, exp: 125 }), 0, 0)!.level).toBe(5);
  });

  it("does not modify the input buffer", () => {
    const raw = buildPk4(GARCHOMP, true);
    const before = raw.slice();
    decodePk4(raw, 0, 0);
    expect(raw).toEqual(before);
  });

  it("throws when a byte is corrupted", () => {
    const raw = buildPk4(GARCHOMP);
    raw[0x30] ^= 0x01;
    expect(() => decodePk4(raw, 0, 0)).toThrow(Pk4Error);
  });

  it("rejects an impossible species", () => {
    expect(() => decodePk4(buildPk4({ species: 494 }), 0, 0)).toThrow(Pk4Error);
  });

  it("decodes a constructed shiny PID as shiny", () => {
    const shiny = decodePk4(buildPk4({ species: 130, shiny: true, tid: 9331, sid: 9338 }), 0, 0)!;
    expect(shiny.shiny).toBe(true);
    expect((shiny.otTid ^ shiny.otSid ^ (shiny.pid >>> 16) ^ (shiny.pid & 0xffff)) < 8).toBe(true);
    expect(decodePk4(buildPk4({ species: 130, tid: 9331, sid: 9338 }), 0, 0)!.shiny).toBe(false);
  });

  it("treats blank records as empty slots, not errors", () => {
    expect(decodePk4(new Uint8Array(PK4_BOX_SIZE), 0, 0)).toBeNull();
    // Platinum stores empty slots as an encrypted blank (PID 0, checksum 0)
    const encryptedBlank = new Uint8Array(PK4_BOX_SIZE);
    cryptWords(encryptedBlank, 0x08, 0x88, 0);
    expect(encryptedBlank.some((b) => b !== 0)).toBe(true);
    expect(decodePk4(encryptedBlank, 0, 0)).toBeNull();
  });
});

describe("lookup tables", () => {
  it("levelFromExp follows the species' growth curve", () => {
    expect(levelFromExp(10, 125)).toBe(5);
    expect(levelFromExp(10, 124)).toBe(4);
    expect(levelFromExp(10, 1_000_000)).toBe(100);
    expect(levelFromExp(10, 0)).toBe(1);
  });

  it("names items, balls and locations by their Gen IV index", () => {
    expect(itemName(1)).toBe("Master Ball");
    expect(ballName(5)).toBe("Safari Ball");
    expect(locationName(55)).toBe("Pal Park");
    expect(locationName(2000)).toBe("Day-Care Couple");
    expect(locationName(3002)).toBe("Faraway place");
  });
});

describe("Gen IV text", () => {
  it("round-trips the Latin subset", () => {
    const text = "Farfetch’d-2 ♂";
    expect(decodeText(encodeText(text, 20), 0, 20)).toEqual({ text, unsupported: false });
  });

  it("flags names that are mostly unmapped characters", () => {
    const kana = new Uint8Array([0x03, 0x00, 0x05, 0x00, 0x07, 0x00, 0xff, 0xff]);
    expect(decodeText(kana, 0, 8)).toEqual({ text: "???", unsupported: true });
  });
});

describe("CRC-16-CCITT", () => {
  it("matches the standard test vector", () => {
    expect(crc16ccitt(new TextEncoder().encode("123456789"))).toBe(0x29b1);
  });
});

describe("parseGen4Save", () => {
  const spec = {
    trainerName: "Brendan",
    tid: 9331,
    sid: 9338,
    saveCount: 573,
    party: [GARCHOMP],
    boxes: { "1:9": { species: 10, exp: 125 }, "1:10": { species: 10, shiny: true }, "17:29": { species: 493, form: 10 } },
    boxNames: ["BOX 1", "001-030", "031-060"],
  };

  it("reads trainer, party, boxes and box names", () => {
    const save = parseGen4Save(buildSave(spec));
    expect(save.family).toBe("platinum");
    expect(save.game).toBe("Platinum");
    expect(save.trainer).toEqual({ name: "Brendan", tid: 9331, sid: 9338 });
    expect(save.saveCount).toBe(573);
    expect(save.warnings).toEqual([]);
    expect(save.boxNames.slice(0, 4)).toEqual(["BOX 1", "001-030", "031-060", "BOX 4"]);
    expect(save.mons.map((m) => [m.box, m.slot, m.species])).toEqual([
      [PARTY_BOX, 0, 445], [1, 9, 10], [1, 10, 10], [17, 29, 493],
    ]);
    expect(save.mons[2].shiny).toBe(true);
    expect(save.mons[3].form).toBe(10);
  });

  it("takes the boxes that belong to the newest general block, even from the other slot", () => {
    // Newest general block in slot 2; its storage (same link value) is in slot 1.
    const save = parseGen4Save(buildSave({ ...spec, splitSlots: true }));
    expect(save.saveCount).toBe(573);
    expect(save.mons.filter((m) => m.box !== PARTY_BOX)).toHaveLength(3);
    expect(save.warnings).toEqual([]);
  });

  it("falls back to the newest storage block, with a warning, when no link matches", () => {
    const bytes = buildSave(spec);
    // Rewrite the general block's link value and re-checksum it
    const footer = 0xcf2c - 0x14;
    bytes[footer] = 0x77;
    const crc = crc16ccitt(bytes, 0, footer);
    bytes[footer + 0x12] = crc & 0xff;
    bytes[footer + 0x13] = crc >> 8;
    const save = parseGen4Save(bytes);
    expect(save.mons).toHaveLength(4);
    expect(save.warnings).toHaveLength(1);
    expect(save.warnings[0]).toMatch(/newest boxes/);
  });

  it("skips unreadable slots and reports how many", () => {
    const save = parseGen4Save(buildSave({ ...spec, corrupt: ["1:10"] }));
    expect(save.mons).toHaveLength(3);
    expect(save.warnings).toEqual(["1 slot couldn't be read and was skipped."]);
  });

  it("ignores bytes after the first 512 KB (emulator footers)", () => {
    const padded = new Uint8Array(SAVE_SIZE + 122);
    padded.set(buildSave(spec));
    padded.fill(0xab, SAVE_SIZE);
    expect(parseGen4Save(padded).mons).toHaveLength(4);
  });

  it("does not modify the file it is given", () => {
    const bytes = buildSave(spec);
    const before = bytes.slice();
    parseGen4Save(bytes);
    expect(bytes).toEqual(before);
  });

  it.each<[SaveFamily, number[], string]>([
    ["dp", [10, 11, 11], "Pearl"],
    ["hgss", [7, 7, 8], "HeartGold"],
  ])("reads the %s layout and guesses the game from the trainer's own Pokémon", (family, origins, game) => {
    const boxes = Object.fromEntries(origins.map((originGame, i) => [`0:${i}`, { species: 1 + i, originGame }]));
    const bytes = buildSave({ family, party: [{ species: 25, level: 12 }], boxes });
    expect(detectFamily(bytes)).toBe(family);
    const save = parseGen4Save(bytes);
    expect(save.family).toBe(family);
    expect(save.game).toBe(game);
    expect(save.mons).toHaveLength(4);
    expect(save.mons[0].level).toBe(12);
    expect(save.boxNames[17]).toBe("BOX 18");
  });

  it("rejects junk with a SaveParseError", () => {
    expect(() => parseGen4Save(new Uint8Array(100))).toThrow(SaveParseError);
    expect(() => parseGen4Save(new Uint8Array(0x20000))).toThrow(/aren't supported yet/);
    expect(() => parseGen4Save(new Uint8Array(SAVE_SIZE))).toThrow(SaveParseError);
    const noise = new Uint8Array(SAVE_SIZE).map((_, i) => (i * 7919) & 0xff);
    expect(() => parseGen4Save(noise)).toThrow(SaveParseError);
    // Right shape, wrong checksum
    const damaged = buildSave(spec);
    damaged[0x100] ^= 0xff;
    expect(() => parseGen4Save(damaged)).toThrow(/checksums don't match/);
  });
});

describe("save summary", () => {
  it("keeps position, species, form, shiny, level and egg flag", () => {
    const save = parseGen4Save(buildSave({
      party: [{ species: 445, level: 83 }],
      boxes: { "1:10": { species: 10, shiny: true, exp: 125 }, "2:0": { species: 479, form: 3 }, "3:4": { species: 175, isEgg: true } },
    }));
    const summary = toSummary(save);
    const slim = (m: SlimMon): SlimMon =>
      ({ box: m.box, slot: m.slot, species: m.species, form: m.form, shiny: m.shiny, level: m.level, isEgg: m.isEgg });
    expect(summaryMons(JSON.parse(JSON.stringify(summary)))).toEqual(save.mons.map(slim));
    expect(summary.boxNames).toEqual(save.boxNames);
  });

  it("stays well under 50 KB for a completely full save", () => {
    const mons: SlimMon[] = [];
    for (let i = 0; i < 6; i++) mons.push({ box: PARTY_BOX, slot: i, species: 493, form: 17, shiny: true, level: 100, isEgg: false });
    for (let box = 0; box < 18; box++) {
      for (let slot = 0; slot < 30; slot++) mons.push({ box, slot, species: 493, form: 17, shiny: true, level: 100, isEgg: false });
    }
    const boxNames = Array.from({ length: 18 }, () => "WWWWWWWWWWWWWWWWWWWW");
    const json = JSON.stringify(toSummary({ boxNames, mons }));
    expect(json.length).toBeLessThan(25_000);
  });
});
