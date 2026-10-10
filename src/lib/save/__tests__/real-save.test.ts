import { describe, expect, it } from "vitest";
import { NATURES } from "../../iv-calc";
import { parseGen4Save } from "../gen4";
import { allocatePending, analyzeSave, detectStartBox } from "../living-dex";
import { abilityName, ballName, locationName, originGameName } from "../tables";
import { PARTY_BOX, type ParsedSave, type SpeciesInfo } from "../types";

// Checks the parser against a real Platinum cartridge dump. Save files are
// personal data and are gitignored, so this suite is skipped unless you put
// your own dump at src/lib/save/__tests__/fixtures/platinum.sav. The expected
// values below are the ones from the save the format was verified against.

// Loaded through a non-literal specifier so the app's type-check doesn't need Node's types
const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string) => Uint8Array;
};
const FIXTURE = "src/lib/save/__tests__/fixtures/platinum.sav";
const hasFixture = fs.existsSync(FIXTURE);

describe.skipIf(!hasFixture)("real Platinum save", () => {
  const save: ParsedSave = hasFixture ? parseGen4Save(new Uint8Array(fs.readFileSync(FIXTURE))) : (null as never);
  const dex = new Map<number, SpeciesInfo>(
    hasFixture
      ? (JSON.parse(new TextDecoder().decode(fs.readFileSync("public/data/pokemon.json"))) as SpeciesInfo[]).map((p) => [p.id, p])
      : [],
  );
  const party = () => save.mons.filter((m) => m.box === PARTY_BOX);

  it("reads the header with no warnings", () => {
    expect(save.family).toBe("platinum");
    expect(save.trainer).toEqual({ name: "Brendan", tid: 9331, sid: 9338 });
    expect(save.saveCount).toBe(573);
    expect(save.warnings).toEqual([]);
  });

  it("reads the box names", () => {
    expect(save.boxNames.slice(0, 3)).toEqual(["BOX 1", "001-030", "031-060"]);
    expect(save.boxNames[16]).toBe("451-480");
    expect(save.boxNames[17]).toBe("BOX 18");
  });

  it("reads the party", () => {
    expect(party().map((m) => [dex.get(m.species)?.displayName, m.level])).toEqual([
      ["Lopunny", 29], ["Absol", 48], ["Chatot", 50], ["Wooper", 27], ["Torterra", 60], ["Garchomp", 83],
    ]);
    const [lopunny, , , wooper, torterra, garchomp] = party();
    expect(NATURES[lopunny.nature].name).toBe("Brave");
    expect(originGameName(lopunny.originGame)).toBe("Diamond");
    expect(locationName(lopunny.metLocation)).toBe("Eterna Forest");
    expect(ballName(wooper.ball)).toBe("Safari Ball");
    expect(locationName(wooper.metLocation)).toBe("Great Marsh");
    expect(torterra.shiny).toBe(false);
    expect(NATURES[garchomp.nature].name).toBe("Naive");
    expect(abilityName(garchomp.ability)).toBe("Sand Veil");
    expect([garchomp.evs.atk, garchomp.evs.spe]).toEqual([252, 252]);
    expect(ballName(garchomp.ball)).toBe("Dusk Ball");
    expect(locationName(garchomp.metLocation)).toBe("Wayward Cave");
  });

  it("detects the living dex", () => {
    const detected = detectStartBox(save.mons, save.boxNames);
    expect(detected).toEqual({ startBox: 1, placed: 127 });
    const a = analyzeSave(save.mons, 1, dex);
    expect(a.owned.size).toBe(136);
    expect([...a.owned].filter((id) => !a.placed.has(id))).toHaveLength(9);

    // In-game Box 2, slot 11: a Caterpie holding Metapod's place
    const placeholder = save.mons.find((m) => m.box === 1 && m.slot === 10)!;
    expect(placeholder.species).toBe(10);
    expect(a.placeholders.get(11)).toBe(placeholder);
    expect(placeholder.level).toBe(5);
    expect(NATURES[placeholder.nature].name).toBe("Hasty");
    expect(abilityName(placeholder.ability)).toBe("Shield Dust");
    expect(ballName(placeholder.ball)).toBe("Quick Ball");
    expect(locationName(placeholder.metLocation)).toBe("Route 204");
  });

  it("allocates pending without inflating branching evolutions", () => {
    const profile = {
      id: "platinum-9331-9338", label: "Platinum", role: "living-dex" as const, startBox: 1, fileName: "platinum.sav",
      importedAt: 0, saveCount: save.saveCount, family: save.family, trainer: save.trainer,
    };
    const out = allocatePending([{ profile, boxNames: save.boxNames, mons: save.mons }], dex);
    // The naive "an earlier stage is owned" rule gives 113 on this save
    expect(out.pending.size).toBeLessThan(113);
    console.log(`Pending with allocation: ${out.pending.size}`);
    console.log([...out.pending].slice(0, 8).map(([id, r]) =>
      `${dex.get(id)?.displayName} ← ${dex.get(r.from)?.displayName} (${r.kind})`).join("; "));
    console.log(`Species with a shiny copy: ${out.shinyOwned.size}`);
  });
});
