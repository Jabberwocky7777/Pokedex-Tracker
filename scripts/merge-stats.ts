/**
 * One-time data migration script.
 *
 * Merges public/data/pokemon-stats.json into public/data/pokemon.json:
 *   • Adds catchRate and baseStats onto every Pokémon object
 *   • Removes the dead `versionExclusive` field (UI computes this dynamically)
 *   • Removes the dead `bestSpot` field from every encounter entry (UI recomputes it)
 *   • Deletes pokemon-stats.json (now redundant)
 *   • Writes compact (non-pretty) JSON to reduce file size
 *
 * Run once with:
 *   npm run merge-stats
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DATA = path.join(__dirname, "../public/data");

const pokemonPath = path.join(PUBLIC_DATA, "pokemon.json");
const statsPath   = path.join(PUBLIC_DATA, "pokemon-stats.json");

if (!fs.existsSync(pokemonPath)) {
  console.error("❌ public/data/pokemon.json not found — run npm run generate-data first");
  process.exit(1);
}
if (!fs.existsSync(statsPath)) {
  console.error("❌ public/data/pokemon-stats.json not found");
  process.exit(1);
}

interface StatEntry {
  id: number;
  catchRate: number;
  baseStats: { hp: number; atk: number; def: number; spAtk: number; spDef: number; spe: number };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pokemon: any[] = JSON.parse(fs.readFileSync(pokemonPath, "utf-8"));
const stats: StatEntry[] = JSON.parse(fs.readFileSync(statsPath, "utf-8"));

const statsMap = new Map(stats.map((s) => [s.id, s]));

let missing = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const merged = pokemon.map((p: any) => {
  // Destructure out the dead fields — they will not appear in output
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { versionExclusive, ...rest } = p;

  // Strip bestSpot from every GameEncounters entry
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const encounters = (rest.encounters as any[]).map((enc: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { bestSpot, ...encRest } = enc;
    return encRest;
  });

  const s = statsMap.get(p.id);
  if (!s) {
    missing++;
    console.warn(`  ⚠ No stats for #${p.id} ${p.displayName}`);
  }

  return {
    ...rest,
    encounters,
    catchRate: s?.catchRate ?? 45,
    baseStats: s?.baseStats ?? { hp: 45, atk: 45, def: 45, spAtk: 45, spDef: 45, spe: 45 },
  };
});

// Write compact JSON (no indent) — smaller file, gzip handles it well
fs.writeFileSync(pokemonPath, JSON.stringify(merged));

const sizeMB = (fs.statSync(pokemonPath).size / 1_048_576).toFixed(2);
console.log(`✓ Written public/data/pokemon.json  (${merged.length} Pokémon, ${sizeMB} MB)`);

if (missing === 0) {
  fs.rmSync(statsPath);
  console.log("✓ Removed public/data/pokemon-stats.json");
} else {
  console.warn(`⚠ Kept pokemon-stats.json — ${missing} entries were missing stats`);
}

if (missing > 0) process.exit(1);
