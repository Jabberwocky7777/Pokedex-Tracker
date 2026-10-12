import { describe, expect, it } from "vitest";
import { moveDisplayName } from "../move-names";
import { buildShowdownExport } from "../showdown-export";
import { useDesignerStore, type DesignerSlot } from "../../store/useDesignerStore";
import type { Pokemon } from "../../types";

describe("moveDisplayName", () => {
  it("keeps the hyphens that belong to the name", () => {
    for (const [slug, name] of [
      ["u-turn", "U-turn"],
      ["will-o-wisp", "Will-O-Wisp"],
      ["double-edge", "Double-Edge"],
      ["x-scissor", "X-Scissor"],
      ["mud-slap", "Mud-Slap"],
      ["soft-boiled", "Soft-Boiled"],
      ["self-destruct", "Self-Destruct"],
      ["lock-on", "Lock-On"],
      ["wake-up-slap", "Wake-Up Slap"],
    ]) expect(moveDisplayName(slug)).toBe(name);
  });

  it("turns the other hyphens into spaces", () => {
    expect(moveDisplayName("thunder-punch")).toBe("Thunder Punch");
    expect(moveDisplayName("roar-of-time")).toBe("Roar of Time");
    expect(moveDisplayName("vice-grip")).toBe("Vise Grip");
    expect(moveDisplayName("vise-grip")).toBe("Vise Grip");
  });

  it("falls back to capitalising a slug it doesn't know", () => {
    expect(moveDisplayName("made-up-move")).toBe("Made Up Move");
  });
});

describe("buildShowdownExport", () => {
  const pikachu = {
    id: 25, displayName: "Pikachu", abilities: [{ name: "static", displayName: "Static" }],
  } as unknown as Pokemon;
  const slot = (patch: Partial<DesignerSlot>): DesignerSlot =>
    ({ ...useDesignerStore.getState().slots[0], pokemonId: 25, ...patch });
  const header = (patch: Partial<DesignerSlot>) => buildShowdownExport(slot(patch), pikachu).split("\n")[0];

  it("puts the species in brackets after a nickname", () => {
    expect(header({ nickname: "Sparky", item: "Light Ball" })).toBe("Sparky (Pikachu) @ Light Ball");
    expect(header({ nickname: "Sparky" })).toBe("Sparky (Pikachu)");
  });

  it("uses the species alone when there is no nickname, or it is the species name", () => {
    expect(header({ nickname: "" })).toBe("Pikachu");
    expect(header({ nickname: "  " })).toBe("Pikachu");
    expect(header({ nickname: "Pikachu", item: "Leftovers" })).toBe("Pikachu @ Leftovers");
  });

  it("writes ability, EVs, nature, non-31 IVs and move names", () => {
    const text = buildShowdownExport(slot({
      ability: "static", level: 50, natureName: "Timid",
      evAllocation: { hp: 4, atk: 0, def: 0, spAtk: 252, spDef: 0, spe: 252 },
      confirmedIVs: { hp: 31, atk: 0, def: null, spAtk: 31, spDef: 31, spe: 31 },
      selectedMoves: ["u-turn", "thunderbolt", null, "will-o-wisp"],
    }), pikachu);
    expect(text).toBe([
      "Pikachu", "Ability: Static", "Level: 50", "EVs: 4 HP / 252 SpA / 252 Spe", "Timid Nature", "IVs: 0 Atk",
      "- U-turn", "- Thunderbolt", "- Will-O-Wisp",
    ].join("\n"));
  });
});
