import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  ALL_VERSION_NAMES,
  GENERATION_META,
  REGIONAL_DEXES,
  FETCH_DELAY_MS,
  BATCH_SIZE,
  POKEAPI_BASE,
  POKEAPI_COMMIT,
} from "./constants.js";
import { formatLocationSlug } from "../src/lib/format-location.js";
import { loadEncountersFromCsv, type RawEncounterEntry } from "./pokeapi-csv.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../src/data");
const PUBLIC_DATA_DIR = path.join(__dirname, "../public/data");
// Lists which encounter rows came from overrides.json rather than PokéAPI.
// Read by validate-data.ts to catch overrides that duplicate PokéAPI data.
const PROVENANCE_PATH = path.join(__dirname, "data/override-provenance.json");

// ─── Types ─────────────────────────────────────────────────────────────

interface RawEvolutionChainLink {
  species: { name: string; url: string };
  evolution_details: {
    trigger: { name: string };
    min_level: number | null;
    item: { name: string } | null;
  }[];
  evolves_to: RawEvolutionChainLink[];
}

// ─── Helpers ────────────────────────────────────────────────────────────

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function capitalizeWords(str: string): string {
  return str
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function mapEncounterMethod(apiMethod: string): string {
  const map: Record<string, string> = {
    // Walking
    "walk": "walk",
    // Water
    "surf": "surf",
    // Fishing
    "old-rod": "old-rod",
    "good-rod": "good-rod",
    "super-rod": "super-rod",
    "rock-smash": "rock-smash",
    "headbutt": "headbutt",
    "honey-tree": "honey-tree",
    // One-off encounters
    "gift": "gift",
    "gift-egg": "gift",
    "static": "static",
    "npc-trade": "trade",
    // Overworld Pokémon you have to interact with (Snorlax, Sudowoodo, Kecleon)
    "pokeflute": "static",
    "squirt-bottle": "static",
    "wailmer-pail": "static",
    "devon-scope": "static",
    // Roamers
    "roaming-grass": "walk",
    "roaming-water": "surf",
  };
  // Anything else (Dive seaweed, Feebas tiles, bonus-disc / Ranger events) has no
  // matching EncounterMethod in the app yet and is shown as "unknown".
  return map[apiMethod] ?? "unknown";
}

const STATIC_API_METHODS = new Set(["static", "pokeflute", "squirt-bottle", "wailmer-pail", "devon-scope"]);
const ROAMING_API_METHODS = new Set(["roaming-grass", "roaming-water"]);

// ─── Override Merge ─────────────────────────────────────────────────────
// Reads overrides.json from the repo root and merges it into the built Pokémon
// array. What each remaining category covers, and why PokéAPI can't:
//
//   static_legendaries  — replaces PokéAPI's static rows. PokéAPI has the location
//                         and level but not the unlock requirement, event item or
//                         respawn behaviour, and it lists event-only encounters
//                         (e.g. unreleased tickets) that the override marks unobtainable.
//   roaming_legendaries — replaces PokéAPI's roaming rows; adds the trigger text.
//   gift_pokemon        — gap-fill only: skipped when PokéAPI already has a gift,
//                         fossil or static row for that Pokémon in that game.
//   game_corner_pokemon — gap-fill only, same rule.
//   learnset_corrections — free-text notes; PokéAPI has no equivalent.
//
// Outbreaks, Poké Radar, Slot 2, honey trees, Great Marsh, Trophy Garden and
// fossils used to be overridden with placeholder levels and chances. PokéAPI
// has real ROM-derived data for all of them now, so those overrides are gone.

type PokemonEntry = {
  id: number;
  encounters: {
    version: string;
    locations: {
      locationAreaSlug: string;
      locationDisplayName: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      details: any[];
    }[];
  }[];
  availableInGames: string[];
  hasStaticEncounter: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

function locSlug(loc: string): string {
  return loc
    .replace(/\([^)]*\)/g, "") // strip parentheticals
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// "id|version|slug|method|minLevel|maxLevel" for every row added from overrides.json
const overrideRowKeys = new Set<string>();

function hasEncounter(
  p: PokemonEntry,
  game: string,
  pred: (d: Record<string, unknown>, slug: string) => boolean,
): boolean {
  const enc = p.encounters.find((e) => e.version === game);
  return !!enc && enc.locations.some((l) => l.details.some((d) => pred(d, l.locationAreaSlug)));
}

function addOverrideEncounter(
  p: PokemonEntry,
  game: string,
  slug: string,
  displayName: string,
  detail: Record<string, unknown>,
): void {
  overrideRowKeys.add(`${p.id}|${game}|${slug}|${detail.method}|${detail.minLevel}|${detail.maxLevel}`);
  let enc = p.encounters.find((e) => e.version === game);
  if (!enc) {
    enc = { version: game, locations: [] };
    p.encounters.push(enc);
  }
  const existing = enc.locations.find((l) => l.locationAreaSlug === slug);
  if (existing) {
    const dup = existing.details.some(
      (d: Record<string, unknown>) => d.method === detail.method && d.minLevel === detail.minLevel,
    );
    if (!dup) existing.details.push(detail);
  } else {
    enc.locations.push({ locationAreaSlug: slug, locationDisplayName: displayName, details: [detail] });
  }
  if (!p.availableInGames.includes(game)) p.availableInGames.push(game);
}

function removePokeApiStaticForGame(p: PokemonEntry, game: string): void {
  const enc = p.encounters.find((e) => e.version === game);
  if (!enc) return;
  enc.locations = enc.locations.filter(
    (loc) => !loc.details.some((d: Record<string, unknown>) => d.isStatic || d.method === "unknown"),
  );
  if (enc.locations.length === 0) {
    p.encounters = p.encounters.filter((e) => e !== enc);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyOverrides(pokemon: PokemonEntry[], overrides: Record<string, any>): void {
  const byId = new Map<number, PokemonEntry>();
  for (const p of pokemon) byId.set(p.id, p);
  let count = 0;

  // ── static_legendaries ────────────────────────────────────────────────
  const staticLegs = overrides.static_legendaries as Record<string, unknown[]> | undefined;
  if (staticLegs) {
    for (const [game, entries] of Object.entries(staticLegs)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries as Record<string, unknown>[]) {
        if (!entry.id || entry._remove_this_entry) continue;
        const p = byId.get(entry.id as number);
        if (!p) continue;
        if (entry.method === "unobtainable_in_this_version") {
          p.encounters = p.encounters.filter((e) => e.version !== game);
          p.availableInGames = [...new Set(p.encounters.map((e) => e.version))];
          count++; continue;
        }
        const location = entry.location as string | undefined;
        if (!location || location === "N/A") continue;
        removePokeApiStaticForGame(p, game);
        addOverrideEncounter(p, game, locSlug(location), location, {
          method: "static",
          minLevel: (entry.level as number) ?? 0,
          maxLevel: (entry.level as number) ?? 0,
          chance: 100,
          isStatic: true,
          requirement: entry.requirement,
          eventItem: entry.event_item,
          respawnsAfterEliteFour: entry.respawns_after_elite_four,
        });
        p.hasStaticEncounter = true;
        count++;
      }
    }
  }

  // ── roaming_legendaries ───────────────────────────────────────────────
  const roamers = overrides.roaming_legendaries as Record<string, unknown[]> | undefined;
  if (roamers) {
    for (const [game, entries] of Object.entries(roamers)) {
      if (!Array.isArray(entries)) continue;
      for (const raw of entries as Record<string, unknown>[]) {
        const list: Record<string, unknown>[] =
          Array.isArray(raw.pokemon) ? (raw.pokemon as Record<string, unknown>[]) : [raw];
        for (const entry of list) {
          if (!entry.id || entry._remove_this_entry) continue;
          const p = byId.get(entry.id as number);
          if (!p) continue;
          const region = (entry.roam_region as string) ?? "Region";
          // PokéAPI has bare roaming rows for most roamers; the override carries the
          // trigger text, so it replaces them rather than sitting alongside.
          const enc = p.encounters.find((e) => e.version === game);
          if (enc) {
            enc.locations = enc.locations.filter((l) => !l.details.some((d: Record<string, unknown>) => d.isRoaming));
          }
          addOverrideEncounter(p, game, `roaming-${region.toLowerCase()}`, `Roaming (${region})`, {
            method: "walk",
            minLevel: (entry.level as number) ?? 0,
            maxLevel: (entry.level as number) ?? 0,
            chance: 1,
            isStatic: false,
            requirement: entry.trigger,
            isRoaming: true,
          });
          count++;
        }
      }
    }
  }

  // ── gift_pokemon ──────────────────────────────────────────────────────
  const gifts = overrides.gift_pokemon as Record<string, unknown[]> | undefined;
  if (gifts) {
    for (const [game, entries] of Object.entries(gifts)) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries as Record<string, unknown>[]) {
        if (!entry.id || entry._remove_this_entry) continue;
        const p = byId.get(entry.id as number);
        if (!p) continue;
        const location = (entry.location as string) ?? "Unknown Location";
        if (location === "N/A") continue;
        const method = entry.method === "fossil" ? "fossil" : "gift";
        // Only fill gaps: PokéAPI now has most gifts and all fossil revivals with
        // exact locations and levels (some "gifts" here are static encounters there).
        if (hasEncounter(p, game, (d) => d.method === "gift" || d.method === "fossil" || d.method === "static")) continue;
        addOverrideEncounter(p, game, locSlug(location.split(" (")[0]), location, {
          method,
          minLevel: (entry.level as number) ?? 1,
          maxLevel: (entry.level as number) ?? 1,
          chance: 100,
          isStatic: true,
          requirement: (entry.giver ?? entry.fossil_item) as string | undefined,
        });
        count++;
      }
    }
  }

  // ── game_corner_pokemon ───────────────────────────────────────────────
  const gc = overrides.game_corner_pokemon as Record<string, unknown> | undefined;
  if (gc) {
    const CORNER_GAME_MAP: Record<string, string> = {
      firered_celadon_game_corner: "firered",
      leafgreen_celadon_game_corner: "leafgreen",
    };
    for (const [key, section] of Object.entries(gc)) {
      if (key.startsWith("_")) continue;
      const game = CORNER_GAME_MAP[key];
      if (!game) continue;
      const s = section as Record<string, unknown>;
      const loc = (s._location as string) ?? "Game Corner";
      const entries = (s.pokemon as Record<string, unknown>[]) ?? [];
      for (const entry of entries) {
        if (!entry.id || entry._remove_this_entry) continue;
        const p = byId.get(entry.id as number);
        if (!p) continue;
        // Only fill gaps — PokéAPI lists the FR/LG Game Corner prizes with their coin costs.
        if (hasEncounter(p, game, (d) => d.method === "gift")) continue;
        addOverrideEncounter(p, game, locSlug(loc), loc, {
          method: "gift",
          minLevel: (entry.level as number) ?? 1,
          maxLevel: (entry.level as number) ?? 1,
          chance: 100,
          isStatic: true,
          requirement: entry.cost_coins ? `${entry.cost_coins} coins` : undefined,
        });
        count++;
      }
    }
  }


  // ── learnset_corrections — attach as metadata on relevant Pokémon ────
  const lc = overrides.learnset_corrections as Record<string, unknown> | undefined;
  if (lc?.notable_gen3_learnset_quirks && Array.isArray(lc.notable_gen3_learnset_quirks)) {
    const nameToId: Record<string, number> = {};
    for (const p of pokemon) nameToId[p.displayName?.toLowerCase()] = p.id;
    for (const quirk of lc.notable_gen3_learnset_quirks as Record<string, string>[]) {
      const name = (quirk.pokemon ?? "").split(" ")[0].toLowerCase(); // handle "Poochyena / Lombre"
      const id = nameToId[name];
      if (id !== undefined) {
        const p = byId.get(id);
        if (p) { p.learnsetNote = quirk.note; count++; }
      }
    }
  }

  console.log(`   Applied ${count} override entries`);
}


// ─── Evolution Chain Parser ─────────────────────────────────────────────

interface EvolutionStep {
  speciesId: number;
  speciesName: string;
  displayName: string;
  trigger: string;
  minLevel: number | null;
  item: string | null;
  details: string;
}


// ─── Main Fetch ─────────────────────────────────────────────────────────

async function fetchRegionalDex(dexId: string): Promise<Map<number, number>> {
  const data = await fetchJson(`${POKEAPI_BASE}/pokedex/${dexId}`) as {
    pokemon_entries: { entry_number: number; pokemon_species: { url: string } }[];
  };
  const map = new Map<number, number>();
  for (const entry of data.pokemon_entries) {
    const parts = entry.pokemon_species.url.split("/");
    const nationalId = parseInt(parts[parts.length - 2], 10);
    map.set(nationalId, entry.entry_number);
  }
  return map;
}

async function main() {
  console.log("🔍 Fetching Gen 3 + Gen 4 Pokémon data from PokéAPI...\n");

  // --- Step 0: Encounters from the pinned CSV dump ---
  console.log(`📌 Step 0: Loading encounter CSVs at PokeAPI/pokeapi@${POKEAPI_COMMIT.slice(0, 10)}...`);
  const csvEncounters = await loadEncountersFromCsv(493);
  console.log(`   Encounter rows for ${csvEncounters.size} species\n`);

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // --- Step 1: Fetch regional dex maps ---
  console.log("🗺️  Step 1: Fetching regional dex data...");
  const [hoennDexMap, sinnohDpDexMap, sinnohPtDexMap, johtoHgssDexMap] = await Promise.all([
    fetchRegionalDex("hoenn"),            // RSE Hoenn dex (202 entries, includes Gen 1/2 Pokémon)
    fetchRegionalDex("original-sinnoh"), // Diamond/Pearl Sinnoh dex (151 entries)
    fetchRegionalDex("extended-sinnoh"), // Platinum Sinnoh dex (210 entries)
    fetchRegionalDex("updated-johto"),   // HGSS Johto dex
  ]);
  console.log(`   Hoenn: ${hoennDexMap.size}, Sinnoh DP: ${sinnohDpDexMap.size}, Sinnoh Pt: ${sinnohPtDexMap.size}, Johto HGSS: ${johtoHgssDexMap.size} entries\n`);

  // --- Step 2: Fetch all 493 pokemon base data ---
  console.log("📋 Step 2: Fetching Pokémon list...");
  const listRes = await fetchJson(`${POKEAPI_BASE}/pokemon?limit=493&offset=0`) as { results: { name: string; url: string }[] };
  const pokemonList = listRes.results;
  console.log(`   Found ${pokemonList.length} Pokémon\n`);

  // --- Step 3: Fetch individual pokemon data in batches ---
  console.log("📦 Step 3: Fetching individual Pokémon data (this takes ~10 min)...");

  const evolutionChainIds = new Set<number>();
  const allPokemonData: ReturnType<typeof buildPokemonEntry>[] = [];

  for (let i = 0; i < pokemonList.length; i += BATCH_SIZE) {
    const batch = pokemonList.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(pokemonList.length / BATCH_SIZE);
    process.stdout.write(`   Batch ${batchNum}/${totalBatches} (#${i + 1}–#${Math.min(i + BATCH_SIZE, pokemonList.length)})... `);

    const results = await Promise.allSettled(
      batch.map(async (entry) => {
        const urlParts = entry.url.split("/");
        const id = parseInt(urlParts[urlParts.length - 2], 10);

        // Species, stats and sprites still come from the live API; only encounters are pinned.
        const [pokemon, species] = await Promise.all([
          fetchJson(`${POKEAPI_BASE}/pokemon/${id}`) as Promise<PokemonRaw>,
          fetchJson(`${POKEAPI_BASE}/pokemon-species/${id}`) as Promise<SpeciesRaw>,
        ]);
        const encounters = csvEncounters.get(id) ?? [];

        const evoChainUrlParts = species.evolution_chain.url.split("/");
        const evoChainId = parseInt(evoChainUrlParts[evoChainUrlParts.length - 2], 10);
        evolutionChainIds.add(evoChainId);

        return { id, pokemon, species, encounters, evoChainId };
      })
    );

    let successCount = 0;
    for (const result of results) {
      if (result.status === "fulfilled") {
        allPokemonData.push(result.value);
        successCount++;
      } else {
        console.error(`\n   Error: ${result.reason}`);
      }
    }
    console.log(`✓ (${successCount}/${batch.length})`);

    if (i + BATCH_SIZE < pokemonList.length) {
      await delay(FETCH_DELAY_MS);
    }
  }

  console.log(`\n   Fetched ${allPokemonData.length} Pokémon\n`);

  // --- Step 4: Fetch evolution chains ---
  console.log(`🔗 Step 4: Fetching ${evolutionChainIds.size} evolution chains...`);
  const evoChainMap = new Map<number, RawEvolutionChainLink>();

  const chainIdArr = Array.from(evolutionChainIds);
  for (let i = 0; i < chainIdArr.length; i += BATCH_SIZE) {
    const batch = chainIdArr.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (chainId) => {
        const data = await fetchJson(`${POKEAPI_BASE}/evolution-chain/${chainId}`) as { chain: RawEvolutionChainLink };
        evoChainMap.set(chainId, data.chain);
      })
    );
    if (i + BATCH_SIZE < chainIdArr.length) {
      await delay(FETCH_DELAY_MS);
    }
  }
  console.log("   Done\n");

  // --- Step 5: Build species ID -> evolution steps map ---
  console.log("⚙️  Step 5: Building evolution maps...");

  // speciesId -> list of EvolutionStep (what it evolves into)
  const evolvesToMap = new Map<number, EvolutionStep[]>();
  // speciesId -> parent species ID
  const evolvesFromMap = new Map<number, number>();
  // speciesId -> chainId
  const speciesChainMap = new Map<number, number>();

  function walkChain(link: RawEvolutionChainLink, chainId: number, parentId: number | null) {
    const urlParts = link.species.url.split("/");
    const speciesId = parseInt(urlParts[urlParts.length - 2], 10);
    speciesChainMap.set(speciesId, chainId);

    if (parentId !== null) {
      evolvesFromMap.set(speciesId, parentId);
    }

    const stepsForThisLink: EvolutionStep[] = link.evolves_to.map((child) => {
      const childParts = child.species.url.split("/");
      const childId = parseInt(childParts[childParts.length - 2], 10);

      const evo = child.evolution_details[0];
      let trigger: string = "other";
      let minLevel: number | null = null;
      let item: string | null = null;
      let details = "Unknown";

      if (evo) {
        trigger = evo.trigger?.name ?? "other";
        if (trigger === "level-up" && evo.min_level) {
          minLevel = evo.min_level;
          details = `Level ${evo.min_level}`;
        } else if (trigger === "use-item" && evo.item) {
          item = evo.item.name;
          details = capitalizeWords(evo.item.name);
        } else if (trigger === "trade") {
          details = "Trade";
        } else if (trigger === "level-up") {
          details = "Level up";
        } else {
          details = capitalizeWords(trigger ?? "unknown");
        }
      }

      return {
        speciesId: childId,
        speciesName: child.species.name,
        displayName: capitalizeWords(child.species.name),
        trigger: trigger === "level-up" ? "level-up"
          : trigger === "use-item" ? "use-item"
          : trigger === "trade" ? "trade"
          : "other",
        minLevel,
        item,
        details,
      } as EvolutionStep;
    });

    if (stepsForThisLink.length > 0) {
      evolvesToMap.set(speciesId, stepsForThisLink);
    }

    for (const child of link.evolves_to) {
      walkChain(child, chainId, speciesId);
    }
  }

  for (const [chainId, chain] of evoChainMap) {
    walkChain(chain, chainId, null);
  }
  console.log("   Done\n");

  // --- Step 6: Build final pokemon objects ---
  console.log("🏗️  Step 6: Building final data objects...");

  // Sort by ID
  allPokemonData.sort((a, b) => a.id - b.id);

  const pokemon = allPokemonData.map((entry) => buildPokemonEntry(
    entry,
    evolvesToMap,
    evolvesFromMap,
    speciesChainMap,
    hoennDexMap,
    sinnohDpDexMap,
    sinnohPtDexMap,
    johtoHgssDexMap,
  ));

  // --- Step 6.5: Apply overrides.json patches ---
  console.log("🔧 Step 6.5: Applying overrides.json...");
  const overridesPath = path.join(__dirname, "../overrides.json");
  if (fs.existsSync(overridesPath)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overrides = JSON.parse(fs.readFileSync(overridesPath, "utf8")) as Record<string, any>;
    applyOverrides(pokemon as PokemonEntry[], overrides);
  } else {
    console.log("   overrides.json not found — skipping (run won't corrupt data)");
  }
  console.log("");

  // --- Step 6.6: Strip known-bad data ---
  // Runs after overrides so an override can never re-add something denied here.
  console.log("🧹 Step 6.6: Sanitizing encounters...");
  sanitizeEncounters(pokemon as PokemonEntry[]);
  console.log("");

  // --- Step 7: Build box layout ---
  const boxes = buildBoxLayout(pokemon);

  // --- Step 8: Build meta ---
  const generatedAt = new Date().toISOString();
  const meta = {
    generatedAt,
    dataSource: { pokeapiCommit: POKEAPI_COMMIT, generatedAt },
    totalPokemon: pokemon.length,
    activeGenerations: GENERATION_META.map((g) => g.id),
    generations: GENERATION_META,
    regionalDexes: REGIONAL_DEXES,
  };

  // --- Step 9: Write files ---
  console.log("💾 Step 9: Writing JSON files...");

  fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_DATA_DIR, "pokemon.json"), JSON.stringify(pokemon, null, 2));
  console.log(`   ✓ public/data/pokemon.json (${pokemon.length} entries)`);

  fs.writeFileSync(path.join(DATA_DIR, "boxes.json"), JSON.stringify(boxes, null, 2));
  console.log(`   ✓ boxes.json (${boxes.length} boxes)`);

  fs.writeFileSync(path.join(DATA_DIR, "meta.json"), JSON.stringify(meta, null, 2));
  console.log("   ✓ meta.json");

  fs.writeFileSync(PROVENANCE_PATH, JSON.stringify({ overrideRows: [...overrideRowKeys].sort() }, null, 2) + "\n");
  console.log(`   ✓ scripts/data/override-provenance.json (${overrideRowKeys.size} override rows)`);

  console.log("\n✅ Data generation complete!");
  console.log(`   ${pokemon.length} Pokémon processed`);
  console.log(`   ${boxes.length} PC boxes`);

  // Print some stats
  const withEncounters = pokemon.filter((p) => p.encounters.length > 0).length;
  const legendaries = pokemon.filter((p) => p.isLegendary || p.isMythical).length;
  console.log(`   ${withEncounters} Pokémon have encounter data`);
  console.log(`   ${legendaries} legendaries/mythicals`);
}

// ─── Pokemon Entry Builder ──────────────────────────────────────────────

interface PokemonRaw {
  id: number;
  name: string;
  types: { type: { name: string } }[];
  stats: { base_stat: number; effort: number; stat: { name: string } }[];
  abilities: { ability: { name: string }; is_hidden: boolean }[];
  sprites: {
    front_default: string | null;
    versions: {
      "generation-iii"?: {
        "firered-leafgreen"?: { front_default: string | null };
        "ruby-sapphire"?: { front_default: string | null };
      };
      "generation-iv"?: {
        "diamond-pearl"?: { front_default: string | null };
        "heartgold-soulsilver"?: { front_default: string | null };
        "platinum"?: { front_default: string | null };
      };
    };
  };
}

interface SpeciesRaw {
  id: number;
  name: string;
  names: { name: string; language: { name: string } }[];
  is_legendary: boolean;
  is_mythical: boolean;
  is_baby: boolean;
  capture_rate: number;
  evolution_chain: { url: string };
  pokedex_numbers: { entry_number: number; pokedex: { name: string } }[];
}

function buildPokemonEntry(
  entry: {
    id: number;
    pokemon: PokemonRaw;
    species: SpeciesRaw;
    encounters: RawEncounterEntry[];
    evoChainId: number;
  },
  evolvesToMap: Map<number, EvolutionStep[]>,
  evolvesFromMap: Map<number, number>,
  speciesChainMap: Map<number, number>,
  hoennDexMap: Map<number, number>,
  sinnohDpDexMap: Map<number, number>,
  sinnohPtDexMap: Map<number, number>,
  johtoHgssDexMap: Map<number, number>,
) {
  const { id, pokemon, species, encounters, evoChainId } = entry;

  // Display name (English)
  const englishName = species.names.find((n) => n.language.name === "en")?.name
    ?? capitalizeWords(pokemon.name);

  // Types
  const types = pokemon.types.map((t) => t.type.name);

  // Sprite URLs
  const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;

  const gen3Sprite =
    pokemon.sprites.versions?.["generation-iii"]?.["firered-leafgreen"]?.front_default
    ?? pokemon.sprites.versions?.["generation-iii"]?.["ruby-sapphire"]?.front_default
    ?? null;

  // Use HGSS sprites as the primary Gen 4 sprite (highest quality), fall back to D/P
  const gen4Sprite =
    pokemon.sprites.versions?.["generation-iv"]?.["heartgold-soulsilver"]?.front_default
    ?? pokemon.sprites.versions?.["generation-iv"]?.["diamond-pearl"]?.front_default
    ?? null;

  // Encounters, filtered to the supported versions. The denylist and Altering Cave
  // clean-up run later in sanitizeEncounters(), after overrides are merged.
  const allEncounters = normalizeEncounters(encounters);

  // Available in games
  const availableInGames = [...new Set(allEncounters.map((e) => e.version))];

  // Has static encounter
  const hasStaticEncounter =
    species.is_legendary ||
    species.is_mythical ||
    allEncounters.some((e) =>
      e.locations.some((l) =>
        l.details.some((d) => d.isStatic)
      )
    );

  // Abilities
  const abilities = pokemon.abilities.map((a) => ({
    name: a.ability.name,
    displayName: a.ability.name
      .split("-")
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" "),
    isHidden: a.is_hidden,
  }));

  // Base stats and EV yields (PokéAPI provides both in the same stats array)
  const statLookup = (name: string, field: "base_stat" | "effort") =>
    pokemon.stats.find((s) => s.stat.name === name)?.[field] ?? 0;
  const baseStats = {
    hp:    statLookup("hp", "base_stat"),
    atk:   statLookup("attack", "base_stat"),
    def:   statLookup("defense", "base_stat"),
    spAtk: statLookup("special-attack", "base_stat"),
    spDef: statLookup("special-defense", "base_stat"),
    spe:   statLookup("speed", "base_stat"),
  };
  const evYield = {
    hp:    statLookup("hp", "effort"),
    atk:   statLookup("attack", "effort"),
    def:   statLookup("defense", "effort"),
    spAtk: statLookup("special-attack", "effort"),
    spDef: statLookup("special-defense", "effort"),
    spe:   statLookup("speed", "effort"),
  };

  // Evolution
  const evolvesFrom = evolvesFromMap.get(id) ?? null;
  const evolvesTo = evolvesToMap.get(id) ?? [];

  // Regional dex entries
  const regionalDexEntries = buildRegionalDexEntries(id, species, hoennDexMap, sinnohDpDexMap, sinnohPtDexMap, johtoHgssDexMap);

  return {
    id,
    name: pokemon.name,
    displayName: englishName,
    types,
    spriteUrl,
    gen3Sprite,
    gen4Sprite,
    isLegendary: species.is_legendary,
    isMythical: species.is_mythical,
    isBaby: species.is_baby,
    catchRate: species.capture_rate,
    abilities,
    baseStats,
    evYield,
    evolutionChainId: evoChainId,
    evolvesFrom,
    evolvesTo,
    encounters: allEncounters,
    availableInGames,
    hasStaticEncounter,
    regionalDexEntries,
  };
}


/**
 * Encounters that are confirmed wrong (verified against Bulbapedia) and must never
 * ship, whatever the source. Applied after overrides are merged.
 *
 * Currently empty: the Bulbasaur/Charmander/Squirtle D/P/Pt swarms and the Linoone
 * Route 202 entry that used to be listed here no longer exist in PokéAPI, and the
 * override that re-added them is gone. validate-data.ts guards the starters.
 * An entry that matches nothing logs a warning so stale entries get noticed.
 */
const ENCOUNTER_DENYLIST: Record<number, { versions: string[] }> = {};

/**
 * Altering Cave uses Wonder Spot events that were never distributed outside Japan.
 * Only Zubat (#41) is permanently available there (the default ROM encounter).
 * All other Pokémon listed by PokéAPI exist in ROM data but are unreachable —
 * strip their altering-cave locations so they don't show as obtainable in-game.
 */
const ALTERING_CAVE_SLUG = /altering-cave/;
const ALTERING_CAVE_DEFAULT_ID = 41; // Zubat

function sanitizeEncounters(pokemon: PokemonEntry[]): void {
  let removedLocations = 0;
  for (const p of pokemon) {
    const deny = ENCOUNTER_DENYLIST[p.id];
    if (deny) {
      const before = p.encounters.length;
      p.encounters = p.encounters.filter((enc) => !deny.versions.includes(enc.version));
      if (p.encounters.length === before) {
        console.warn(`   ⚠ ENCOUNTER_DENYLIST entry #${p.id} (${deny.versions.join(", ")}) matched nothing — remove it`);
      }
    }
    if (p.id !== ALTERING_CAVE_DEFAULT_ID) {
      for (const enc of p.encounters) {
        const before = enc.locations.length;
        enc.locations = enc.locations.filter((loc) => !ALTERING_CAVE_SLUG.test(loc.locationAreaSlug));
        removedLocations += before - enc.locations.length;
      }
    }
    p.encounters = p.encounters.filter((enc) => enc.locations.length > 0);
    p.availableInGames = [...new Set(p.encounters.map((e) => e.version))];
  }
  console.log(`   Removed ${removedLocations} Altering Cave locations`);
}

// Several Gen 4 encounter types come from PokéAPI as method="walk" (or a rod) but
// carry a condition value that encodes the true encounter type. These conditions
// take priority over the raw method name.
const CONDITION_TO_METHOD: Record<string, string> = {
  "slot2-ruby":      "slot2-ruby",
  "slot2-sapphire":  "slot2-sapphire",
  "slot2-emerald":   "slot2-emerald",
  "slot2-firered":   "slot2-firered",
  "slot2-leafgreen": "slot2-leafgreen",
  "radar-on":        "poke-radar",
  "swarm-yes":       "swarm",
  "radio-hoenn":     "radio",
  "radio-sinnoh":    "radio",
};

const TIME_CONDITIONS: Record<string, "morning" | "day" | "night"> = {
  "time-morning": "morning",
  "time-day":     "day",
  "time-night":   "night",
};

// The Great Marsh daily (binoculars) pool. PokéAPI repeats each daily Pokémon in all
// six areas; the app shows the pool as one "great-marsh" location with method "safari".
const GREAT_MARSH_DAILY_SLUG = "great-marsh";
// PokéAPI attaches honey-tree rows to each of the 21 tree routes. The app treats
// honey trees as a single location.
const HONEY_TREE_SLUG = "honey-tree";

// PokéAPI lists every fossil as revivable in every game that has the museum, but
// not every game can obtain every fossil item. Fossils not listed here are
// available in all games that PokéAPI lists them for.
const FOSSIL_ITEM_VERSIONS: Record<string, string[]> = {
  "item-skull-fossil": ["diamond", "platinum", "heartgold"],
  "item-armor-fossil": ["pearl", "platinum", "soulsilver"],
};

function conditionLabel(name: string): string {
  return name.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

interface NormalizedDetail {
  method: string;
  minLevel: number;
  maxLevel: number;
  chance: number;
  isStatic: boolean;
  timeOfDay?: "morning" | "day" | "night";
  requirement?: string;
  isRoaming?: boolean;
}

function normalizeEncounters(rawEncounters: RawEncounterEntry[]) {
  const allVersionNames: readonly string[] = ALL_VERSION_NAMES;
  // version → slug → details
  const byVersion = new Map<string, Map<string, NormalizedDetail[]>>();
  // version → area → summed daily-pool chance, used to collapse the Great Marsh pool
  const marshChance = new Map<string, Map<string, number>>();

  const push = (version: string, slug: string, detail: NormalizedDetail) => {
    let locMap = byVersion.get(version);
    if (!locMap) byVersion.set(version, (locMap = new Map()));
    let list = locMap.get(slug);
    if (!list) locMap.set(slug, (list = []));
    list.push(detail);
  };

  for (const enc of rawEncounters) {
    const area = enc.location_area.name;
    for (const vd of enc.version_details) {
      const version = vd.version.name;
      if (!allVersionNames.includes(version)) continue;

      for (const d of vd.encounter_details) {
        const conds = d.condition_values.map((cv) => cv.name);
        const apiMethod = d.method.name;

        const fossilItem = conds.find((c) => c in FOSSIL_ITEM_VERSIONS);
        if (fossilItem && !FOSSIL_ITEM_VERSIONS[fossilItem].includes(version)) continue;

        const overrideCond = conds.find((c) => c in CONDITION_TO_METHOD);
        const timeCond = conds.find((c) => c in TIME_CONDITIONS);
        const isFossil = apiMethod === "gift" && conds.some((c) => /^item-.*(fossil|amber)$/.test(c));
        const tradeCond = conds.find((c) => c.startsWith("trade-"));
        const coinsCond = conds.find((c) => c.startsWith("coins-"));
        const isMarshDaily = conds.some((c) => /^great-marsh-daily-slot-\d/.test(c));
        const isMunchlaxTree = conds.includes("honey-tree-group-c");

        let slug = area;
        let method = overrideCond ? CONDITION_TO_METHOD[overrideCond] : mapEncounterMethod(apiMethod);
        let requirement: string | undefined;

        if (isFossil) {
          method = "fossil";
        } else if (apiMethod === "npc-trade") {
          if (tradeCond === "trade-any-pokemon") requirement = "Trade any Pokémon";
          else if (tradeCond) requirement = `Trade ${conditionLabel(tradeCond.replace(/^trade-/, ""))}`;
        } else if (coinsCond) {
          requirement = `${coinsCond.replace("coins-", "")} coins`;
        } else if (apiMethod === "honey-tree") {
          slug = HONEY_TREE_SLUG;
          if (isMunchlaxTree) requirement = "Only on your save file's four Munchlax trees";
        } else if (isMarshDaily) {
          slug = GREAT_MARSH_DAILY_SLUG;
          method = "safari";
          let perArea = marshChance.get(version);
          if (!perArea) marshChance.set(version, (perArea = new Map()));
          perArea.set(area, (perArea.get(area) ?? 0) + d.chance);
        } else if (conds.includes("backlot-mentioned")) {
          requirement = "One of Mr. Backlot's daily Pokémon (National Pokédex)";
        }

        push(version, slug, {
          method,
          minLevel: d.min_level,
          maxLevel: d.max_level,
          // PokéAPI's 100% for a Munchlax tree is "of the Munchlax slot"; the real rate is about 1%.
          chance: isMunchlaxTree ? 1 : d.chance,
          isStatic: STATIC_API_METHODS.has(apiMethod),
          ...(timeCond ? { timeOfDay: TIME_CONDITIONS[timeCond] } : {}),
          ...(requirement ? { requirement } : {}),
          ...(ROAMING_API_METHODS.has(apiMethod) ? { isRoaming: true } : {}),
        });
      }
    }
  }

  const result = [];
  for (const [version, locMap] of byVersion) {
    const locations = [];
    for (const [slug, details] of locMap) {
      let finalDetails = details;
      if (slug === GREAT_MARSH_DAILY_SLUG) {
        // One row for the whole pool: full level range, and the chance of meeting it
        // in a single area on a day it is in rotation.
        finalDetails = [{
          method: "safari",
          minLevel: Math.min(...details.map((d) => d.minLevel)),
          maxLevel: Math.max(...details.map((d) => d.maxLevel)),
          chance: Math.max(0, ...(marshChance.get(version)?.values() ?? [])),
          isStatic: false,
        }];
      } else if (slug === HONEY_TREE_SLUG) {
        // The same rows repeat for each of the 21 trees — keep one copy.
        const seen = new Set<string>();
        finalDetails = details.filter((d) => {
          const key = JSON.stringify(d);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      locations.push({
        locationAreaSlug: slug,
        locationDisplayName: slug === HONEY_TREE_SLUG ? "Honey Tree" : formatLocationSlug(slug),
        details: finalDetails,
      });
    }
    result.push({ version, locations });
  }

  return result;
}

function buildRegionalDexEntries(
  id: number,
  species: SpeciesRaw,
  hoennDexMap: Map<number, number>,
  sinnohDpDexMap: Map<number, number>,
  sinnohPtDexMap: Map<number, number>,
  johtoHgssDexMap: Map<number, number>,
) {
  const entries = [];

  // Check Hoenn Dex (RSE local dex, 202 entries — fetched from PokéAPI /pokedex/hoenn)
  const hoennNum = hoennDexMap.get(id);
  if (hoennNum !== undefined) {
    entries.push({
      dexId: "hoenn",
      dexName: "RSE Pokédex",
      regionalNumber: hoennNum,
    });
  }

  // Check Kanto Dex (Gen 1 Pokémon get a Kanto entry for FR/LG)
  if (id >= 1 && id <= 151) {
    entries.push({
      dexId: "kanto",
      dexName: "FRLG Pokédex",
      regionalNumber: id,
    });
  }

  // Check Diamond/Pearl Sinnoh dex (original-sinnoh, 151 entries)
  const sinnohDpNum = sinnohDpDexMap.get(id);
  if (sinnohDpNum !== undefined) {
    entries.push({
      dexId: "sinnoh-dp",
      dexName: "DP Pokédex",
      regionalNumber: sinnohDpNum,
    });
  }

  // Check Platinum Sinnoh dex (extended-sinnoh, 210 entries)
  const sinnohPtNum = sinnohPtDexMap.get(id);
  if (sinnohPtNum !== undefined) {
    entries.push({
      dexId: "sinnoh-pt",
      dexName: "Platinum Pokédex",
      regionalNumber: sinnohPtNum,
    });
  }

  // Check Johto HGSS Dex
  const johtoHgssNum = johtoHgssDexMap.get(id);
  if (johtoHgssNum !== undefined) {
    entries.push({
      dexId: "johto-hgss",
      dexName: "HGSS Pokédex",
      regionalNumber: johtoHgssNum,
    });
  }

  // Suppress unused variable warning
  void species;

  return entries;
}

function buildBoxLayout(pokemon: ReturnType<typeof buildPokemonEntry>[]) {
  const BOX_SIZE = 30;
  const boxes = [];
  for (let i = 0; i < pokemon.length; i += BOX_SIZE) {
    const slice = pokemon.slice(i, i + BOX_SIZE);
    const boxNum = Math.floor(i / BOX_SIZE) + 1;
    const firstId = slice[0].id;
    const lastId = slice[slice.length - 1].id;
    boxes.push({
      boxNumber: boxNum,
      label: `Box ${boxNum} (#${String(firstId).padStart(3, "0")}–#${String(lastId).padStart(3, "0")})`,
      pokemonIds: slice.map((p) => p.id),
    });
  }
  return boxes;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
