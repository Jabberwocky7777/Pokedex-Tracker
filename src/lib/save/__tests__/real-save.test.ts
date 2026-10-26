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
  });
});

// Optional checks against other real dumps (also gitignored): put an Emerald save at
// fixtures/emerald.sav and a Diamond/Pearl save at fixtures/pearl.sav. The values are
// from the saves these readers were first checked against — a party of four early in
// Emerald with an untouched PC, and a Pearl game saved once before catching anything.
const EMERALD = "src/lib/save/__tests__/fixtures/emerald.sav";
const PEARL = "src/lib/save/__tests__/fixtures/pearl.sav";
// A SoulSilver save part-way through Johto (fixtures/soulsilver.sav): six in the party, eleven in Box 1.
const SOULSILVER = "src/lib/save/__tests__/fixtures/soulsilver.sav";

describe.skipIf(!fs.existsSync(EMERALD))("real Emerald save", () => {
  it("reads the newer block, the party and the box names", async () => {
    const { parseSave } = await import("../parse");
    const { metLocationName, moveName } = await import("../tables");
    const save = parseSave(new Uint8Array(fs.readFileSync(EMERALD)));
    expect(save).toMatchObject({ family: "rse", game: "Emerald", saveCount: 9, warnings: [] });
    expect(save.trainer.name).toBe("Brendan");
    expect(save.boxNames).toEqual(Array.from({ length: 14 }, (_, i) => `BOX${i + 1}`));
    expect(save.mons.map((m) => [m.species, m.level, NATURES[m.nature].name, abilityName(m.ability), metLocationName(m), m.metLevel])).toEqual([
      [285, 13, "Calm", "Effect Spore", "Petalburg Woods", 6],
      [258, 15, "Mild", "Torrent", "Route 101", 5],
      [280, 9, "Bold", "Trace", "Route 102", 4],
      [290, 6, "Lonely", "Compound Eyes", "Route 116", 6],
    ]);
    expect(save.mons[1].moves.filter(Boolean).map(moveName)).toEqual(["Tackle", "Bide", "Mud-Slap", "Water Gun"]);
    expect(save.mons.every((m) => m.own && !m.isNicknamed && !m.shiny && m.box === PARTY_BOX)).toBe(true);
  });
});

describe.skipIf(!fs.existsSync(PEARL))("real Pearl save", () => {
  it("detects the Diamond/Pearl layout and reads the header", () => {
    const save = parseGen4Save(new Uint8Array(fs.readFileSync(PEARL)));
    expect(save).toMatchObject({ family: "dp", saveCount: 1, warnings: [], mons: [] });
    expect(save.trainer.name).toBe("Brendan");
    expect(save.boxNames).toEqual(Array.from({ length: 18 }, (_, i) => `BOX ${i + 1}`));
  });
});

describe.skipIf(!fs.existsSync(SOULSILVER))("real SoulSilver save", () => {
  it("accepts the 0x10-byte HGSS footer and reads the trainer, party and boxes", async () => {
    const { metLocationName, moveName } = await import("../tables");
    const save = parseGen4Save(new Uint8Array(fs.readFileSync(SOULSILVER)));
    expect(save).toMatchObject({ family: "hgss", game: "SoulSilver", saveCount: 48, warnings: [] });
    expect(save.trainer).toEqual({ name: "Brendan", tid: 36166, sid: 36166 });
    expect(save.mons).toHaveLength(17);
    const party = save.mons.filter((m) => m.box === PARTY_BOX);
    expect(party.map((m) => [m.species, m.level, abilityName(m.ability), metLocationName(m), m.metLevel, ballName(m.ball)])).toEqual([
      [39, 15, "Cute Charm", "Safari Zone", 15, "Safari Ball"],
      [154, 36, "Overgrow", "New Bark Town", 5, "Poké Ball"],
      [130, 32, "Intimidate", "Lake of Rage", 30, "Ultra Ball"],
      [176, 32, "Serene Grace", "Azalea Town", 0, "Poké Ball"],
      [19, 4, "Run Away", "Route 46", 2, "Poké Ball"],
      [213, 20, "Gluttony", "Cianwood City", 20, "Poké Ball"],
    ]);
    // The red Gyarados, and the in-game trade Shuckle with its own trainer and nickname
    expect(party[2]).toMatchObject({ shiny: true, gender: "female" });
    expect(party[2].moves.filter(Boolean).map(moveName)).toEqual(["Bite", "Dragon Rage", "Surf", "Ice Fang"]);
    expect(party[5]).toMatchObject({ nickname: "Shuckie", isNicknamed: true, otName: "Kirk", own: false });
    expect(save.mons.filter((m) => m.box === 0).map((m) => m.species).slice(0, 4)).toEqual([69, 161, 74, 179]);
    expect(save.boxNames).toEqual(Array.from({ length: 18 }, (_, i) => `BOX ${i + 1}`));
  });
});

// Game progress (lib/save/progress.ts) isn't verified on any real save yet. With
// a fixture in place this prints what the readers find; compare it with the
// game's trainer card (badges, play time) and whether you have entered the Hall
// of Fame and have the National Pokédex. When it matches, write the values in
// as expectations and add the family to PROGRESS_VERIFIED.
describe("game progress from real saves (unverified offsets)", () => {
  const fixtures = ["platinum", "pearl", "soulsilver", "emerald"]
    .map((name) => [name, `src/lib/save/__tests__/fixtures/${name}.sav`] as const)
    .filter(([, path]) => fs.existsSync(path));
  it.skipIf(fixtures.length === 0)("reads something plausible", async () => {
    const { parseGen3Save } = await import("../gen3");
    for (const [name, path] of fixtures) {
      const bytes = new Uint8Array(fs.readFileSync(path));
      const save = name === "emerald" ? parseGen3Save(bytes, { unverifiedProgress: true }) : parseGen4Save(bytes, { unverifiedProgress: true });
      console.log(`${name} progress:`, JSON.stringify(save.progress));
      if (!save.progress) continue;
      expect(save.progress.badges!.length).toBeLessThanOrEqual(save.family === "hgss" ? 16 : 8);
      expect(save.progress.playTime!.minutes).toBeLessThan(60);
    }
  });
});
