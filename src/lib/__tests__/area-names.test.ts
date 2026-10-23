import { describe, expect, it } from "vitest";
import { areaDisplayName } from "../area-names";

describe("areaDisplayName", () => {
  it("lower-cases small words after the first", () => {
    expect(areaDisplayName("Cave Of Origin Entrance")).toBe("Cave of Origin Entrance");
    expect(areaDisplayName("Turnback Cave Between Pillars 1 And 2")).toBe("Turnback Cave Between Pillars 1 and 2");
    expect(areaDisplayName("Lake Of Rage")).toBe("Lake of Rage");
  });

  it("writes floors as 1F and B1F, without brackets", () => {
    expect(areaDisplayName("Cave Of Origin 1f")).toBe("Cave of Origin 1F");
    expect(areaDisplayName("Cave Of Origin B1f")).toBe("Cave of Origin B1F");
    expect(areaDisplayName("Ice Path (B1F)")).toBe("Ice Path B1F");
    expect(areaDisplayName("Bell Tower 10f")).toBe("Bell Tower 10F");
    expect(areaDisplayName("Granite Cave 1fsmall Room")).toBe("Granite Cave 1F Small Room");
  });

  it("writes Mt. with a full stop", () => {
    expect(areaDisplayName("Mt Coronet 1f Route 207")).toBe("Mt. Coronet 1F Route 207");
    expect(areaDisplayName("Mt. Coronet (2F)")).toBe("Mt. Coronet 2F");
  });

  it("leaves ordinary names alone", () => {
    for (const name of ["Route 201", "Eterna Forest", "Cave of Origin (Sootopolis City)", "Sinnoh Route 210 North", "Safari Zone Area 1"]) {
      expect(areaDisplayName(name)).toBe(name);
    }
  });
});
