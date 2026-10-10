import { describe, expect, it } from "vitest";
import { buildMoveDetail, moveForVersionGroup, type RawMove } from "../move-fetch";

// Shapes copied from PokéAPI's /move responses: the top level is the latest
// games, and each past_values entry is what the move was before that version group.
const raw = (over: Partial<RawMove>): RawMove => ({
  type: { name: "normal" }, damage_class: { name: "physical" }, power: 40, accuracy: 100, pp: 35, past_values: [], ...over,
});
const before = (versionGroup: string, values: { power?: number; accuracy?: number; pp?: number; type?: string }) => ({
  version_group: { name: versionGroup },
  power: values.power ?? null,
  accuracy: values.accuracy ?? null,
  pp: values.pp ?? null,
  type: values.type ? { name: values.type } : null,
});

describe("move values per game", () => {
  it("shows Gen IV values, not the latest games' ones", () => {
    const thunderbolt = buildMoveDetail("thunderbolt", raw({
      type: { name: "electric" }, damage_class: { name: "special" }, power: 90, pp: 15,
      past_values: [before("x-y", { power: 95 })],
    }));
    expect(thunderbolt.power).toBe(95);
    expect(thunderbolt.current.power).toBe(90);
  });

  it("takes the nearest later change for each field separately", () => {
    // Tackle: 35 power / 95% until Black/White, 50 power until Sun/Moon, 40 power today
    const tackle = buildMoveDetail("tackle", raw({
      past_values: [before("black-white", { power: 35, accuracy: 95 }), before("sun-moon", { power: 50 })],
    }));
    expect([tackle.power, tackle.accuracy, tackle.pp]).toEqual([35, 95, 35]);
  });

  it("undoes the Fairy type", () => {
    const charm = buildMoveDetail("charm", raw({
      type: { name: "fairy" }, damage_class: { name: "status" }, power: null, pp: 20,
      past_values: [before("x-y", { type: "normal" })],
    }));
    expect(charm.type).toBe("normal");
  });

  it("follows changes made between the supported games", () => {
    // Hypnosis: 60% in Gen III, 70% in Diamond/Pearl, back to 60% from Platinum
    const hypnosis = buildMoveDetail("hypnosis", raw({
      type: { name: "psychic" }, damage_class: { name: "status" }, power: null, accuracy: 60, pp: 20,
      past_values: [before("diamond-pearl", { accuracy: 60 }), before("platinum", { accuracy: 70 })],
    }));
    expect(moveForVersionGroup(hypnosis, "emerald").accuracy).toBe(60);
    expect(moveForVersionGroup(hypnosis, "diamond-pearl").accuracy).toBe(70);
    expect(moveForVersionGroup(hypnosis, "platinum").accuracy).toBe(60);
    expect(hypnosis.accuracy).toBe(60);
  });

  it("recomputes the Gen III physical/special split from the type in that game", () => {
    // Outrage: 90 power in Gen III, 120 from Diamond/Pearl
    const outrage = buildMoveDetail("outrage", raw({
      type: { name: "dragon" }, power: 120, pp: 10, past_values: [before("diamond-pearl", { power: 90, pp: 15 })],
    }));
    const gen3 = moveForVersionGroup(outrage, "ruby-sapphire");
    expect([gen3.power, gen3.pp, gen3.gen3Category]).toEqual([90, 15, "special"]);
    expect(outrage.power).toBe(120);
  });
});
