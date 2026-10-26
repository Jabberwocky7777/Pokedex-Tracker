import { describe, expect, it } from "vitest";
import { palParkOpen, palParkPlan, whereIn } from "../pal-park";
import type { ProfileMons, SaveProfile, SlimMon } from "../types";

const mon = (species: number, box: number, slot: number, extra: Partial<SlimMon> = {}): SlimMon =>
  ({ box, slot, species, form: 0, shiny: false, level: 10, isEgg: false, ...extra });
const profile = (id: string, family: SaveProfile["family"], mons: SlimMon[]): ProfileMons => ({
  profile: { id, label: id, role: "playthrough", startBox: 0, fileName: "", importedAt: 0, saveCount: 0, family, trainer: { name: "", tid: 0, sid: 0 } },
  boxNames: [],
  mons,
});

describe("Pal Park planner", () => {
  const dex = profile("pt", "platinum", [mon(1, 0, 0), mon(25, 0, 24)]);
  const emerald = profile("e", "rse", [mon(1, 0, 0), mon(252, 1, 3), mon(252, -1, 0, { level: 40 }), mon(280, 2, 0, { isEgg: true })]);
  const fire = profile("fr", "frlg", [mon(252, 0, 0, { shiny: true, level: 5 }), mon(144, 4, 9)]);

  it("lists what the Gen III saves have and the living dex doesn't, best copy first", () => {
    const plan = palParkPlan(dex, [emerald, fire, dex]);
    expect(plan.map((p) => p.species)).toEqual([144, 252]);
    expect(plan[1].sources.map((s) => [s.profileId, s.mon.level])).toEqual([["fr", 5], ["e", 40], ["e", 10]]);
    expect(whereIn(plan[0].sources[0].mon)).toBe("Box 5, slot 10");
    expect(whereIn(plan[1].sources[1].mon)).toBe("Party");
  });

  it("is closed in Sinnoh until the National Pokédex", () => {
    const withDex = { badges: [], milestones: { "national-dex": { done: true, source: "manual" as const } } };
    expect(palParkOpen(["platinum"], () => undefined)).toBe(false);
    expect(palParkOpen(["platinum"], () => withDex)).toBe(true);
    expect(palParkOpen(["diamond", "pearl"], (g) => (g === "pearl" ? withDex : undefined))).toBe(true);
    expect(palParkOpen(["heartgold"], () => undefined)).toBe(true);
  });
});
