import { describe, expect, it } from "vitest";
import { DESMUME_FOOTER_SIZE, unwrapSave } from "../container";
import { parseSave } from "../parse";
import { SaveParseError } from "../types";
import { buildSave } from "./build";
import { buildSave3 } from "./build3";

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
const text = (s: string, length = s.length) => {
  const out = new Uint8Array(length);
  for (let i = 0; i < s.length && i < length; i++) out[i] = s.charCodeAt(i);
  return out;
};

describe("unwrapSave", () => {
  it("leaves a plain save alone", () => {
    const save = buildSave();
    const { bytes, removed } = unwrapSave(save);
    expect(bytes.length).toBe(save.length);
    expect(removed).toEqual([]);
  });

  it("takes DeSmuME's 122-byte footer off a .dsv, and the save still reads", () => {
    const save = buildSave({ trainerName: "Dawn" });
    const footer = text(
      "|<--Snip above here to create a raw sav by excluding this DeSmuME savedata footer:",
      DESMUME_FOOTER_SIZE,
    );
    const dsv = concat(save, footer);
    const { bytes, removed } = unwrapSave(dsv);
    expect(bytes.length).toBe(512 * 1024);
    expect(removed).toEqual(["DeSmuME footer"]);
    expect(parseSave(dsv).trainer.name).toBe("Dawn");
  });

  it("ignores up to 4 KB after a GBA save (real-time-clock data)", () => {
    const save = buildSave3({ trainerName: "MAY" });
    for (const extra of [16, 4096]) {
      const withTail = concat(save, new Uint8Array(extra).fill(0x7f));
      expect(unwrapSave(withTail).bytes.length).toBe(128 * 1024);
      expect(parseSave(withTail).trainer.name).toBe("MAY");
    }
  });

  it("explains RetroArch's compressed saves instead of failing on them", () => {
    const rzip = concat(text("#RZIPv1#"), new Uint8Array(1000));
    expect(() => unwrapSave(rzip)).toThrow(SaveParseError);
    expect(() => parseSave(rzip)).toThrow(/SaveRAM Compression/);
  });
});

describe("parseSave on files it can't read", () => {
  it("says a too-small file isn't a save, emulator saves included", () => {
    expect(() => parseSave(new Uint8Array(1000))).toThrow(/too small.*emulator/s);
  });

  it("names Game Boy saves", () => {
    expect(() => parseSave(new Uint8Array(32 * 1024))).toThrow(/Game Boy save/);
  });

  it("says a 512 KB save of another game (Black, White, a ROM hack) isn't tracked, not that it is corrupt", () => {
    const other = new Uint8Array(512 * 1024).fill(0x5a);
    expect(() => parseSave(other)).toThrow(/isn't a save from a game this app tracks/);
  });
});
