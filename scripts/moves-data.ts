/**
 * Builds public/data/moves.json and public/data/learnsets.json — every Gen I–IV
 * move as it was in each Gen III/IV game, and every Pokémon's learnset per
 * version group — so the Pokédex, Attackdex, Designer and damage calc need
 * nothing from PokéAPI at runtime and work offline.
 *
 * Everything is read from PokéAPI's CSV dump at POKEAPI_COMMIT (the same pin as
 * the encounter data), so the output is reproducible and no live API is used.
 * The app loads both files lazily; see src/lib/move-data.ts for their shapes.
 *
 * Called by fetch-data.ts (npm run generate-data). Run on its own with:
 *   npm run generate-moves
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { POKEAPI_COMMIT } from "./constants.js";
import { loadCsv } from "./pokeapi-csv.js";
import { moveValuesIn, type MoveValues, type PastMoveValues } from "../src/lib/move-values.js";
import {
  VERSION_GROUPS, type LearnsetsFile, type MoveCategory, type MoveRecord, type MovesFile, type VersionGroup,
} from "../src/lib/move-data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DATA_DIR = path.join(__dirname, "../public/data");

const MAX_SPECIES_ID = 493;
/** Moves above this id are later generations' (and ids from 10001 are Shadow moves). */
const MAX_MOVE_ID = 467;
const ENGLISH = "9";
/** Listed first, in this order; any other method PokéAPI records for these games follows. */
const METHODS = ["level-up", "machine", "egg", "tutor"];

const num = (cell: string): number | null => (cell === "" ? null : parseInt(cell, 10));
/** In-game text is hard-wrapped for the game's text box (newlines, form feeds, soft hyphens). */
const unwrap = (text: string) => text.replace(/­\s*/g, "").replace(/\s+/g, " ").trim();

export async function buildMoveData(): Promise<{ moves: MovesFile; learnsets: LearnsetsFile }> {
  const [
    moveRows, changelog, versionGroups, types, damageClasses, targets, contestTypes,
    effectProse, flavorText, pokemonMoves, methodRows, pokemonRows,
  ] = await Promise.all([
    "moves", "move_changelog", "version_groups", "types", "move_damage_classes", "move_targets", "contest_types",
    "move_effect_prose", "move_flavor_text", "pokemon_moves", "pokemon_move_methods", "pokemon",
  ].map(loadCsv));

  const nameOf = (rows: Record<string, string>[]) => new Map(rows.map((r) => [r.id, r.identifier]));
  const typeName = nameOf(types);
  const className = nameOf(damageClasses);
  const targetName = nameOf(targets);
  const contestName = nameOf(contestTypes);
  const versionGroupName = nameOf(versionGroups);
  const methodName = nameOf(methodRows);
  const generationOf = new Map(versionGroups.map((r) => [r.identifier, parseInt(r.generation_id, 10)]));
  const supported = new Set<string>(VERSION_GROUPS);

  const pastByMove = new Map<string, PastMoveValues[]>();
  for (const r of changelog) {
    const list = pastByMove.get(r.move_id) ?? [];
    list.push({
      versionGroup: versionGroupName.get(r.changed_in_version_group_id) ?? "",
      type: r.type_id ? typeName.get(r.type_id) ?? null : null,
      power: num(r.power), accuracy: num(r.accuracy), pp: num(r.pp),
    });
    pastByMove.set(r.move_id, list);
  }

  const proseByEffect = new Map(
    effectProse.filter((r) => r.local_language_id === ENGLISH).map((r) => [r.move_effect_id, r]),
  );

  const flavorByMove = new Map<string, Partial<Record<VersionGroup, string>>>();
  for (const r of flavorText) {
    const versionGroup = versionGroupName.get(r.version_group_id);
    if (r.language_id !== ENGLISH || !versionGroup || !supported.has(versionGroup)) continue;
    const entry = flavorByMove.get(r.move_id) ?? {};
    entry[versionGroup as VersionGroup] = unwrap(r.flavor_text);
    flavorByMove.set(r.move_id, entry);
  }

  // ── Moves ──────────────────────────────────────────────────────────────────
  const moves: MoveRecord[] = [];
  const slugById: string[] = [""];
  for (const r of moveRows) {
    const id = parseInt(r.id, 10);
    if (id > MAX_MOVE_ID) continue;
    const gen = parseInt(r.generation_id, 10);
    const current: MoveValues = {
      type: typeName.get(r.type_id) ?? "", power: num(r.power), accuracy: num(r.accuracy), pp: num(r.pp) ?? 0,
    };
    const past = pastByMove.get(r.id) ?? [];
    const hgss = moveValuesIn(current, past, "heartgold-soulsilver");

    // Only the fields in which an older game differs, and only for games that have the move
    const by: Partial<Record<VersionGroup, Partial<MoveValues>>> = {};
    for (const versionGroup of VERSION_GROUPS) {
      if (versionGroup === "heartgold-soulsilver" || (generationOf.get(versionGroup) ?? 0) < gen) continue;
      const values = moveValuesIn(current, past, versionGroup);
      const diff = Object.fromEntries(
        (Object.keys(values) as (keyof MoveValues)[]).filter((k) => values[k] !== hgss[k]).map((k) => [k, values[k]]),
      );
      if (Object.keys(diff).length > 0) by[versionGroup] = diff;
    }

    const prose = proseByEffect.get(r.effect_id);
    const target = targetName.get(r.target_id);
    slugById[id] = r.identifier;
    moves.push({
      id, slug: r.identifier, gen,
      ...hgss,
      category: className.get(r.damage_class_id) as MoveCategory,
      ...(target === "all-opponents" || target === "all-other-pokemon" ? { spread: true as const } : {}),
      ...(Object.keys(by).length > 0 ? { by } : {}),
      shortEffect: unwrap(prose?.short_effect ?? ""),
      effect: unwrap(prose?.effect ?? ""),
      contest: r.contest_type_id ? contestName.get(r.contest_type_id) ?? null : null,
      flavor: flavorByMove.get(r.id) ?? {},
    });
  }
  moves.sort((a, b) => a.id - b.id);

  // ── Learnsets ──────────────────────────────────────────────────────────────
  // A species' learnset is its default form's (whose pokemon id is the species
  // id). Where the default form has no rows for a game, its other forms' rows
  // are used: Deoxys is only its Speed Forme in Emerald and its Attack or
  // Defense Forme in FireRed/LeafGreen.
  const formsOf = new Map(pokemonRows.map((r) => [r.id, parseInt(r.species_id, 10)]));
  const methods = [...METHODS];
  const methodIndex = (name: string) => {
    if (!methods.includes(name)) methods.push(name);
    return methods.indexOf(name);
  };
  type Entry = { move: number; method: number; level: number; order: number };
  const bySpecies = new Map<number, Entry[][]>();
  const byOtherForm = new Map<number, Entry[][]>();
  for (const r of pokemonMoves) {
    const speciesId = formsOf.get(r.pokemon_id) ?? 0;
    const versionGroup = versionGroupName.get(r.version_group_id);
    const move = parseInt(r.move_id, 10);
    if (speciesId < 1 || speciesId > MAX_SPECIES_ID || !versionGroup || !supported.has(versionGroup) || move > MAX_MOVE_ID) continue;
    const target = parseInt(r.pokemon_id, 10) === speciesId ? bySpecies : byOtherForm;
    let lists = target.get(speciesId);
    if (!lists) target.set(speciesId, (lists = VERSION_GROUPS.map(() => [])));
    lists[VERSION_GROUPS.indexOf(versionGroup as VersionGroup)].push({
      move,
      method: methodIndex(methodName.get(r.pokemon_move_method_id) ?? "unknown"),
      level: parseInt(r.level, 10) || 0,
      order: parseInt(r.order, 10) || 0,
    });
  }

  const pokemon: Record<string, number[][]> = {};
  for (const speciesId of [...bySpecies.keys()].sort((a, b) => a - b)) {
    pokemon[speciesId] = bySpecies.get(speciesId)!.map((entries, i) => {
      const seen = new Set<string>();
      return (entries.length > 0 ? entries : byOtherForm.get(speciesId)?.[i] ?? [])
        .sort((a, b) => a.method - b.method || a.level - b.level || a.order - b.order || a.move - b.move)
        // Two forms can list the same move at the same level
        .filter((e) => { const key = `${e.move}|${e.method}|${e.level}`; return !seen.has(key) && seen.add(key); })
        .flatMap((e) => [e.move, e.method, e.level]);
    });
  }

  return {
    moves: { pokeapiCommit: POKEAPI_COMMIT, moves },
    learnsets: { pokeapiCommit: POKEAPI_COMMIT, methods, moves: slugById, pokemon },
  };
}

/** Writes both files (compact: every client that opens a move list downloads them). */
export async function writeMoveData(): Promise<void> {
  const { moves, learnsets } = await buildMoveData();
  fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(PUBLIC_DATA_DIR, "moves.json"), JSON.stringify(moves) + "\n");
  console.log(`   ✓ public/data/moves.json (${moves.moves.length} moves)`);
  fs.writeFileSync(path.join(PUBLIC_DATA_DIR, "learnsets.json"), JSON.stringify(learnsets) + "\n");
  console.log(`   ✓ public/data/learnsets.json (${Object.keys(learnsets.pokemon).length} Pokémon)`);
}

// Run directly (npm run generate-moves) rather than imported by fetch-data.ts
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`📌 Moves and learnsets from PokeAPI/pokeapi@${POKEAPI_COMMIT.slice(0, 10)}...`);
  writeMoveData().catch((err) => {
    console.error("❌ Fatal error:", err);
    process.exit(1);
  });
}
