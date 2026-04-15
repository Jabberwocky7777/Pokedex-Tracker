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
} from "./constants.js";
import { formatLocationSlug } from "../src/lib/format-location.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "../src/data");
const PUBLIC_DATA_DIR = path.join(__dirname, "../public/data");

// ─── Types ─────────────────────────────────────────────────────────────

interface RawEncounterDetail {
  method: { name: string };
  min_level: number;
  max_level: number;
  chance: number;
  condition_values: { name: string }[];
}

interface RawVersionDetail {
  version: { name: string };
  max_chance: number;
  encounter_details: RawEncounterDetail[];
}

interface RawEncounterEntry {
  location_area: { name: string; url: string };
  version_details: RawVersionDetail[];
}

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
    "land": "walk",
    "grass": "walk",
    // Water
    "surf": "surf",
    // Fishing
    "old-rod": "old-rod",
    "good-rod": "good-rod",
    "super-rod": "super-rod",
    // Special Gen 3
    "rock-smash": "rock-smash",
    "gift": "gift",
    "only-one": "static",
    "roaming-grassland": "walk",
    "headbutt": "headbutt",
    "headbutt-low": "headbutt",
    "headbutt-normal": "headbutt",
    "headbutt-high": "headbutt",
    "rock-climb": "rock-climb",
    // Gen 4 specific
    "pokeradar": "poke-radar",
    "pokeradar-developed": "poke-radar",
    "swarm": "swarm",
    "mass-outbreak": "swarm",
    "great-marsh": "safari",
    "great-marsh-developed": "safari",
    // Dual-slot (Slot 2) encounters — these arrive as condition_values, not method names,
    // so they are pre-resolved in normalizeEncounters before reaching this function.
    "slot2": "slot2",
    "slot2-ruby":      "slot2-ruby",
    "slot2-sapphire":  "slot2-sapphire",
    "slot2-emerald":   "slot2-emerald",
    "slot2-firered":   "slot2-firered",
    "slot2-leafgreen": "slot2-leafgreen",
    "radio": "radio",
    "radio-johto": "radio",
    "radio-hoenn": "radio",
    "honey-tree": "honey-tree",
    "fossil": "fossil",
  };
  return map[apiMethod] ?? "unknown";
}

// ─── Manual Encounter Data ───────────────────────────────────────────────
// PokéAPI is missing encounter data for some Gen 4 mechanics.
// These entries are injected after normalizing PokéAPI data.

interface ManualEncounterSpec {
  versions: string[];
  locationAreaSlug: string;
  locationDisplayName: string;
  method: string;
  minLevel: number;
  maxLevel: number;
  chance: number;
  isStatic?: boolean;
}

const MANUAL_ENCOUNTERS: Record<number, ManualEncounterSpec[]> = {
  // ─── Honey Tree Pokémon (Diamond, Pearl, Platinum) ────────────────────
  // PokéAPI has no Gen 4 encounter data for these species.
  // All 21 honey trees are counted as one "location" for display purposes.
  265: [{ versions: ["diamond","pearl","platinum"], locationAreaSlug:"honey-tree", locationDisplayName:"Honey Tree", method:"honey-tree", minLevel:5, maxLevel:15, chance:40 }], // Wurmple
  266: [{ versions: ["diamond","platinum"], locationAreaSlug:"honey-tree", locationDisplayName:"Honey Tree", method:"honey-tree", minLevel:5, maxLevel:15, chance:25 }], // Silcoon (D/Pt)
  268: [{ versions: ["pearl","platinum"], locationAreaSlug:"honey-tree", locationDisplayName:"Honey Tree", method:"honey-tree", minLevel:5, maxLevel:15, chance:25 }], // Cascoon (P/Pt)
  190: [{ versions: ["diamond","pearl","platinum"], locationAreaSlug:"honey-tree", locationDisplayName:"Honey Tree", method:"honey-tree", minLevel:5, maxLevel:15, chance:10 }], // Aipom
  214: [{ versions: ["diamond","pearl","platinum"], locationAreaSlug:"honey-tree", locationDisplayName:"Honey Tree", method:"honey-tree", minLevel:5, maxLevel:15, chance:5 }], // Heracross
  412: [{ versions: ["diamond","pearl","platinum"], locationAreaSlug:"honey-tree", locationDisplayName:"Honey Tree", method:"honey-tree", minLevel:5, maxLevel:15, chance:20 }], // Burmy
  415: [{ versions: ["diamond","pearl","platinum"], locationAreaSlug:"honey-tree", locationDisplayName:"Honey Tree", method:"honey-tree", minLevel:5, maxLevel:15, chance:20 }], // Combee
  420: [{ versions: ["diamond","pearl","platinum"], locationAreaSlug:"honey-tree", locationDisplayName:"Honey Tree", method:"honey-tree", minLevel:5, maxLevel:15, chance:20 }], // Cherubi
  446: [{ versions: ["diamond","pearl","platinum"], locationAreaSlug:"honey-tree", locationDisplayName:"Honey Tree", method:"honey-tree", minLevel:5, maxLevel:5, chance:1 }], // Munchlax

  // ─── Fossil Revival — Gen 4 ───────────────────────────────────────────
  // PokéAPI has no DPP/HGSS fossil revival data.
  // DPP: fossils found in the Underground, revived at Oreburgh Museum.
  // HGSS: fossils obtained in-game, revived at the Pewter Museum.
  138: [ // Omanyte
    { versions: ["diamond","pearl","platinum"], locationAreaSlug:"oreburgh-city-museum", locationDisplayName:"Oreburgh Museum", method:"fossil", minLevel:30, maxLevel:30, chance:100 },
    { versions: ["heartgold","soulsilver"], locationAreaSlug:"pewter-city-museum", locationDisplayName:"Pewter Museum", method:"fossil", minLevel:30, maxLevel:30, chance:100 },
  ],
  140: [ // Kabuto
    { versions: ["diamond","pearl","platinum"], locationAreaSlug:"oreburgh-city-museum", locationDisplayName:"Oreburgh Museum", method:"fossil", minLevel:30, maxLevel:30, chance:100 },
    { versions: ["heartgold","soulsilver"], locationAreaSlug:"pewter-city-museum", locationDisplayName:"Pewter Museum", method:"fossil", minLevel:30, maxLevel:30, chance:100 },
  ],
  142: [ // Aerodactyl
    { versions: ["diamond","pearl","platinum"], locationAreaSlug:"oreburgh-city-museum", locationDisplayName:"Oreburgh Museum", method:"fossil", minLevel:20, maxLevel:20, chance:100 },
    { versions: ["heartgold","soulsilver"], locationAreaSlug:"pewter-city-museum", locationDisplayName:"Pewter Museum", method:"fossil", minLevel:20, maxLevel:20, chance:100 },
  ],
  345: [ // Lileep
    { versions: ["diamond","pearl","platinum"], locationAreaSlug:"oreburgh-city-museum", locationDisplayName:"Oreburgh Museum", method:"fossil", minLevel:20, maxLevel:20, chance:100 },
    { versions: ["heartgold","soulsilver"], locationAreaSlug:"pewter-city-museum", locationDisplayName:"Pewter Museum", method:"fossil", minLevel:20, maxLevel:20, chance:100 },
  ],
  347: [ // Anorith
    { versions: ["diamond","pearl","platinum"], locationAreaSlug:"oreburgh-city-museum", locationDisplayName:"Oreburgh Museum", method:"fossil", minLevel:20, maxLevel:20, chance:100 },
    { versions: ["heartgold","soulsilver"], locationAreaSlug:"pewter-city-museum", locationDisplayName:"Pewter Museum", method:"fossil", minLevel:20, maxLevel:20, chance:100 },
  ],
  408: [ // Cranidos: Diamond/Platinum + HeartGold (Skull Fossil)
    { versions: ["diamond","platinum"], locationAreaSlug:"oreburgh-city-museum", locationDisplayName:"Oreburgh Museum", method:"fossil", minLevel:20, maxLevel:20, chance:100 },
    { versions: ["heartgold"], locationAreaSlug:"pewter-city-museum", locationDisplayName:"Pewter Museum", method:"fossil", minLevel:20, maxLevel:20, chance:100 },
  ],
  410: [ // Shieldon: Pearl/Platinum + SoulSilver (Armor Fossil)
    { versions: ["pearl","platinum"], locationAreaSlug:"oreburgh-city-museum", locationDisplayName:"Oreburgh Museum", method:"fossil", minLevel:20, maxLevel:20, chance:100 },
    { versions: ["soulsilver"], locationAreaSlug:"pewter-city-museum", locationDisplayName:"Pewter Museum", method:"fossil", minLevel:20, maxLevel:20, chance:100 },
  ],

  // ─── Great Marsh Daily Rotation Pokémon (Diamond, Pearl, Platinum) ──────
  // PokéAPI is missing encounter data for Great Marsh daily rotation species.
  // Carnivine is a Great Marsh exclusive; Yanma is Diamond-only daily;
  // Tropius is Pearl-only daily. Skorupi is Platinum Great Marsh.
  455: [ // Carnivine — Great Marsh exclusive; not in PokéAPI for any Sinnoh game
    { versions: ["diamond","pearl","platinum"], locationAreaSlug:"great-marsh", locationDisplayName:"Great Marsh", method:"safari", minLevel:22, maxLevel:30, chance:5 },
  ],
  193: [ // Yanma — Diamond-only daily rotation (Platinum data exists in PokéAPI)
    { versions: ["diamond"], locationAreaSlug:"great-marsh", locationDisplayName:"Great Marsh", method:"safari", minLevel:22, maxLevel:30, chance:10 },
  ],
  357: [ // Tropius — Pearl-only daily rotation (Platinum data exists in PokéAPI)
    { versions: ["pearl"], locationAreaSlug:"great-marsh", locationDisplayName:"Great Marsh", method:"safari", minLevel:22, maxLevel:30, chance:10 },
  ],
  451: [ // Skorupi — Platinum Great Marsh daily rotation (not in PokéAPI)
    { versions: ["platinum"], locationAreaSlug:"great-marsh", locationDisplayName:"Great Marsh", method:"safari", minLevel:22, maxLevel:30, chance:10 },
  ],
};

function injectManualEncounters(
  pokemonId: number,
  existingEncounters: ReturnType<typeof normalizeEncounters>
): ReturnType<typeof normalizeEncounters> {
  const specs = MANUAL_ENCOUNTERS[pokemonId];
  if (!specs) return existingEncounters;

  // Index existing encounters by version for quick lookup
  const byVersion = new Map<string, typeof existingEncounters[0]>();
  for (const enc of existingEncounters) {
    byVersion.set(enc.version, enc);
  }

  for (const spec of specs) {
    const detail = {
      method: spec.method,
      minLevel: spec.minLevel,
      maxLevel: spec.maxLevel,
      chance: spec.chance,
      isStatic: spec.isStatic ?? false,
    };
    const location = {
      locationAreaSlug: spec.locationAreaSlug,
      locationDisplayName: spec.locationDisplayName,
      details: [detail],
    };

    for (const version of spec.versions) {
      if (byVersion.has(version)) {
        const enc = byVersion.get(version)!;
        const existingLoc = enc.locations.find((l) => l.locationAreaSlug === spec.locationAreaSlug);
        if (existingLoc) {
          existingLoc.details.push(detail);
        } else {
          enc.locations.push(location);
        }
      } else {
        byVersion.set(version, { version, locations: [location] });
      }
    }
  }

  return Array.from(byVersion.values());
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

        const [pokemon, species, encounters] = await Promise.all([
          fetchJson(`${POKEAPI_BASE}/pokemon/${id}`) as Promise<PokemonRaw>,
          fetchJson(`${POKEAPI_BASE}/pokemon-species/${id}`) as Promise<SpeciesRaw>,
          fetchJson(`${POKEAPI_BASE}/pokemon/${id}/encounters`) as Promise<RawEncounterEntry[]>,
        ]);

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

  // --- Step 7: Build box layout ---
  const boxes = buildBoxLayout(pokemon);

  // --- Step 8: Build meta ---
  const meta = {
    generatedAt: new Date().toISOString(),
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
  stats: { base_stat: number; stat: { name: string } }[];
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

  // Encounters - filter to all supported versions, inject manual data, then strip unreachable event locations
  const allEncounters = sanitizeAlteringCave(id, injectManualEncounters(id, normalizeEncounters(encounters)));

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

  // Base stats
  const statLookup = (name: string) =>
    pokemon.stats.find((s) => s.stat.name === name)?.base_stat ?? 0;
  const baseStats = {
    hp:    statLookup("hp"),
    atk:   statLookup("attack"),
    def:   statLookup("defense"),
    spAtk: statLookup("special-attack"),
    spDef: statLookup("special-defense"),
    spe:   statLookup("speed"),
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
    baseStats,
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
 * Altering Cave uses Wonder Spot events that were never distributed outside Japan.
 * Only Zubat (#41) is permanently available there (the default ROM encounter).
 * All other Pokémon listed by PokéAPI exist in ROM data but are unreachable —
 * strip their altering-cave locations so they don't show as obtainable in-game.
 */
const ALTERING_CAVE_SLUG = /altering-cave/;
const ALTERING_CAVE_DEFAULT_ID = 41; // Zubat

function sanitizeAlteringCave(
  pokemonId: number,
  encounters: ReturnType<typeof normalizeEncounters>
): ReturnType<typeof normalizeEncounters> {
  if (pokemonId === ALTERING_CAVE_DEFAULT_ID) return encounters;
  return encounters
    .map((enc) => ({
      ...enc,
      locations: enc.locations.filter(
        (loc) => !ALTERING_CAVE_SLUG.test(loc.locationAreaSlug)
      ),
    }))
    .filter((enc) => enc.locations.length > 0);
}

function normalizeEncounters(rawEncounters: RawEncounterEntry[]) {
  const allVersionNames: readonly string[] = ALL_VERSION_NAMES;
  const byVersion2 = new Map<string, Map<string, RawEncounterDetail[]>>();
  for (const enc of rawEncounters) {
    for (const vd of enc.version_details) {
      const vName = vd.version.name;
      if (!allVersionNames.includes(vName)) continue;

      if (!byVersion2.has(vName)) byVersion2.set(vName, new Map());
      const locMap = byVersion2.get(vName)!;
      const slug = enc.location_area.name;

      if (!locMap.has(slug)) locMap.set(slug, []);
      locMap.get(slug)!.push(...vd.encounter_details);
    }
  }

  const result = [];
  for (const [version, locMap] of byVersion2) {
    const locations = [];
    for (const [slug, details] of locMap) {
      const normalizedDetails = details.map((d) => {
        // Several Gen 4 encounter types come from PokéAPI as method="walk" but carry
        // a condition_value that encodes the true encounter type:
        //   slot2-*    → Dual-Slot (GBA cartridge in Slot 2)
        //   radar-on   → Pokéradar
        //   swarm-yes  → Mass Outbreak / Swarm
        //   radio-*    → Pokégear Radio (HGSS)
        // These conditions take priority over the raw method name.
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
        const overrideCond = d.condition_values.find((cv) => cv.name in CONDITION_TO_METHOD);
        return {
          // Condition-derived methods are already normalized; skip mapEncounterMethod.
          method: overrideCond
            ? CONDITION_TO_METHOD[overrideCond.name]
            : mapEncounterMethod(d.method.name),
          minLevel: d.min_level,
          maxLevel: d.max_level,
          chance: d.chance,
          isStatic: d.method.name === "only-one" || d.chance === 0,
        };
      });

      locations.push({
        locationAreaSlug: slug,
        locationDisplayName: formatLocationSlug(slug),
        details: normalizedDetails,
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
