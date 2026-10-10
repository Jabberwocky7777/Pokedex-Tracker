import { describe, expect, it } from "vitest";
import type { GenSnapshot } from "../../../store/useDexStore";
import { allocatePending, analyzeSave, breedingHints, detectStartBox, homeSlot, livingDexStats } from "../living-dex";
import { groupOf, planImport, type ImportPlan, type PlannedChange } from "../reconcile";
import { PARTY_BOX, type ProfileMons, type SaveRole, type SlimMon } from "../types";
import { miniDex } from "./build";

const dex = miniDex();

/** A Pokémon in its own living-dex slot (dex starting in box 1), unless told otherwise. */
function mon(species: number, at?: { box: number; slot: number } | "party", extra: Partial<SlimMon> = {}): SlimMon {
  const home = homeSlot(species, 1)!;
  const where = at === "party" ? { box: PARTY_BOX, slot: 0 } : at ?? home;
  return { ...where, species, form: 0, shiny: false, level: 20, isEgg: false, ...extra };
}
/** `holder` sitting in `species`' slot. */
const inSlotOf = (species: number, holder: number, extra: Partial<SlimMon> = {}) => mon(holder, homeSlot(species, 1)!, extra);
/** A loose copy in a holding box. */
let looseSlot = 0;
const loose = (species: number, extra: Partial<SlimMon> = {}) => mon(species, { box: 0, slot: looseSlot++ % 30 }, extra);

function profile(id: string, role: SaveRole, mons: SlimMon[], over: Partial<ProfileMons["profile"]> = {}): ProfileMons {
  return {
    profile: {
      id, label: id, role, startBox: 1, fileName: `${id}.sav`, importedAt: 0, saveCount: 10,
      family: "platinum", trainer: { name: "T", tid: 1, sid: 2 }, ...over,
    },
    boxNames: [],
    mons,
  };
}

const NO_MARKS: GenSnapshot = { caught: [], pending: [], shiny: [], placed: [] };
const pick = (plan: ImportPlan, group: string) => plan.changes.filter((c) => groupOf(c) === group);
const ids = (changes: PlannedChange[]) => changes.map((c) => c.id);

describe("homeSlot", () => {
  it("lays the National Dex out 30 to a box from the start box", () => {
    expect(homeSlot(1, 1)).toEqual({ box: 1, slot: 0 });
    expect(homeSlot(30, 1)).toEqual({ box: 1, slot: 29 });
    expect(homeSlot(31, 1)).toEqual({ box: 2, slot: 0 });
    expect(homeSlot(493, 1)).toEqual({ box: 17, slot: 12 });
  });

  it("returns null when the dex would run past the last box", () => {
    expect(homeSlot(493, 2)).toBeNull();
    expect(homeSlot(480, 2)).toEqual({ box: 17, slot: 29 });
  });
});

describe("detectStartBox", () => {
  it("finds the box where the most Pokémon already sit in dex order", () => {
    const mons = [mon(10), mon(11), mon(41), loose(133)];
    expect(detectStartBox(mons, [])).toEqual({ startBox: 1, placed: 3 });
  });

  it("uses a box named like 001-030 as the tiebreak", () => {
    const names = ["BOX 1", "BOX 2", "001-030", "031-060"];
    expect(detectStartBox([], names).startBox).toBe(2);
    expect(detectStartBox([], ["1 - 30"]).startBox).toBe(0);
    expect(detectStartBox([], ["BOX 1"]).startBox).toBe(0);
  });

  it("ignores eggs and the party", () => {
    const mons = [mon(10, undefined, { isEgg: true }), mon(11, "party")];
    expect(detectStartBox(mons, []).placed).toBe(0);
  });
});

describe("analyzeSave", () => {
  it("separates placed, placeholders, spares and wrong occupants", () => {
    const caterpie = mon(10);
    const placeholder = inSlotOf(11, 10);
    const wrong = inSlotOf(41, 128);
    const egg = inSlotOf(42, 41, { isEgg: true });
    const a = analyzeSave([caterpie, placeholder, wrong, egg, mon(133, "party")], 1, dex);
    expect([...a.placed]).toEqual([10]);
    expect([...a.placeholders.keys()]).toEqual([11]);
    expect(a.slots.get(41)?.state).toBe("wrong");
    expect(a.slots.get(42)?.state).toBe("wrong");
    expect(a.slots.get(12)?.state).toBe("empty");
    expect([...a.owned].sort((x, y) => x - y)).toEqual([10, 128, 133]);
    // Everything that isn't the placed copy in its own slot; eggs aren't copies
    expect(a.spares).toEqual([placeholder, wrong, expect.objectContaining({ species: 133 })]);
    expect(livingDexStats(a)).toEqual({ placed: 1, needsEvolving: 1, ownedNotInSlot: 2, missing: 493 - 4 });
  });

  it("has no slots at all for a playthrough save", () => {
    const a = analyzeSave([mon(10)], null, dex);
    expect(a.placed.size).toBe(0);
    expect(a.spares).toHaveLength(1);
  });
});

describe("allocatePending", () => {
  it("counts one spare Eevee towards exactly one Eeveelution", () => {
    const out = allocatePending([profile("ss", "playthrough", [mon(133, "party")])], dex);
    expect([...out.pending.keys()]).toEqual([134]);
    expect(out.pending.get(134)).toMatchObject({ from: 133, kind: "spare", alternatives: [135, 136, 196, 197, 470, 471] });
    expect(out.couldAlso.get(135)).toEqual({ from: 133, assignedTo: 134 });
    expect(out.couldAlso.has(134)).toBe(false);
  });

  it("spends each extra copy on the next open branch", () => {
    const out = allocatePending([profile("ss", "playthrough", [loose(133), loose(133), loose(133)])], dex);
    expect([...out.pending.keys()]).toEqual([134, 135, 136]);
  });

  it("does not count a Pokémon that is placed in its own slot", () => {
    const out = allocatePending([profile("pt", "living-dex", [mon(133), mon(41)])], dex);
    expect(out.pending.size).toBe(0);
    expect([...out.placed].sort((a, b) => a - b)).toEqual([41, 133]);
  });

  it("marks a slot's species pending when an earlier stage holds the slot", () => {
    const out = allocatePending([profile("pt", "living-dex", [mon(10), inSlotOf(11, 10)])], dex);
    expect([...out.pending.keys()]).toEqual([11]);
    expect(out.pending.get(11)).toMatchObject({ from: 10, kind: "placeholder" });
    // The placeholder is used up: it doesn't also make Butterfree pending
    expect(out.pending.has(12)).toBe(false);
  });

  it("follows the user's convention: Caterpies in Metapod's and Butterfree's slots", () => {
    const out = allocatePending([profile("pt", "living-dex", [mon(10), inSlotOf(11, 10), inSlotOf(12, 10)])], dex);
    expect([...out.pending.keys()].sort((a, b) => a - b)).toEqual([11, 12]);
  });

  it("keeps a copy for its own empty slot before spending any on evolutions", () => {
    // One loose Zubat and nothing in Zubat's slot: it belongs there, so Golbat isn't pending
    const lone = allocatePending([profile("pt", "living-dex", [loose(41)])], dex);
    expect(lone.pending.size).toBe(0);
    // A second one is free to evolve
    const two = allocatePending([profile("pt", "living-dex", [loose(41), loose(41)])], dex);
    expect([...two.pending.keys()]).toEqual([42]);
    // A playthrough has no slots, so there every copy can count
    expect(allocatePending([profile("ss", "playthrough", [loose(41)])], dex).pending.has(42)).toBe(true);
  });

  it("prefers the nearest stage, then moves on to the next one", () => {
    const out = allocatePending([profile("ss", "playthrough", [loose(41), loose(41)])], dex);
    expect([...out.pending.keys()]).toEqual([42, 169]);
  });

  it("never marks something pending that is owned in another save", () => {
    const out = allocatePending(
      [profile("pt", "living-dex", [mon(10), inSlotOf(11, 10)]), profile("ss", "playthrough", [mon(11, "party")])],
      dex,
    );
    expect(out.pending.has(11)).toBe(false);
  });

  it("never marks a baby pending, and suggests breeding instead", () => {
    const out = allocatePending([profile("ss", "playthrough", [loose(25), loose(25), loose(26)])], dex);
    expect(out.pending.has(172)).toBe(false);
    expect(breedingHints(out.owned, dex).get(172)).toBe(25);
    // Once Pichu is owned there is nothing to breed
    expect(breedingHints(new Set([25, 172]), dex).size).toBe(0);
    // …and nothing to breed from if no later stage is owned
    expect(breedingHints(new Set([10]), dex).size).toBe(0);
  });

  it("lets a spare baby count towards its evolution", () => {
    const out = allocatePending([profile("ss", "playthrough", [loose(172)])], dex);
    expect([...out.pending.keys()]).toEqual([25]);
  });

  it("ignores eggs", () => {
    const out = allocatePending([profile("ss", "playthrough", [loose(133, { isEgg: true })])], dex);
    expect(out.owned.size).toBe(0);
    expect(out.pending.size).toBe(0);
  });
});

describe("planImport", () => {
  const livingMons = [mon(10), inSlotOf(11, 10), mon(41, undefined, { shiny: true }), loose(128)];

  it("proposes placed marks only for a living-dex save", () => {
    const living = planImport([profile("pt", "living-dex", livingMons)], NO_MARKS, { dex });
    expect(ids(pick(living, "placed-add"))).toEqual([10, 41]);
    expect(ids(pick(living, "caught-add"))).toEqual([10, 41, 128]);
    expect(ids(pick(living, "shiny-add"))).toEqual([41]);
    expect(ids(pick(living, "pending-add"))).toEqual([11]);
    expect(living.changes.every((c) => c.recommended)).toBe(true);

    const playthrough = planImport([profile("pt", "playthrough", livingMons)], { ...NO_MARKS, placed: [10] }, { dex });
    // A playthrough save never touches placed — not even to remove it
    expect(playthrough.changes.filter((c) => c.field === "placed")).toEqual([]);
    expect(ids(pick(playthrough, "caught-add"))).toEqual([10, 41, 128]);
  });

  it("plans against every imported save: caught in either one counts", () => {
    const profiles = [profile("pt", "living-dex", [mon(10)]), profile("ss", "playthrough", [mon(133, "party")])];
    const plan = planImport(profiles, { ...NO_MARKS, caught: [133] }, { dex });
    expect(ids(pick(plan, "caught-add"))).toEqual([10]);
    // Eevee is only in the other save, so it is not "missing"
    expect(pick(plan, "caught-remove")).toEqual([]);
    expect(ids(pick(plan, "pending-add"))).toEqual([134]);
    expect(pick(plan, "caught-add")[0].reason).toBe("In pt");
  });

  it("ticks safe removals and leaves risky ones unticked", () => {
    const marks: GenSnapshot = {
      caught: [128, 10],     // 128 is in no save
      pending: [10, 12, 26], // 10 is caught now; 12 and 26 have no spare earlier stage
      shiny: [128],
      placed: [128, 10],     // 128 isn't in its slot
    };
    const plan = planImport([profile("pt", "living-dex", [mon(10)])], marks, { dex });
    const removal = (group: string, id: number) => pick(plan, group).find((c) => c.id === id);
    expect(removal("caught-remove", 128)?.recommended).toBe(false);
    expect(removal("shiny-remove", 128)?.recommended).toBe(false);
    expect(removal("placed-remove", 128)?.recommended).toBe(true);
    expect(removal("pending-remove", 10)?.recommended).toBe(true);
    expect(removal("pending-remove", 12)?.recommended).toBe(false);
    expect(removal("pending-remove", 26)?.recommended).toBe(false);
    expect(plan.massRemoval).toBe(false);
    expect(plan.stale).toBeNull();
  });

  it("unticks every removal when the dump is older than the stored one", () => {
    const marks: GenSnapshot = { ...NO_MARKS, pending: [10], placed: [128] };
    const profiles = [profile("pt", "living-dex", [mon(10)])];
    const fresh = planImport(profiles, marks, { dex, incomingSaveCount: 11, previousSaveCount: 10 });
    expect(fresh.stale).toBeNull();
    expect(fresh.changes.filter((c) => !c.value).every((c) => c.recommended)).toBe(true);

    const older = planImport(profiles, marks, { dex, incomingSaveCount: 9, previousSaveCount: 10 });
    expect(older.stale).toBe("older");
    expect(older.changes.filter((c) => !c.value)).toHaveLength(2);
    expect(older.changes.filter((c) => !c.value).some((c) => c.recommended)).toBe(false);
    // Additions are still offered
    expect(pick(older, "placed-add")[0].recommended).toBe(true);

    const same = planImport(profiles, marks, { dex, incomingSaveCount: 10, previousSaveCount: 10 });
    expect(same.stale).toBe("same");
    expect(same.changes.filter((c) => !c.value).every((c) => c.recommended)).toBe(true);
  });

  it("unticks all removals when more than 10 would be ticked", () => {
    const profiles = [profile("pt", "living-dex", [mon(10)])];
    const eleven = Array.from({ length: 11 }, (_, i) => 200 + i);
    const mass = planImport(profiles, { ...NO_MARKS, placed: eleven }, { dex });
    expect(mass.massRemoval).toBe(true);
    expect(pick(mass, "placed-remove")).toHaveLength(11);
    expect(mass.changes.filter((c) => !c.value).some((c) => c.recommended)).toBe(false);

    const ten = planImport(profiles, { ...NO_MARKS, placed: eleven.slice(0, 10) }, { dex });
    expect(ten.massRemoval).toBe(false);
    expect(pick(ten, "placed-remove").every((c) => c.recommended)).toBe(true);
  });

  it("shiny living dex: only the Pokémon in the slot decides ✦", () => {
    // A plain Zubat is placed; a shiny one is loose in a holding box
    const profiles = [profile("pt", "living-dex", [mon(41), loose(41, { shiny: true }), mon(10, undefined, { shiny: true })])];
    const anywhere = planImport(profiles, NO_MARKS, { dex });
    expect(ids(pick(anywhere, "shiny-add"))).toEqual([10, 41]);

    const slotOnly = planImport(profiles, { ...NO_MARKS, shiny: [41] }, { dex, shinyLivingDex: true });
    expect(ids(pick(slotOnly, "shiny-add"))).toEqual([10]);
    expect(pick(slotOnly, "shiny-remove")).toMatchObject([{ id: 41, recommended: false }]);

    // Without a living-dex save there is no slot to judge by, so shiny marks are left alone
    const noLivingDex = planImport([profile("ss", "playthrough", [loose(41, { shiny: true })])], { ...NO_MARKS, shiny: [10] },
      { dex, shinyLivingDex: true });
    expect(noLivingDex.changes.filter((c) => c.field === "shiny")).toEqual([]);
  });

  it("lists missing babies that could be bred", () => {
    const plan = planImport([profile("ss", "playthrough", [loose(25)])], NO_MARKS, { dex });
    expect(plan.breeding).toEqual([{ baby: 172, parent: 25 }]);
    expect(plan.changes.some((c) => c.id === 172)).toBe(false);
  });

  it("proposes nothing once the tracker matches the saves", () => {
    const profiles = [
      profile("pt", "living-dex", livingMons),
      profile("ss", "playthrough", [mon(133, "party"), loose(41, { shiny: true })]),
    ];
    const first = planImport(profiles, NO_MARKS, { dex });
    expect(first.changes.length).toBeGreaterThan(0);
    const marks: GenSnapshot = { caught: [], pending: [], shiny: [], placed: [] };
    for (const c of first.changes) if (c.recommended && c.value) marks[c.field].push(c.id);
    expect(planImport(profiles, marks, { dex }).changes).toEqual([]);
  });
});
