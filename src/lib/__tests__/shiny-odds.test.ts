import { beforeEach, describe, expect, it } from "vitest";
import { chanceByNow, formatChance, formatOdds, methodsFor, oddsPerEncounter } from "../shiny-odds";
import { mergePayload } from "../sync-merge";
import { applySnapshot, buildPayload } from "../sync";
import { restoreBackupData } from "../backup";
import { liveEntries } from "../entries";
import { useHuntStore, type ShinyHunt } from "../../store/useHuntStore";

describe("shiny odds in Generation III/IV", () => {
  it("is 1 in 8192 for encounters, resets and fishing", () => {
    for (const method of ["random", "soft-reset", "fishing"] as const) {
      expect(oddsPerEncounter(method, 0)).toBe(1 / 8192);
      expect(oddsPerEncounter(method, 5000)).toBe(1 / 8192);
    }
    expect(formatOdds(1 / 8192)).toBe("1 in 8,192");
  });

  it("is five times that for the Masuda method", () => {
    expect(oddsPerEncounter("masuda", 0)).toBe(5 / 8192);
    expect(formatOdds(oddsPerEncounter("masuda", 0))).toBe("1 in 1,638");
  });

  it("rises with a Poké Radar chain to 1 in 200 at 40, and no further", () => {
    expect(formatOdds(oddsPerEncounter("radar", 0))).toBe("1 in 8,192");
    expect(formatOdds(oddsPerEncounter("radar", 40))).toBe("1 in 200");
    expect(oddsPerEncounter("radar", 90)).toBe(oddsPerEncounter("radar", 40));
    // It grows slowly, then steeply at the end
    const at = (chain: number) => Math.round(1 / oddsPerEncounter("radar", chain));
    expect(at(10)).toBeGreaterThan(at(20));
    expect(at(20)).toBeGreaterThan(at(30));
    expect(at(30)).toBeGreaterThan(at(39));
    expect([at(30), at(39)]).toEqual([2185, 400]);
  });

  it("gives the running chance of having seen one", () => {
    expect(chanceByNow("random", 0)).toBe(0);
    // After 8192 encounters it is about 63%, not 100%
    expect(chanceByNow("random", 8192)).toBeCloseTo(0.632, 3);
    expect(chanceByNow("masuda", 1638)).toBeCloseTo(0.632, 2);
    expect(formatChance(chanceByNow("random", 1000)!)).toBe("11.5%");
    expect(formatChance(chanceByNow("random", 1)!)).toBe("<0.1%");
    expect(formatChance(0)).toBe("0.0%");
    // A radar count is a chain length, so there is no "by now"
    expect(chanceByNow("radar", 25)).toBeNull();
  });

  it("offers Masuda and the Poké Radar only where they exist", () => {
    expect(methodsFor(3).map((m) => m.id)).toEqual(["random", "soft-reset", "fishing"]);
    expect(methodsFor(4).map((m) => m.id)).toEqual(["random", "soft-reset", "masuda", "radar", "fishing"]);
  });
});

describe("hunts in sync and backup", () => {
  const hunt = (over: Partial<ShinyHunt> = {}): ShinyHunt => ({ generation: 4, pokemonId: 94, method: "random", count: 0, startedAt: 1, ...over });
  beforeEach(() => { localStorage.clear(); useHuntStore.getState().replaceAll({}); });

  it("is part of the payload and applies back", () => {
    useHuntStore.getState().put("h1", hunt({ count: 412 }));
    const payload = JSON.parse(JSON.stringify(buildPayload()));
    expect(payload.shinyHunts.h1).toMatchObject({ pokemonId: 94, count: 412 });
    useHuntStore.getState().replaceAll({});
    applySnapshot(payload);
    expect(useHuntStore.getState().entries.h1.count).toBe(412);
  });

  it("keeps the later count when two devices counted the same hunt, and both devices' other hunts", () => {
    const base = buildPayload();
    const phone = { ...base, shinyHunts: { h1: { ...hunt({ count: 500 }), at: 20 }, h2: { ...hunt({ pokemonId: 1 }), at: 5 } } };
    const pc = { ...base, shinyHunts: { h1: { ...hunt({ count: 480 }), at: 10 }, h3: { ...hunt({ pokemonId: 4 }), at: 7 } } };
    const merged = mergePayload(phone, pc).shinyHunts!;
    expect(merged.h1.count).toBe(500);
    expect(Object.keys(merged).sort()).toEqual(["h1", "h2", "h3"]);
  });

  it("carries an abandoned hunt to the other device", () => {
    const base = buildPayload();
    const merged = mergePayload(
      { ...base, shinyHunts: { h1: { ...hunt({ count: 30 }), at: 10 } } },
      { ...base, shinyHunts: { h1: { ...hunt({ count: 30 }), at: 15, removed: true as const } } },
    );
    expect(liveEntries(merged.shinyHunts)).toEqual([]);
  });

  it("restores from a backup and rejects a malformed section", () => {
    useHuntStore.getState().put("h1", hunt({ count: 7 }));
    const backup = JSON.parse(JSON.stringify(buildPayload()));
    useHuntStore.getState().put("h2", hunt({ pokemonId: 1 }));
    expect(restoreBackupData(backup)).toEqual({ ok: true });
    expect(liveEntries(useHuntStore.getState().entries).map(([id]) => id)).toEqual(["h1"]);
    expect(restoreBackupData({ ...backup, shinyHunts: "none" }).ok).toBe(false);
  });
});
