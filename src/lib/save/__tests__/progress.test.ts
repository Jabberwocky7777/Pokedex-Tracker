import { describe, expect, it } from "vitest";
import { parseGen4Save } from "../gen4";
import { parseGen3Save } from "../gen3";
import { GEN3_FLAGS, PROGRESS_VERIFIED } from "../progress";
import { buildSave } from "./build";
import { buildSave3 } from "./build3";

// Synthetic saves only: the offsets come from the pret decompilations (see
// progress.ts) and haven't been checked on a real save, so the readers only
// run with `unverifiedProgress` until a family is added to PROGRESS_VERIFIED.

describe("Gen IV progress", () => {
  it("reads nothing by default while no family is verified", () => {
    expect(PROGRESS_VERIFIED).toEqual([]);
    expect(parseGen4Save(buildSave({ progress: { badges: 0xff } })).progress).toBeUndefined();
  });

  it("reads badges, the game-clear and National Dex bits and play time (Platinum)", () => {
    const save = parseGen4Save(buildSave({ progress: { badges: 0b00010111, flags: 0b11, playTime: [123, 45, 6] } }), { unverifiedProgress: true });
    expect(save.progress).toEqual({ badges: [0, 1, 2, 4], hallOfFame: true, nationalDex: true, playTime: { hours: 123, minutes: 45, seconds: 6 } });
  });

  it("reads Diamond/Pearl at its own trainer offset", () => {
    const save = parseGen4Save(buildSave({ family: "dp", progress: { badges: 0b1, flags: 0b10 } }), { unverifiedProgress: true });
    expect(save.progress).toMatchObject({ badges: [0], hallOfFame: false, nationalDex: true });
  });

  it("adds HG/SS Kanto badges as ids 8–15", () => {
    const save = parseGen4Save(buildSave({ family: "hgss", progress: { badges: 0xff, kantoBadges: 0b10000001, flags: 1 } }), { unverifiedProgress: true });
    expect(save.progress?.badges).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 15]);
    expect(save.progress?.hallOfFame).toBe(true);
  });

  it("ignores the Kanto byte outside HG/SS", () => {
    const save = parseGen4Save(buildSave({ progress: { kantoBadges: 0xff } }), { unverifiedProgress: true });
    expect(save.progress?.badges).toEqual([]);
  });
});

describe("Gen III progress", () => {
  const badges = (first: number, n: number) => Array.from({ length: n }, (_, i) => first + i);

  it("reads FireRed/LeafGreen flags and play time", () => {
    const f = GEN3_FLAGS.frlg;
    const save = parseGen3Save(buildSave3({
      family: "frlg", flags: { offset: f.flags, ids: [...badges(f.badge1, 3), f.gameClear] }, playTime: [40, 2, 3],
    }), { unverifiedProgress: true });
    expect(save.progress).toEqual({ badges: [0, 1, 2], hallOfFame: true, nationalDex: false, playTime: { hours: 40, minutes: 2, seconds: 3 } });
  });

  it("reads Emerald's flags when the trainer's own Pokémon say it is Emerald", () => {
    const e = GEN3_FLAGS.emerald;
    const save = parseGen3Save(buildSave3({
      party: [{ species: 252, originGame: 3, level: 5 }],
      flags: { offset: e.flags, ids: [...badges(e.badge1, 8), e.gameClear, e.nationalDex] },
    }), { unverifiedProgress: true });
    expect(save.progress).toMatchObject({ badges: [0, 1, 2, 3, 4, 5, 6, 7], hallOfFame: true, nationalDex: true });
  });

  it("reads Ruby/Sapphire at their own offset", () => {
    const r = GEN3_FLAGS.rs;
    const save = parseGen3Save(buildSave3({ party: [{ species: 252, originGame: 2, level: 5 }], flags: { offset: r.flags, ids: [r.badge1] } }), { unverifiedProgress: true });
    expect(save.game).toBe("Ruby");
    expect(save.progress?.badges).toEqual([0]);
  });

  it("reads nothing when Ruby/Sapphire and Emerald can't be told apart", () => {
    const save = parseGen3Save(buildSave3({ flags: { offset: GEN3_FLAGS.emerald.flags, ids: [GEN3_FLAGS.emerald.badge1] } }), { unverifiedProgress: true });
    expect(save.progress).toBeUndefined();
  });
});
