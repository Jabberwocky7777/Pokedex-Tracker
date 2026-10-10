/**
 * Two made-up saves for trying the Saves view by hand without a real dump:
 * a Platinum living dex (dex from Box 2) and a SoulSilver playthrough.
 *
 * In the dev server's browser console:
 *   const { demoFiles } = await import("/src/lib/save/__tests__/demo.ts");
 *   then feed demoFiles()[0] to the Saves view's file input.
 */
import { buildSave, type MonSpec, type SaveSpec } from "./build";

const home = (n: number) => `${1 + Math.floor((n - 1) / 30)}:${(n - 1) % 30}`;

export function demoSpecs(): { platinum: SaveSpec; soulsilver: SaveSpec } {
  const boxNames = ["BOX 1"];
  for (let i = 0; i < 16; i++) boxNames.push(`${String(i * 30 + 1).padStart(3, "0")}-${String(i * 30 + 30).padStart(3, "0")}`);
  boxNames.push("BOX 18");

  const boxes: Record<string, MonSpec> = {};
  const gaps = [2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18, 20, 22, 24, 26, 35, 36];
  for (let n = 1; n <= 60; n++) {
    if (gaps.includes(n)) continue;
    boxes[home(n)] = {
      species: n, exp: 1000 + n * 50, shiny: n % 7 === 0, moves: [33, 45, 98, 17],
      ivs: { hp: 31, atk: n % 32, def: 10, spe: 20, spAtk: 5, spDef: 31 }, evs: { atk: 252, spe: 252, hp: 4 },
    };
  }
  boxes[home(11)] = { species: 10, exp: 343, ball: 15, metLocation: 20 }; // Caterpie Lv 7 holding Metapod's slot: ready
  boxes[home(12)] = { species: 10, exp: 27 };                             // Caterpie Lv 3 holding Butterfree's slot
  boxes[home(2)] = { species: 1, exp: 200 };
  boxes[home(20)] = { species: 150, exp: 5000, originGame: 4, metLocation: 55 }; // wrong species; Pal Park
  boxes[home(133)] = { species: 133, exp: 8000 };
  // Pikachu and Raichu in each other's slots
  boxes[home(25)] = { species: 26, exp: 9000 };
  boxes[home(26)] = { species: 25, exp: 9000, tid: 777, sid: 888, otName: "Lucas" }; // traded
  // Holding box
  boxes["0:0"] = { species: 133, exp: 500, friendship: 230 };
  boxes["0:1"] = { species: 41, shiny: true, exp: 900, ivs: { hp: 31, atk: 31, def: 31, spe: 31, spAtk: 31, spDef: 30 } };
  boxes["0:2"] = { species: 35, exp: 3000 };                    // Clefairy, out of place; Clefable missing
  boxes["0:3"] = { species: 175, isEgg: true };
  boxes["0:4"] = { species: 479, form: 2, exp: 20000 };
  boxes["0:5"] = { species: 95, exp: 9000, heldItem: 233 };     // Onix holding a Metal Coat
  boxes["0:6"] = { species: 221, exp: 30000, moves: [246, 33] }; // Piloswine knowing Ancient Power
  boxes["0:7"] = { species: 19, exp: 400 };                     // spare Rattata

  const platinum: SaveSpec = {
    trainerName: "Brendan", tid: 9331, sid: 9338, saveCount: 573, splitSlots: true, boxNames, boxes,
    party: [
      {
        species: 445, pid: 0x12344, ability: 8, level: 83, exp: 700000, nickname: "Chomper", heldItem: 268,
        evs: { atk: 252, spe: 252, hp: 4 }, ivs: { hp: 31, atk: 31, def: 20, spe: 31, spAtk: 3, spDef: 17 },
        moves: [89, 337, 14, 242], ball: 13, metLocation: 65, metLevel: 20,
      },
      { species: 428, level: 29, female: true, originGame: 10 },
    ],
  };

  const soulsilver: SaveSpec = {
    family: "hgss", trainerName: "Lyra", tid: 100, sid: 200, saveCount: 40,
    party: [{ species: 157, level: 44, originGame: 8 }, { species: 133, level: 10, originGame: 8 }],
    boxes: {
      "0:0": { species: 179, originGame: 8 },
      "0:1": { species: 130, shiny: true, originGame: 8 },
      "2:7": { species: 214, originGame: 8, exp: 12000 },
      "2:8": { species: 15, originGame: 8, exp: 12000, shiny: true, ivs: { hp: 31, atk: 31, def: 31, spe: 31, spAtk: 31, spDef: 31 } },
    },
  };
  return { platinum, soulsilver };
}

export function demoFiles(): File[] {
  const { platinum, soulsilver } = demoSpecs();
  const file = (spec: SaveSpec, name: string) => new File([buildSave(spec).buffer as ArrayBuffer], name);
  return [file(platinum, "Platinum.sav"), file(soulsilver, "SoulSilver.sav")];
}

/** Dev helper: push a file into the Saves view's hidden input, as if the user had picked it. */
export function feed(file: File): void {
  const input = document.querySelector<HTMLInputElement>('[data-testid="save-file-input"]');
  if (!input) throw new Error("Open the Saves view first");
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Dev helper: click the first visible button whose text starts with `text`, optionally inside `scope`. */
export function click(text: string, scope?: string): void {
  const root: ParentNode = (scope ? document.querySelector(scope) : null) ?? document;
  const button = [...root.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(text) && b.offsetParent !== null);
  if (!button) throw new Error(`No visible button starting with "${text}"`);
  button.click();
}

/** A made-up Emerald save (Gen III), dex from Box 1, for trying GBA import by hand. */
export async function demoEmeraldFile(): Promise<File> {
  const { buildSave3 } = await import("./build3");
  const boxes: Record<string, { species: number; exp?: number; shiny?: boolean }> = {};
  for (let n = 1; n <= 40; n++) if (n % 5 !== 0) boxes[`${Math.floor((n - 1) / 30)}:${(n - 1) % 30}`] = { species: n, exp: 800 + n * 40, shiny: n === 7 };
  boxes["8:11"] = { species: 252, exp: 135 };  // Treecko in its own slot (#252)
  boxes["13:0"] = { species: 280, exp: 500 };  // Ralts, loose in the last box
  const bytes = buildSave3({
    trainerName: "May", tid: 4242, sid: 1717, saveIndex: 37, rotation: 5, securityKey: 0x55aa,
    party: [{ species: 257, level: 62, nickname: "Sanji", item: 179, moves: [299, 136, 89, 14], pid: 0x00c0ffee }],
    boxes,
  });
  return new File([bytes.buffer as ArrayBuffer], "Emerald.sav");
}
