import { beforeEach, describe, expect, it } from "vitest";
import { canonicalEntries, isEntries, liveEntries, mergeEntries, restoreEntries, type Entries } from "../entries";
import { roamerState, roamersIn, roamerTips } from "../roamers";
import { mergePayload, payloadsEqual } from "../sync-merge";
import { applySnapshot, buildPayload } from "../sync";
import { restoreBackupData } from "../backup";
import { roamerKey, useRoamerStore } from "../../store/useRoamerStore";
import type { Pokemon } from "../../types";

type Flag = { on: boolean };
const e = (on: boolean, at: number, removed = false): Flag & { at: number; removed?: true } => ({ on, at, ...(removed ? { removed: true as const } : {}) });

describe("mergeEntries", () => {
  it("keeps entries only one side has", () => {
    expect(mergeEntries<Flag>({ a: e(true, 1) }, { b: e(false, 2) })).toEqual({ a: e(true, 1), b: e(false, 2) });
    expect(mergeEntries<Flag>(undefined, { b: e(false, 2) })).toEqual({ b: e(false, 2) });
    expect(mergeEntries<Flag>({ a: e(true, 1) }, undefined)).toEqual({ a: e(true, 1) });
  });

  it("takes the newer copy of an entry, whichever side has it", () => {
    expect(mergeEntries<Flag>({ a: e(true, 5) }, { a: e(false, 9) }).a).toEqual(e(false, 9));
    expect(mergeEntries<Flag>({ a: e(true, 9) }, { a: e(false, 5) }).a).toEqual(e(true, 9));
  });

  it("carries a removal to the other device, and lets a later edit bring the entry back", () => {
    expect(mergeEntries<Flag>({ a: e(true, 5) }, { a: e(true, 9, true) }).a.removed).toBe(true);
    expect(mergeEntries<Flag>({ a: e(true, 12) }, { a: e(true, 9, true) }).a).toEqual(e(true, 12));
    // Same instant: the entry that still exists wins; otherwise the local one stays
    expect(mergeEntries<Flag>({ a: e(true, 9, true) }, { a: e(true, 9) }).a.removed).toBeUndefined();
    expect(mergeEntries<Flag>({ a: e(true, 9) }, { a: e(false, 9) }).a.on).toBe(true);
  });

  it("gives the same result whichever device merges", () => {
    const one: Entries<Flag> = { a: e(true, 5), b: e(true, 7, true), c: e(false, 1) };
    const two: Entries<Flag> = { a: e(false, 6), b: e(true, 3), d: e(true, 2) };
    expect(canonicalEntries(mergeEntries(one, two))).toEqual(canonicalEntries(mergeEntries(two, one)));
  });
});

describe("the other entry helpers", () => {
  it("liveEntries leaves the tombstones out", () => {
    expect(liveEntries<Flag>({ a: e(true, 1), b: e(true, 2, true) }).map(([key]) => key)).toEqual(["a"]);
  });

  it("restoreEntries makes the restore the newest word on every entry", () => {
    const restored = restoreEntries<Flag>({ a: e(true, 5), gone: e(true, 6) }, { a: e(false, 1), back: e(true, 2), dead: e(true, 3, true) }, 100);
    expect(restored).toEqual({ a: e(false, 100), back: e(true, 100), gone: e(true, 100, true) });
  });

  it("isEntries accepts the shape and nothing else", () => {
    expect(isEntries({ a: { met: true, at: 1 } })).toBe(true);
    expect(isEntries({})).toBe(true);
    for (const bad of [null, [], "x", { a: 1 }, { a: { met: true } }, { a: [1] }]) expect(isEntries(bad), JSON.stringify(bad)).toBe(false);
  });
});

// ── Roamers ──────────────────────────────────────────────────────────────────

const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync: (path: string) => Uint8Array };
const allPokemon = JSON.parse(new TextDecoder().decode(fs.readFileSync("public/data/pokemon.json"))) as Pokemon[];

describe("roamers", () => {
  const names = (games: string[]) => roamersIn(allPokemon, games as never).map((r) => `${r.game}:${r.pokemon.name}`);

  it("lists each game's roamers from the encounter data", () => {
    expect(names(["platinum"])).toEqual(["platinum:articuno", "platinum:zapdos", "platinum:moltres", "platinum:mesprit", "platinum:cresselia"]);
    expect(names(["heartgold"])).toEqual(["heartgold:raikou", "heartgold:entei", "heartgold:latias"]);
    expect(names(["soulsilver"])).toContain("soulsilver:latios");
    expect(names(["ruby", "sapphire"])).toEqual(["ruby:latios", "sapphire:latias"]);
    expect(names(["firered"])).toEqual(["firered:raikou", "firered:entei", "firered:suicune"]);
    expect(roamersIn(allPokemon, ["diamond"])[0]).toMatchObject({ level: 50 });
  });

  it("works out the state: caught beats met", () => {
    expect([roamerState(false, false), roamerState(false, true), roamerState(true, false), roamerState(true, true)])
      .toEqual(["roaming", "met", "caught", "caught"]);
    expect(roamerTips(3).join(" ")).toMatch(/Roar/);
    expect(roamerTips(4).join(" ")).toMatch(/Quick Ball/);
  });
});

describe("roamers in sync and backup", () => {
  beforeEach(() => { localStorage.clear(); useRoamerStore.getState().replaceAll({}); });

  it("is part of the payload and applies back", () => {
    useRoamerStore.getState().put(roamerKey("platinum", 481), { met: true });
    const payload = JSON.parse(JSON.stringify(buildPayload()));
    expect(payload.roamers["platinum:481"]).toMatchObject({ met: true });
    useRoamerStore.getState().replaceAll({});
    applySnapshot(payload);
    expect(useRoamerStore.getState().entries["platinum:481"].met).toBe(true);
  });

  it("merges two devices' statuses entry by entry", () => {
    const base = buildPayload();
    const phone = { ...base, roamers: { "platinum:481": { met: true, at: 10 }, "platinum:488": { met: true, at: 5 } } };
    const pc = { ...base, roamers: { "platinum:488": { met: false, at: 8 }, "heartgold:243": { met: true, at: 3 } } };
    const merged = mergePayload(phone, pc);
    expect(merged.roamers).toEqual({
      "platinum:481": { met: true, at: 10 }, "platinum:488": { met: false, at: 8 }, "heartgold:243": { met: true, at: 3 },
    });
    expect(payloadsEqual(merged, mergePayload(pc, phone))).toBe(true);
    expect(payloadsEqual(phone, pc)).toBe(false);
    // An older client's payload has no roamers at all: nothing is lost
    expect(mergePayload(phone, { ...base, roamers: undefined }).roamers).toEqual(phone.roamers);
  });

  it("restores from a backup and rejects a malformed section", () => {
    useRoamerStore.getState().put(roamerKey("platinum", 481), { met: true });
    const backup = JSON.parse(JSON.stringify(buildPayload()));
    useRoamerStore.getState().put(roamerKey("platinum", 488), { met: true });

    expect(restoreBackupData(backup)).toEqual({ ok: true });
    const live = liveEntries(useRoamerStore.getState().entries).map(([key]) => key);
    expect(live).toEqual(["platinum:481"]);
    // What the backup didn't have is removed with a tombstone, so the removal syncs
    expect(useRoamerStore.getState().entries["platinum:488"].removed).toBe(true);

    expect(restoreBackupData({ ...backup, roamers: { "platinum:481": { met: true } } }).ok).toBe(false);
    expect(restoreBackupData({ ...backup, roamers: [] }).ok).toBe(false);
  });
});
