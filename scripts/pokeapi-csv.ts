/**
 * Encounter data source: PokéAPI's CSV dump, read from GitHub at a pinned commit
 * (POKEAPI_COMMIT in constants.ts) so regenerating the data is reproducible.
 *
 * The CSV rows are reshaped into the same structure the live
 * /pokemon/{id}/encounters endpoint returns, so normalizeEncounters() in
 * fetch-data.ts doesn't care where the data came from.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ALL_VERSION_NAMES, POKEAPI_COMMIT, POKEAPI_CSV_BASE } from "./constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Downloaded CSVs are cached per commit under node_modules/.cache (gitignored).
const CACHE_DIR = path.join(__dirname, "../node_modules/.cache/pokeapi-csv", POKEAPI_COMMIT);

export interface RawEncounterDetail {
  method: { name: string };
  min_level: number;
  max_level: number;
  chance: number;
  condition_values: { name: string }[];
}

export interface RawVersionDetail {
  version: { name: string };
  encounter_details: RawEncounterDetail[];
}

export interface RawEncounterEntry {
  location_area: { name: string };
  version_details: RawVersionDetail[];
}

const CSV_FILES = [
  "encounters",
  "encounter_slots",
  "encounter_methods",
  "encounter_condition_value_map",
  "encounter_condition_values",
  "location_areas",
  "locations",
  "versions",
  "pokemon",
] as const;

type Row = Record<string, string>;

/** RFC 4180: quoted cells may contain commas, line breaks and doubled quotes (the prose and flavor-text files do). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(cell); cell = "";
    } else if (c === "\n") {
      row.push(cell); rows.push(row); row = []; cell = "";
    } else if (c !== "\r") {
      cell += c;
    }
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

/** One file of PokéAPI's CSV dump at the pinned commit, as rows keyed by column name. */
export async function loadCsv(name: string): Promise<Row[]> {
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
  const [keys, ...lines] = parseCsv(text);
  return lines.map((cells) => {
    const row: Row = {};
    keys.forEach((k, i) => { row[k] = (cells[i] ?? "").trim(); });
    return row;
  });
}

/**
 * Returns species ID → encounters, in the live API's response shape, for the
 * supported versions only. Alternate forms are folded into their species.
 */
export async function loadEncountersFromCsv(maxSpeciesId: number): Promise<Map<number, RawEncounterEntry[]>> {
  const [encounters, slots, methods, condMap, condValues, areas, locations, versions, pokemon] =
    await Promise.all(CSV_FILES.map(loadCsv));

  const supported: readonly string[] = ALL_VERSION_NAMES;
  const versionName = new Map(versions.map((r) => [r.id, r.identifier]));
  const methodName = new Map(methods.map((r) => [r.id, r.identifier]));
  const slotById = new Map(slots.map((r) => [r.id, r]));
  const condName = new Map(condValues.map((r) => [r.id, r.identifier]));
  const locationName = new Map(locations.map((r) => [r.id, r.identifier]));
  // The API names an area "<location>-<area>", or "<location>-area" when the area is unnamed.
  const areaName = new Map(
    areas.map((r) => [r.id, `${locationName.get(r.location_id)}-${r.identifier || "area"}`]),
  );
  const speciesOf = new Map(pokemon.map((r) => [r.id, parseInt(r.species_id, 10)]));

  const condsByEncounter = new Map<string, { name: string }[]>();
  for (const r of condMap) {
    const name = condName.get(r.encounter_condition_value_id);
    if (!name) continue;
    const list = condsByEncounter.get(r.encounter_id) ?? [];
    list.push({ name });
    condsByEncounter.set(r.encounter_id, list);
  }

  // species → area → version → details
  const grouped = new Map<number, Map<string, Map<string, RawEncounterDetail[]>>>();
  for (const r of encounters) {
    const version = versionName.get(r.version_id);
    if (!version || !supported.includes(version)) continue;
    const speciesId = speciesOf.get(r.pokemon_id);
    if (speciesId === undefined || speciesId > maxSpeciesId) continue;
    const slot = slotById.get(r.encounter_slot_id);
    const area = areaName.get(r.location_area_id);
    if (!slot || !area) continue;

    let byArea = grouped.get(speciesId);
    if (!byArea) grouped.set(speciesId, (byArea = new Map()));
    let byVersion = byArea.get(area);
    if (!byVersion) byArea.set(area, (byVersion = new Map()));
    let details = byVersion.get(version);
    if (!details) byVersion.set(version, (details = []));
    details.push({
      method: { name: methodName.get(slot.encounter_method_id) ?? "unknown" },
      min_level: parseInt(r.min_level, 10),
      max_level: parseInt(r.max_level, 10),
      chance: parseInt(slot.rarity, 10) || 0,
      condition_values: condsByEncounter.get(r.id) ?? [],
    });
  }

  const result = new Map<number, RawEncounterEntry[]>();
  for (const [speciesId, byArea] of grouped) {
    result.set(
      speciesId,
      Array.from(byArea, ([area, byVersion]) => ({
        location_area: { name: area },
        version_details: Array.from(byVersion, ([version, encounter_details]) => ({
          version: { name: version },
          encounter_details,
        })),
      })),
    );
  }
  return result;
}
