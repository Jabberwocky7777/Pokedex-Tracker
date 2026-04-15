/**
 * patch-slot2.ts
 *
 * One-time patch script to fix Dual Slot (Slot 2) encounter methods in pokemon.json.
 *
 * Problem: PokéAPI returns Slot 2 encounters as method="walk" — the cartridge
 * requirement is encoded in condition_values (e.g. "slot2-sapphire"), not the method
 * name. Our original fetch did not read condition_values, so all slot2 encounters
 * were stored as "walk" in pokemon.json.
 *
 * Fix: For every Pokémon that has Gen 4 encounters, re-fetch the encounter endpoint,
 * check condition_values for slot2-* markers, and update the method field in the
 * existing pokemon.json.
 *
 * Run with:  npx tsx scripts/patch-slot2.ts
 */

import fs from "fs";
import path from "path";

const POKEAPI_BASE = "https://pokeapi.co/api/v2";
const GEN4_GAMES = new Set(["diamond", "pearl", "platinum", "heartgold", "soulsilver"]);
const DELAY_MS = 150; // conservative throttle between requests
const BATCH_SIZE = 10;
const DATA_PATH = path.join(process.cwd(), "public", "data", "pokemon.json");

interface StoredDetail {
  method: string;
  minLevel: number;
  maxLevel: number;
  chance: number;
  isStatic: boolean;
}

interface StoredLocation {
  locationAreaSlug: string;
  locationDisplayName: string;
  details: StoredDetail[];
}

interface StoredEncounter {
  version: string;
  locations: StoredLocation[];
}

interface StoredPokemon {
  id: number;
  name: string;
  encounters: StoredEncounter[];
  [key: string]: unknown;
}

interface RawEncounterDetail {
  method: { name: string };
  min_level: number;
  max_level: number;
  chance: number;
  condition_values: { name: string }[];
}

interface RawVersionDetail {
  version: { name: string };
  encounter_details: RawEncounterDetail[];
}

interface RawEncounterEntry {
  location_area: { name: string };
  version_details: RawVersionDetail[];
}

/**
 * Maps PokéAPI condition_value names to the internal method name they imply.
 * Only conditions that CHANGE the effective encounter method are listed here.
 * Conditions like "swarm-no", "radar-off", "slot2-none" leave the base method unchanged.
 */
const CONDITION_METHOD_MAP: Record<string, string> = {
  // Dual-slot (Slot 2) — one entry per GBA cartridge
  "slot2-ruby":      "slot2-ruby",
  "slot2-sapphire":  "slot2-sapphire",
  "slot2-emerald":   "slot2-emerald",
  "slot2-firered":   "slot2-firered",
  "slot2-leafgreen": "slot2-leafgreen",
  // Pokéradar
  "radar-on":        "poke-radar",
  // Mass outbreak / swarm
  "swarm-yes":       "swarm",
  // Pokégear Radio (HGSS)
  "radio-hoenn":     "radio",
  "radio-sinnoh":    "radio",
};

async function fetchEncounters(pokemonId: number): Promise<RawEncounterEntry[]> {
  const res = await fetch(`${POKEAPI_BASE}/pokemon/${pokemonId}/encounters`);
  if (!res.ok) throw new Error(`Failed to fetch encounters for #${pokemonId}: ${res.status}`);
  return res.json() as Promise<RawEncounterEntry[]>;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build a lookup from "version:locationSlug:minLevel:maxLevel:chance" → remapped method name.
 * Covers Slot 2, Pokéradar, swarm, and radio condition values.
 */
function buildConditionLookup(rawEncounters: RawEncounterEntry[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const enc of rawEncounters) {
    for (const vd of enc.version_details) {
      if (!GEN4_GAMES.has(vd.version.name)) continue;
      for (const detail of vd.encounter_details) {
        // Find the first condition value that implies a different method
        const matchedCond = detail.condition_values.find((cv) =>
          cv.name in CONDITION_METHOD_MAP
        );
        if (!matchedCond) continue;
        const mappedMethod = CONDITION_METHOD_MAP[matchedCond.name];
        // Key: version + locationSlug + min + max + chance (enough to uniquely match)
        const key = `${vd.version.name}:${enc.location_area.name}:${detail.min_level}:${detail.max_level}:${detail.chance}`;
        lookup.set(key, mappedMethod);
      }
    }
  }
  return lookup;
}

/**
 * Apply the slot2 lookup to a Pokémon's stored encounter array.
 * Returns true if any changes were made.
 */
function applySlot2Patch(pokemon: StoredPokemon, lookup: Map<string, string>): boolean {
  if (lookup.size === 0) return false;
  let changed = false;
  for (const enc of pokemon.encounters) {
    if (!GEN4_GAMES.has(enc.version)) continue;
    for (const loc of enc.locations) {
      for (const detail of loc.details) {
        const key = `${enc.version}:${loc.locationAreaSlug}:${detail.minLevel}:${detail.maxLevel}:${detail.chance}`;
        const slot2Method = lookup.get(key);
        if (slot2Method && detail.method !== slot2Method) {
          detail.method = slot2Method;
          changed = true;
        }
      }
    }
  }
  return changed;
}

async function main() {
  console.log("Loading pokemon.json...");
  const raw = fs.readFileSync(DATA_PATH, "utf-8");
  const pokemon: StoredPokemon[] = JSON.parse(raw);

  // Only process Pokémon that have Gen 4 encounters
  const targets = pokemon.filter((p) =>
    p.encounters.some((e) => GEN4_GAMES.has(e.version))
  );
  console.log(`Found ${targets.length} Pokémon with Gen 4 encounters to check.`);

  let patched = 0;
  let errored = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(targets.length / BATCH_SIZE);
    process.stdout.write(`\rBatch ${batchNum}/${totalBatches} (${i + 1}–${Math.min(i + BATCH_SIZE, targets.length)} of ${targets.length})...`);

    await Promise.all(
      batch.map(async (p) => {
        try {
          const rawEncounters = await fetchEncounters(p.id);
          const lookup = buildConditionLookup(rawEncounters);
          const changed = applySlot2Patch(p, lookup);
          if (changed) patched++;
        } catch (err) {
          errored++;
          process.stderr.write(`\nError on #${p.id} (${p.name}): ${(err as Error).message}\n`);
        }
      })
    );

    if (i + BATCH_SIZE < targets.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n\nDone. Patched ${patched} Pokémon, ${errored} errors.`);

  if (patched > 0) {
    console.log("Writing updated pokemon.json...");
    fs.writeFileSync(DATA_PATH, JSON.stringify(pokemon), "utf-8");
    console.log("✓ pokemon.json updated.");
  } else {
    console.log("No changes needed.");
  }

  // Show a summary of all condition-remapped methods now in the data
  const methodCounts: Record<string, number> = {};
  const affectedMethods = new Set(Object.values(CONDITION_METHOD_MAP));
  for (const p of pokemon) {
    for (const enc of p.encounters) {
      for (const loc of enc.locations) {
        for (const detail of loc.details) {
          if (affectedMethods.has(detail.method)) {
            methodCounts[detail.method] = (methodCounts[detail.method] ?? 0) + 1;
          }
        }
      }
    }
  }
  if (Object.keys(methodCounts).length > 0) {
    console.log("\nCondition-remapped encounter counts by method:");
    for (const [method, count] of Object.entries(methodCounts).sort()) {
      console.log(`  ${method}: ${count} encounter details`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
