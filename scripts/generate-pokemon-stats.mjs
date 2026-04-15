/**
 * Fetches base stats and catch rates for Pokémon 1–386 from PokéAPI
 * and writes public/data/pokemon-stats.json
 *
 * Usage: node scripts/generate-pokemon-stats.mjs
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(__dirname, "../public/data/pokemon-stats.json");

const TOTAL = 493;
const CONCURRENCY = 20;

async function fetchPokemon(id) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
  if (!res.ok) throw new Error(`Species ${id}: ${res.status}`);
  const species = await res.json();
  const catchRate = species.capture_rate;

  const res2 = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  if (!res2.ok) throw new Error(`Pokemon ${id}: ${res2.status}`);
  const poke = await res2.json();

  const statsMap = {};
  for (const s of poke.stats) {
    statsMap[s.stat.name] = s.base_stat;
  }

  return {
    id,
    catchRate,
    baseStats: {
      hp: statsMap["hp"],
      atk: statsMap["attack"],
      def: statsMap["defense"],
      spAtk: statsMap["special-attack"],
      spDef: statsMap["special-defense"],
      spe: statsMap["speed"],
    },
  };
}

async function main() {
  const results = [];
  let completed = 0;

  for (let i = 1; i <= TOTAL; i += CONCURRENCY) {
    const batch = [];
    for (let j = i; j < Math.min(i + CONCURRENCY, TOTAL + 1); j++) {
      batch.push(j);
    }
    const batchResults = await Promise.all(batch.map(fetchPokemon));
    results.push(...batchResults);
    completed += batch.length;
    process.stdout.write(`\rFetched ${completed}/${TOTAL}...`);
  }

  results.sort((a, b) => a.id - b.id);
  writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${results.length} entries to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
