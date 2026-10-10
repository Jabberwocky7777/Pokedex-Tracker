/**
 * validate-data.ts
 *
 * Sanity checks for the generated public/data/pokemon.json. Runs at the end of
 * `npm run generate-data` and exits non-zero on any failure, so bad data can't
 * be committed unnoticed.
 *
 * Run on its own with:  npm run validate-data
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GEN3_VERSION_NAMES, GEN4_VERSION_NAMES } from "./constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "../public/data/pokemon.json");
const PROVENANCE_PATH = path.join(__dirname, "data/override-provenance.json");

interface Detail {
  method: string;
  minLevel: number;
  maxLevel: number;
  chance: number;
}
interface Location {
  locationAreaSlug: string;
  locationDisplayName: string;
  details: Detail[];
}
interface PokemonEntry {
  id: number;
  name: string;
  displayName: string;
  types: string[];
  baseStats: Record<string, number>;
  abilities?: { name: string; isHidden: boolean }[];
  evolvesTo: { speciesId: number }[];
  encounters: { version: string; locations: Location[] }[];
}

const pokemon: PokemonEntry[] = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
const overrideRows = new Set<string>(
  fs.existsSync(PROVENANCE_PATH)
    ? (JSON.parse(fs.readFileSync(PROVENANCE_PATH, "utf8")).overrideRows as string[])
    : [],
);

const failures: string[] = [];
const warnings: string[] = [];

// Override locations use a hand-written name and slug, PokéAPI ones an area slug.
// Compare on the display name with parentheticals and punctuation stripped.
function locationKey(loc: Location): string {
  return loc.locationDisplayName.replace(/\([^)]*\)/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const SINNOH = ["diamond", "pearl", "platinum"];
const KANTO_STARTERS = new Set([1, 4, 7]);
const counts: Record<string, Record<string, number>> = {};

for (const p of pokemon) {
  for (const enc of p.encounters) {
    const versionCounts = (counts[enc.version] ??= {});
    // location name + method → the levels seen from each source
    const sources = new Map<string, { pokeapi: Set<string>; override: Set<string> }>();

    for (const loc of enc.locations) {
      const methods = new Set(loc.details.map((d) => d.method));
      if (methods.has("unknown") && methods.size > 1) {
        warnings.push(
          `${p.displayName} / ${enc.version} / ${loc.locationAreaSlug}: "unknown" alongside ${[...methods].filter((m) => m !== "unknown").join(", ")}`,
        );
      }

      for (const d of loc.details) {
        versionCounts[d.method] = (versionCounts[d.method] ?? 0) + 1;

        if (d.method === "swarm" && d.minLevel === 15 && d.maxLevel === 45) {
          failures.push(`Placeholder swarm row (Lv. 15–45): ${p.displayName} / ${enc.version} / ${loc.locationAreaSlug}`);
        }
        if (KANTO_STARTERS.has(p.id) && SINNOH.includes(enc.version)) {
          failures.push(`${p.displayName} has a ${d.method} encounter in ${enc.version} at ${loc.locationAreaSlug}`);
        }

        const key = `${locationKey(loc)}|${d.method}`;
        const entry = sources.get(key) ?? { pokeapi: new Set<string>(), override: new Set<string>() };
        const isOverride = overrideRows.has(
          `${p.id}|${enc.version}|${loc.locationAreaSlug}|${d.method}|${d.minLevel}|${d.maxLevel}`,
        );
        (isOverride ? entry.override : entry.pokeapi).add(`${d.minLevel}-${d.maxLevel}`);
        sources.set(key, entry);
      }
    }

    for (const [key, { pokeapi, override }] of sources) {
      if (pokeapi.size > 0 && override.size > 0) {
        failures.push(
          `${p.displayName} / ${enc.version} / ${key}: PokéAPI levels (${[...pokeapi].join(", ")}) and override levels (${[...override].join(", ")}) for the same location and method`,
        );
      }
    }
  }
}

// ── Species data: complete, and as it was in Generation IV ───────────────
const TOTAL_SPECIES = 493;
const GEN4_TYPES = new Set([
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground",
  "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel",
]);
const STAT_NAMES = ["hp", "atk", "def", "spAtk", "spDef", "spe"];

if (pokemon.length !== TOTAL_SPECIES) failures.push(`Expected ${TOTAL_SPECIES} Pokémon, found ${pokemon.length}`);
pokemon.forEach((p, i) => {
  if (p.id !== i + 1) failures.push(`Entry ${i} has id ${p.id}, expected ${i + 1}`);
  for (const t of p.types ?? []) {
    if (!GEN4_TYPES.has(t)) failures.push(`${p.displayName} has the type "${t}", which doesn't exist in Generation IV`);
  }
  if (!p.types || p.types.length === 0) failures.push(`${p.displayName} has no types`);
  for (const stat of STAT_NAMES) {
    if (!(p.baseStats?.[stat] > 0)) failures.push(`${p.displayName} has no base ${stat}`);
  }
  if (!p.abilities || p.abilities.length === 0) failures.push(`${p.displayName} has no abilities`);
  if (p.abilities?.some((a) => a.isHidden)) failures.push(`${p.displayName} lists a hidden ability (Generation V+)`);
  for (const step of p.evolvesTo ?? []) {
    if (step.speciesId > TOTAL_SPECIES) failures.push(`${p.displayName} evolves into #${step.speciesId}, which is past Generation IV`);
  }
});

// A few values that changed after Generation IV — these catch a regeneration
// that falls back to PokéAPI's current-game data.
const byName = new Map(pokemon.map((p) => [p.name, p]));
const expectGen4 = (name: string, what: string, actual: unknown, wanted: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    failures.push(`${name}: ${what} is ${JSON.stringify(actual)}, expected the Generation IV value ${JSON.stringify(wanted)}`);
  }
};
expectGen4("clefairy", "types", byName.get("clefairy")?.types, ["normal"]);
expectGen4("gardevoir", "types", byName.get("gardevoir")?.types, ["psychic"]);
expectGen4("togekiss", "types", byName.get("togekiss")?.types, ["normal", "flying"]);
expectGen4("pidgeot", "Speed", byName.get("pidgeot")?.baseStats.spe, 91);
expectGen4("alakazam", "Sp. Def", byName.get("alakazam")?.baseStats.spDef, 85);
expectGen4("butterfree", "Sp. Atk", byName.get("butterfree")?.baseStats.spAtk, 80);
expectGen4("cresselia", "Defense", byName.get("cresselia")?.baseStats.def, 120);
expectGen4("gengar", "abilities", byName.get("gengar")?.abilities?.map((a) => a.name), ["levitate"]);

for (const version of ["heartgold", "soulsilver"]) {
  if (!counts[version]?.headbutt) failures.push(`${version} has zero headbutt encounters`);
}

// ── Report ──────────────────────────────────────────────────────────────
console.log("Encounter detail rows by version and method:\n");
for (const version of [...GEN3_VERSION_NAMES, ...GEN4_VERSION_NAMES]) {
  const byMethod = counts[version] ?? {};
  const total = Object.values(byMethod).reduce((a, b) => a + b, 0);
  console.log(`  ${version} (${total})`);
  for (const [method, n] of Object.entries(byMethod).sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`    ${method.padEnd(16)} ${n}`);
  }
}

if (!fs.existsSync(PROVENANCE_PATH)) {
  warnings.push("scripts/data/override-provenance.json is missing — the PokéAPI-vs-override duplicate check was skipped");
}
if (warnings.length > 0) {
  console.log(`\n⚠ ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ${w}`);
}
if (failures.length > 0) {
  console.error(`\n❌ ${failures.length} validation failure(s):`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log("\n✅ Data validation passed");
