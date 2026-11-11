import { describe, expect, it } from "vitest";
import { defenceTable, offenceCoverage } from "../team-coverage";

describe("team coverage", () => {
  it("finds a weakness the team shares and few resist", () => {
    // Three Fire types and a Rock: Water hits three of them hard
    const rows = defenceTable([["fire"], ["fire", "flying"], ["fire"], ["rock"]]);
    const water = rows.find((r) => r.type === "water")!;
    expect(water).toMatchObject({ weak: 4, resist: 0, shared: true });
    const grass = rows.find((r) => r.type === "grass")!;
    expect(grass.resist).toBe(3);
    expect(grass.shared).toBe(false);
  });

  it("counts immunities as resisting", () => {
    const ground = defenceTable([["flying"], ["electric"]]).find((r) => r.type === "ground")!;
    expect(ground).toMatchObject({ weak: 1, resist: 1, immune: 1 });
  });

  it("lists what the moves hit hard and what walls them", () => {
    const cov = offenceCoverage(["Normal", "fighting"]);
    expect(cov.superEffective).toEqual(expect.arrayContaining(["normal", "rock", "steel", "ice", "dark"]));
    expect(cov.walled).toEqual(["ghost"]); // neither Normal nor Fighting touches Ghost
    expect(offenceCoverage(["normal"]).walled).toEqual(expect.arrayContaining(["rock", "ghost", "steel"]));
    expect(offenceCoverage([])).toEqual({ superEffective: [], walled: [] });
  });
});
