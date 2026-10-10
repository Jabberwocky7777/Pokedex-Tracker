/**
 * Builds src/data/save-tables.json — the lookup tables the save-file importer
 * needs to turn the numbers in a Gen III or Gen IV save into names and levels.
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
const GEN_III = "3";
const GEN_IV = "4";
// Ruby, Sapphire, Emerald, FireRed, LeafGreen in versions.csv
const GEN_III_VERSIONS = ["7", "8", "9", "10", "11"];
const MAX_GEN3_SPECIES = 386;
// Air Lock — the last ability that exists in Gen III
const MAX_GEN3_ABILITY = 76;
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

/** Game index → English name, for tables keyed by a per-generation index. */
function byGameIndex(indices: Row[], idKey: string, names: Map<string, string>, generation: string): Record<number, string> {
  const out: Record<number, string> = {};
  for (const r of indices) {
    if (r.generation_id !== generation) continue;
    const name = names.get(r[idKey]);
    if (name) out[parseInt(r.game_index, 10)] = name;
  }
  return out;
}

function expect(label: string, actual: unknown, wanted: unknown): void {
  if (actual !== wanted) throw new Error(`${label}: expected ${JSON.stringify(wanted)}, got ${JSON.stringify(actual)}`);
}

async function main() {
  const [moveNames, abilityNames, itemIndices, itemNames, locationIndices, locationNames, species, experience,
    speciesNames, gameIndices, pokemonAbilities] =
    await Promise.all(
      ["move_names", "ability_names", "item_game_indices", "item_names", "location_game_indices",
        "location_names", "pokemon_species", "experience",
        "pokemon_species_names", "pokemon_game_indices", "pokemon_abilities"].map(loadCsv),
    );

  // Arrays are indexed by id; index 0 is unused.
  const moveName = englishNames(moveNames, "move_id");
  const moves = Array.from({ length: MAX_MOVE + 1 }, (_, id) => (id === 0 ? "" : moveName.get(String(id)) ?? ""));
  const abilityName = englishNames(abilityNames, "ability_id");
  const abilities = Array.from({ length: MAX_ABILITY + 1 }, (_, id) => (id === 0 ? "" : abilityName.get(String(id)) ?? ""));

  const items4 = byGameIndex(itemIndices, "item_id", englishNames(itemNames, "item_id"), GEN_IV);
  const locations4 = byGameIndex(locationIndices, "location_id", englishNames(locationNames, "location_id"), GEN_IV);
  const items3 = byGameIndex(itemIndices, "item_id", englishNames(itemNames, "item_id"), GEN_III);
  const locations3 = byGameIndex(locationIndices, "location_id", englishNames(locationNames, "location_id"), GEN_III);

  // English species names, indexed by National Dex number (Gen III has no "is nicknamed" flag,
  // so the importer compares the stored name with the species name)
  const nameOf = englishNames(speciesNames, "pokemon_species_id");
  const speciesList = Array.from({ length: MAX_SPECIES + 1 }, (_, id) => (id === 0 ? "" : nameOf.get(String(id)) ?? ""));

  // Gen III stores species by an internal index: 1–251 match the National Dex,
  // 252–276 are unused, and Hoenn species follow in a different order.
  const species3: Record<number, number> = {};
  for (const r of gameIndices) {
    const national = parseInt(r.pokemon_id, 10);
    if (!GEN_III_VERSIONS.includes(r.version_id) || national > MAX_GEN3_SPECIES) continue;
    species3[parseInt(r.game_index, 10)] = national;
  }

  // species → its regular (non-hidden) abilities that exist in Gen III, in slot order
  const abilities3: number[][] = Array.from({ length: MAX_GEN3_SPECIES + 1 }, () => []);
  for (const r of [...pokemonAbilities].sort((x, y) => parseInt(x.slot, 10) - parseInt(y.slot, 10))) {
    const id = parseInt(r.pokemon_id, 10);
    const ability = parseInt(r.ability_id, 10);
    if (id <= MAX_GEN3_SPECIES && r.is_hidden === "0" && ability <= MAX_GEN3_ABILITY) abilities3[id].push(ability);
  }

  // Gengar had Levitate until Gen VII replaced it, so today's data has nothing left for it
  if (abilities3[94].length === 0) abilities3[94] = [26];

  // Eighths of the species that are female; -1 = genderless
  const genderOf = new Map(species.map((r) => [parseInt(r.id, 10), parseInt(r.gender_rate, 10)]));
  const genderRate = Array.from({ length: MAX_SPECIES + 1 }, (_, id) => (id === 0 ? 0 : genderOf.get(id) ?? 0));

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
    species: speciesList.filter(Boolean).length,
    species3: Object.keys(species3).length,
    items3: Object.keys(items3).length,
    locations3: Object.keys(locations3).length,
    abilities3: abilities3.filter((list) => list.length > 0).length,
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
  expect("species names", counts.species, MAX_SPECIES);
  expect("species3 size", counts.species3, MAX_GEN3_SPECIES);
  expect("species3[277] (Treecko)", species3[277], 252);
  expect("species3[25]", species3[25], 25);
  expect("species3[252] (unused)", species3[252], undefined);
  expect("abilities3", counts.abilities3, MAX_GEN3_SPECIES);
  expect("items3[1]", items3[1], "Master Ball");

  const output = {
    pokeapiCommit: POKEAPI_COMMIT, moves, abilities, items4, locations4, growth, exp,
    species: speciesList, genderRate, species3, items3, locations3, abilities3,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(output) + "\n");
  console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)} (${(fs.statSync(OUT_FILE).size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
