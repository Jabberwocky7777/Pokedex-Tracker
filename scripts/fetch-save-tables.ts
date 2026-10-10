/**
 * Builds src/data/save-tables.json — the lookup tables the save-file importer
 * needs to turn the numbers in a Gen IV save into names and levels.
 *
 * Reads PokéAPI's CSV dump at the same pinned commit as the encounter data
 * (POKEAPI_COMMIT in constants.ts), so the output is reproducible.
 *
 * Run via: npm run generate-save-tables
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { POKEAPI_COMMIT, POKEAPI_CSV_BASE } from "./constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Same cache the encounter loader uses (gitignored, per commit).
const CACHE_DIR = path.join(__dirname, "../node_modules/.cache/pokeapi-csv", POKEAPI_COMMIT);
const OUT_FILE = path.join(__dirname, "../src/data/save-tables.json");

const ENGLISH = "9";
const GEN_IV = "4";
const MAX_MOVE = 467;
const MAX_ABILITY = 123;
const MAX_SPECIES = 493;

type Row = Record<string, string>;

/** CSV parser that copes with quoted fields (commas, newlines and "" inside quotes). */
export function parseCsv(text: string): Row[] {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      record.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(cell);
      cell = "";
      if (record.length > 1 || record[0] !== "") records.push(record);
      record = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || record.length > 0) {
    record.push(cell);
    records.push(record);
  }
  const [header, ...rows] = records;
  return rows.map((cells) => {
    const row: Row = {};
    header.forEach((key, i) => { row[key] = (cells[i] ?? "").trim(); });
    return row;
  });
}

async function loadCsv(name: string): Promise<Row[]> {
  const cached = path.join(CACHE_DIR, `${name}.csv`);
  let text: string;
  if (fs.existsSync(cached)) {
    text = fs.readFileSync(cached, "utf8");
  } else {
    const url = `${POKEAPI_CSV_BASE}/${POKEAPI_COMMIT}/data/v2/csv/${name}.csv`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    text = await res.text();
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cached, text);
  }
  return parseCsv(text);
}

function englishNames(rows: Row[], idKey: string): Map<string, string> {
  return new Map(rows.filter((r) => r.local_language_id === ENGLISH).map((r) => [r[idKey], r.name]));
}

/** Gen IV game index → English name, for tables keyed by a per-generation index. */
function byGameIndex(indices: Row[], idKey: string, names: Map<string, string>): Record<number, string> {
  const out: Record<number, string> = {};
  for (const r of indices) {
    if (r.generation_id !== GEN_IV) continue;
    const name = names.get(r[idKey]);
    if (name) out[parseInt(r.game_index, 10)] = name;
  }
  return out;
}

function expect(label: string, actual: unknown, wanted: unknown): void {
  if (actual !== wanted) throw new Error(`${label}: expected ${JSON.stringify(wanted)}, got ${JSON.stringify(actual)}`);
}

async function main() {
  const [moveNames, abilityNames, itemIndices, itemNames, locationIndices, locationNames, species, experience] =
    await Promise.all(
      ["move_names", "ability_names", "item_game_indices", "item_names", "location_game_indices",
        "location_names", "pokemon_species", "experience"].map(loadCsv),
    );

  // Arrays are indexed by id; index 0 is unused.
  const moveName = englishNames(moveNames, "move_id");
  const moves = Array.from({ length: MAX_MOVE + 1 }, (_, id) => (id === 0 ? "" : moveName.get(String(id)) ?? ""));
  const abilityName = englishNames(abilityNames, "ability_id");
  const abilities = Array.from({ length: MAX_ABILITY + 1 }, (_, id) => (id === 0 ? "" : abilityName.get(String(id)) ?? ""));

  const items4 = byGameIndex(itemIndices, "item_id", englishNames(itemNames, "item_id"));
  const locations4 = byGameIndex(locationIndices, "location_id", englishNames(locationNames, "location_id"));

  const growthOf = new Map(species.map((r) => [parseInt(r.id, 10), parseInt(r.growth_rate_id, 10)]));
  const growth = Array.from({ length: MAX_SPECIES + 1 }, (_, id) => (id === 0 ? 0 : growthOf.get(id) ?? 0));

  // growth_rate_id → total EXP needed to reach each level; index = level (0 unused)
  const exp: Record<number, number[]> = {};
  for (const r of experience) {
    const level = parseInt(r.level, 10);
    if (level > 100) continue;
    (exp[parseInt(r.growth_rate_id, 10)] ??= [0])[level] = parseInt(r.experience, 10);
  }

  const counts = {
    moves: moves.filter(Boolean).length,
    abilities: abilities.filter(Boolean).length,
    items4: Object.keys(items4).length,
    locations4: Object.keys(locations4).length,
    growth: growth.filter(Boolean).length,
    exp: Object.keys(exp).length,
  };
  console.log("Save tables:", counts);

  expect("moves", counts.moves, MAX_MOVE);
  expect("abilities", counts.abilities, MAX_ABILITY);
  expect("growth", counts.growth, MAX_SPECIES);
  expect("exp curves", counts.exp, 6);
  expect("items4[1]", items4[1], "Master Ball");
  expect("locations4[55]", locations4[55], "Pal Park");
  expect("locations4[2000]", locations4[2000], "Day-Care Couple");
  expect("locations4[3002]", locations4[3002], "Faraway place");

  const output = { pokeapiCommit: POKEAPI_COMMIT, moves, abilities, items4, locations4, growth, exp };
  fs.writeFileSync(OUT_FILE, JSON.stringify(output) + "\n");
  console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)} (${(fs.statSync(OUT_FILE).size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
