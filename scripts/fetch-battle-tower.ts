/**
 * Builds src/data/battle-tower-sets.json — all 950 Battle Tower / Frontier
 * Pokémon sets of Platinum and HeartGold/SoulSilver — from the game's own data
 * as extracted by the pret/pokeplatinum decompilation, at a pinned commit
 * (PRET_PLATINUM_COMMIT in constants.ts), so the output is reproducible.
 *
 * Move and item names come from src/data/save-tables.json (today's spellings,
 * the ones the rest of the app and the damage calculator use), species names
 * and base stats from public/data/pokemon.json; stats are the level 50 values with 31 IVs, worked
 * out by towerStats() — the same function the Trainer Lookup uses for a
 * trainer's own IV tier.
 *
 * src/data/battle-tower-trainers.json (which trainers use which sets) is not
 * made here: it was put together by hand from altissimo1.github.io's roster
 * lists and is edited directly.
 *
 * Run: npm run fetch-battle-tower
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PRET_PLATINUM_COMMIT } from "./constants.js";
import { towerStats } from "../src/lib/calc-from-tower.ts";
import type { BattleTowerSet } from "../src/types/battleTower.ts";
import type { Pokemon } from "../src/types/index.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(__dirname, "../src/data/battle-tower-sets.json");
const TABLES_FILE = path.join(__dirname, "../src/data/save-tables.json");
const POKEMON_FILE = path.join(__dirname, "../public/data/pokemon.json");
// Gitignored, per commit, like the PokéAPI CSV cache
const CACHE_DIR = path.join(__dirname, "../node_modules/.cache/pret-platinum", PRET_PLATINUM_COMMIT);
const RAW = `https://raw.githubusercontent.com/pret/pokeplatinum/${PRET_PLATINUM_COMMIT}`;

const NATURE_NAMES = [
  "Hardy", "Lonely", "Brave", "Adamant", "Naughty", "Bold", "Docile", "Relaxed", "Impish", "Lax",
  "Timid", "Hasty", "Serious", "Jolly", "Naive", "Modest", "Mild", "Quiet", "Bashful", "Rash",
  "Calm", "Gentle", "Sassy", "Careful", "Quirky",
];

/** The flags in the decompilation's files, in the order an `evSpread` is written */
const EV_FLAGS: Array<[flag: string, label: string]> = [
  ["hp", "HP"], ["attack", "Atk"], ["defense", "Def"],
  ["special_attack", "SpA"], ["special_defense", "SpD"], ["speed", "Spe"],
];

interface FrontierMon {
  species: string;
  moves: string[];
  evFlags: Record<string, boolean>;
  nature: string;
  item: string;
  form: number;
}

async function cached(file: string): Promise<string> {
  const local = path.join(CACHE_DIR, file);
  if (fs.existsSync(local)) return fs.readFileSync(local, "utf8");
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${RAW}/${file}`);
    if (res.ok) {
      const text = await res.text();
      fs.mkdirSync(path.dirname(local), { recursive: true });
      fs.writeFileSync(local, text);
      return text;
    }
    if (attempt === 3) throw new Error(`${file}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

const lines = (text: string) => text.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);

/** A constant list ("MOVE_NONE", "MOVE_POUND", …) as constant → index */
async function constants(file: string): Promise<Map<string, number>> {
  return new Map(lines(await cached(file)).map((c, i) => [c, i]));
}

/** Runs `fn` over `items` with at most `limit` at a time, keeping the order */
async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

function lookup<T>(map: Map<string, number>, key: string, names: Record<number, T> | T[], what: string): T {
  const index = map.get(key);
  const name = index === undefined ? undefined : (names as Record<number, T>)[index];
  if (name === undefined) throw new Error(`Unknown ${what}: ${key}`);
  return name;
}

async function main() {
  console.log(`Battle Tower sets from pret/pokeplatinum @ ${PRET_PLATINUM_COMMIT.slice(0, 10)}`);
  const tables = JSON.parse(fs.readFileSync(TABLES_FILE, "utf8"));
  const allPokemon: Pokemon[] = JSON.parse(fs.readFileSync(POKEMON_FILE, "utf8"));
  const byId = new Map(allPokemon.map((p) => [p.id, p]));

  const [species, moves, items, natures] = await Promise.all([
    constants("generated/species.txt"),
    constants("generated/moves.txt"),
    constants("generated/items.txt"),
    constants("generated/natures.txt"),
  ]);
  // Entry 0 is a blank set the game never uses; set ids are positions in this list
  const order = lines(await cached("res/trainers/frontier/frontier_pokemon.order"));
  const files = await mapLimited(order.slice(1), 16, async (stem) =>
    JSON.parse(await cached(`res/trainers/frontier/pokemon/${stem}.json`)) as FrontierMon);

  const sets: BattleTowerSet[] = files.map((mon, i) => {
    const id = i + 1;
    const stem = order[id];
    if (mon.form) throw new Error(`${stem}: form ${mon.form} — forms aren't handled`);
    // The species list is in National Dex order
    const dex = lookup(species, mon.species, [...species.values()], "species");
    const pokemon = byId.get(dex);
    if (!pokemon) throw new Error(`${stem}: #${dex} isn't in pokemon.json`);
    const set = {
      id,
      // As the app names it, which is how sets are matched to Pokémon
      species: pokemon.displayName,
      setNumber: Number(stem.match(/_(\d+)$/)?.[1]),
      nature: lookup(natures, mon.nature, NATURE_NAMES, "nature"),
      // The tables have the typographic apostrophe ("King’s Rock"); the app types a plain one
      item: mon.item === "ITEM_NONE" ? "" : lookup(items, mon.item, tables.items4 as Record<number, string>, "item").replace(/’/g, "'"),
      moves: mon.moves.map((m) => (m === "MOVE_NONE" ? "" : lookup(moves, m, tables.moves as string[], "move"))) as BattleTowerSet["moves"],
      evSpread: EV_FLAGS.filter(([flag]) => mon.evFlags[flag]).map(([, label]) => label).join("/"),
      stats: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    };
    if (!Number.isInteger(set.setNumber)) throw new Error(`${stem}: no set number`);
    set.stats = towerStats(set, pokemon, 31);
    return set;
  });

  if (sets.length !== 950) throw new Error(`Expected 950 sets, got ${sets.length}`);
  fs.writeFileSync(OUT_FILE, JSON.stringify(sets, null, 2) + "\n");
  const speciesCount = new Set(sets.map((s) => s.species)).size;
  console.log(`  ✓ ${sets.length} sets of ${speciesCount} species → ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
