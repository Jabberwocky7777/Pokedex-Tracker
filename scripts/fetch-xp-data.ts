/**
 * Builds src/data/xp-trainers.json — the trainers you can battle again and
 * again in Emerald, FireRed/LeafGreen, Platinum and HeartGold/SoulSilver, with
 * their parties and the EXP each battle gives — plus every species' base EXP
 * yield, which the app uses to work out what a wild battle gives.
 *
 * Everything is read from the pret decompilations at pinned commits
 * (PRET_*_COMMIT in constants.ts), so the numbers are the games' own:
 *
 * - Parties: pokeemerald / pokefirered src/data/trainers.h + trainer_parties.h,
 *   pokeplatinum res/trainers/data/*.json, pokeheartgold
 *   files/poketool/trainer/trainers.json (+ include/constants/trainers.h).
 * - Who can be rematched: Emerald's gRematchTable (src/battle_setup.c, Match
 *   Call), FireRed's sRematches (src/vs_seeker.c), Platinum's
 *   gVsSeekerRematchData (src/overlay005/vs_seeker.c). HG/SS has no table (the
 *   phone scripts decide); its rematch parties are the ones with a `_2`, `_3`, …
 *   constant, which stand where the first one does.
 * - Where they stand: the map in the rematch table (Gen III), or the map whose
 *   events place the trainer (Platinum res/field/events, HG/SS zone_event +
 *   src/data/map_headers.h for the map's name).
 * - Base EXP: Gen III from pokeemerald src/data/pokemon/species_info.h, Gen IV
 *   from pokeheartgold files/poketool/personal/personal.json.
 *
 * EXP per battle is the games' formula (pokeemerald Cmd_getexp,
 * pokeplatinum battle_script.c): floor(base × level / 7) per Pokémon, × 1.5
 * for a trainer battle — for one Pokémon that fought alone, without a Lucky
 * Egg, its own catch. lib/xp.ts applies the other multipliers.
 *
 * Diamond/Pearl's trainer data is only in binary form in pret/pokediamond, so
 * D/P has no trainer numbers here (src/data/xp-spots.ts says so).
 *
 * Run: npm run fetch-xp-data
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  PRET_EMERALD_COMMIT,
  PRET_FIRERED_COMMIT,
  PRET_DIAMOND_COMMIT,
  PRET_HEARTGOLD_COMMIT,
  PRET_PLATINUM_COMMIT,
} from "./constants.js";
import type { Pokemon } from "../src/types/index.ts";
import type { XpData, XpTrainer } from "../src/lib/xp.ts";
import { trainerExp } from "../src/lib/xp.ts";
import { XP_SPOTS } from "../src/data/xp-spots.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_FILE = path.join(__dirname, "../src/data/xp-trainers.json");
const POKEMON_FILE = path.join(__dirname, "../public/data/pokemon.json");
const CACHE_ROOT = path.join(__dirname, "../node_modules/.cache/pret-xp");

const REPOS = {
  emerald: ["pokeemerald", PRET_EMERALD_COMMIT],
  firered: ["pokefirered", PRET_FIRERED_COMMIT],
  platinum: ["pokeplatinum", PRET_PLATINUM_COMMIT],
  heartgold: ["pokeheartgold", PRET_HEARTGOLD_COMMIT],
  diamond: ["pokediamond", PRET_DIAMOND_COMMIT],
} as const;
type Repo = keyof typeof REPOS;

async function cached(repo: Repo, file: string): Promise<string> {
  const [name, sha] = REPOS[repo];
  const local = path.join(CACHE_ROOT, name, sha, file);
  if (fs.existsSync(local)) return fs.readFileSync(local, "utf8");
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://raw.githubusercontent.com/pret/${name}/${sha}/${file}`);
    if (res.ok) {
      const text = await res.text();
      fs.mkdirSync(path.dirname(local), { recursive: true });
      fs.writeFileSync(local, text);
      return text;
    }
    if (attempt === 3) throw new Error(`${name}/${file}: HTTP ${res.status}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

/** Every path in a repository at its pinned commit (one API call, cached) */
async function tree(repo: Repo): Promise<string[]> {
  const [name, sha] = REPOS[repo];
  const local = path.join(CACHE_ROOT, name, sha, ".tree.json");
  if (fs.existsSync(local)) return JSON.parse(fs.readFileSync(local, "utf8"));
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/pret/${name}/git/trees/${sha}?recursive=1`, { headers });
  if (!res.ok) throw new Error(`${name} tree: HTTP ${res.status}`);
  const paths = ((await res.json()) as { tree: { path: string }[] }).tree.map((t) => t.path);
  fs.mkdirSync(path.dirname(local), { recursive: true });
  fs.writeFileSync(local, JSON.stringify(paths));
  return paths;
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

// ── Species ────────────────────────────────────────────────────────────────

const pokemon: Pokemon[] = JSON.parse(fs.readFileSync(POKEMON_FILE, "utf8"));
const bySlug = new Map<string, number>();
for (const p of pokemon) {
  bySlug.set(p.name, p.id);
  bySlug.set(p.name.split("-")[0], bySlug.get(p.name.split("-")[0]) ?? p.id);
}
/** SPECIES_MR_MIME → 122 */
function speciesId(constant: string): number {
  const slug = constant
    .replace(/^SPECIES_/, "")
    .toLowerCase()
    .replace(/_/g, "-");
  const id = bySlug.get(slug) ?? bySlug.get(slug.replace(/-/g, ""));
  if (!id) throw new Error(`Unknown species ${constant}`);
  return id;
}

/** "ROUTE_118" / "route_225" / "EVER_GRANDE_CITY" → "Route 118" / "Route 225" / "Ever Grande City" */
function placeName(key: string): string {
  return key
    .replace(/^(MAP|MAPSEC)_/, "")
    .toLowerCase()
    .replace(/(route)(\d)/, "$1 $2")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => (/^\d+f$|^b\d+f$/.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ")
    .replace(/\bMt\b/, "Mt.")
    .replace(/\bPokemon\b/, "Pokémon")
    .replace(/\bSs\b/, "S.S.");
}

/** "COOLTRAINER" / "TRAINER_CLASS_ACE_TRAINER" / "TRAINERCLASS_BIRD_KEEPER_GS" → "Cooltrainer" / "Ace Trainer" / "Bird Keeper" */
function className(cls: string): string {
  return cls
    .replace(/^TRAINER_?CLASS_/, "")
    .replace(/_(GS|M|F|RS|DP|MALE|FEMALE)$/, "")
    .replace(/^ELITE_FOUR.*/, "ELITE_FOUR")
    .replace(/^LEADER.*/, "LEADER")
    .replace(/^CHAMPION.*/, "CHAMPION")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((w) => (w === "pkmn" ? "Pokémon" : w[0].toUpperCase() + w.slice(1)))
    .join(" ")
    .replace("Pokemon", "Pokémon");
}

const titleName = (s: string) =>
  s
    .replace(/\{TRNAME\}/, "")
    .split(/(\s|&)/)
    .map((w) => (w.length > 1 && w === w.toUpperCase() ? w[0] + w.slice(1).toLowerCase() : w))
    .join("");

// ── Gen III ────────────────────────────────────────────────────────────────

interface RawTrainer {
  name: string;
  cls: string;
  double: boolean;
  party: [number, number][];
}

async function gen3Trainers(repo: "emerald" | "firered"): Promise<Map<string, RawTrainer>> {
  const partiesText = await cached(repo, "src/data/trainer_parties.h");
  const parties = new Map<string, [number, number][]>();
  for (const m of partiesText.matchAll(/static const struct \w+ (sParty_\w+)\[\] = \{([\s\S]*?)\n\};/g)) {
    const mons: [number, number][] = [];
    for (const mon of m[2].matchAll(/\.lvl = (\d+),\s*\.species = (SPECIES_\w+)/g)) {
      mons.push([speciesId(mon[2]), Number(mon[1])]);
    }
    parties.set(m[1], mons);
  }
  const trainersText = await cached(repo, "src/data/trainers.h");
  const out = new Map<string, RawTrainer>();
  for (const m of trainersText.matchAll(/\[(TRAINER_\w+)\] =\s*\{([\s\S]*?)\n\s*\},/g)) {
    const body = m[2];
    const party = body.match(/\.party = \w+\((sParty_\w+)\)/)?.[1];
    if (!party) continue;
    out.set(m[1], {
      name: titleName(body.match(/\.trainerName = _\("([^"]*)"\)/)?.[1] ?? ""),
      cls: className(body.match(/\.trainerClass = (TRAINER_CLASS_\w+)/)?.[1] ?? ""),
      double: /\.doubleBattle = TRUE/.test(body),
      party: parties.get(party) ?? [],
    });
  }
  return out;
}

async function gen3BaseExp(): Promise<number[]> {
  const text = await cached("emerald", "src/data/pokemon/species_info.h");
  const out: number[] = [];
  // One chunk per species, from its `[SPECIES_X] =` to the next one
  for (const chunk of text.split(/\n\s*(?=\[SPECIES_\w+\]\s*=)/)) {
    const key = chunk.match(/^\[(SPECIES_\w+)\]/)?.[1];
    const exp = chunk.match(/\.expYield\s*=\s*(\d+)/)?.[1];
    if (!key || !exp || /^SPECIES_(OLD_UNOWN_\w+|EGG|NONE)$/.test(key)) continue;
    let id: number;
    try {
      id = speciesId(key);
    } catch {
      continue;
    }
    if (id <= 386) out[id] = Number(exp);
  }
  return out;
}

interface Rematch {
  /** Trainer constants, first battle first; duplicates and skips removed */
  ids: string[];
  where: string;
}

async function emeraldRematches(): Promise<Rematch[]> {
  const text = await cached("emerald", "src/battle_setup.c");
  const table = text.match(/gRematchTable\[REMATCH_TABLE_ENTRIES\] =\s*\{([\s\S]*?)\n\};/)![1];
  return [...table.matchAll(/REMATCH\(([^)]*)\)/g)].map((m) => {
    const parts = m[1].split(",").map((s) => s.trim());
    const mapKey = parts.pop()!;
    return { ids: [...new Set(parts)], where: placeName(mapKey) };
  });
}

async function fireredRematches(): Promise<Rematch[]> {
  const text = await cached("firered", "src/vs_seeker.c");
  const table = text.match(/sRematches\[\] = \{([\s\S]*?)\n\};/)![1];
  return [...table.matchAll(/\{\s*\{([^}]*)\},\s*MAP\((MAP_\w+)\)/g)].map((m) => ({
    ids: [
      ...new Set(
        m[1]
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.startsWith("TRAINER_")),
      ),
    ],
    where: placeName(m[2]),
  }));
}

// ── Gen IV ─────────────────────────────────────────────────────────────────

async function gen4BaseExp(): Promise<number[]> {
  const personal = JSON.parse(await cached("heartgold", "files/poketool/personal/personal.json")) as {
    baseStats: { species: string; expYield: number }[];
  };
  const out: number[] = [];
  personal.baseStats.forEach((s, i) => {
    if (i >= 1 && i <= 493) out[i] = s.expYield;
  });
  return out;
}

async function platinumTrainers(): Promise<{ trainers: Map<string, RawTrainer>; where: Map<string, string> }> {
  const paths = await tree("platinum");
  const dataFiles = paths.filter((p) => /^res\/trainers\/data\/[a-z0-9_]+\.json$/.test(p));
  const trainers = new Map<string, RawTrainer>();
  await mapLimited(dataFiles, 16, async (file) => {
    const d = JSON.parse(await cached("platinum", file)) as {
      name: string;
      class: string;
      double_battle: boolean;
      party: { species: string; level: number }[];
    };
    const key = "TRAINER_" + path.basename(file, ".json").toUpperCase();
    trainers.set(key, {
      name: d.name,
      cls: className(d.class),
      double: d.double_battle,
      party: d.party.map((m) => [speciesId(m.species), m.level]),
    });
  });
  const eventFiles = paths.filter((p) => /^res\/field\/events\/events_[a-z0-9_]+\.json$/.test(p));
  const where = new Map<string, string>();
  await mapLimited(eventFiles, 16, async (file) => {
    const d = JSON.parse(await cached("platinum", file)) as { object_events?: { script: unknown }[] };
    const place = placeName(path.basename(file, ".json").replace(/^events_/, ""));
    for (const o of d.object_events ?? []) {
      if (typeof o.script === "string" && o.script.startsWith("TRAINER_") && !where.has(o.script)) {
        where.set(o.script, place);
      }
    }
  });
  return { trainers, where };
}

async function platinumRematches(): Promise<string[][]> {
  const text = await cached("platinum", "src/overlay005/vs_seeker.c");
  const table = text.match(/gVsSeekerRematchData\[\] = \{([\s\S]*?)\n\};/)![1];
  const rows: string[][] = [];
  for (const line of table.split("\n")) {
    const single = line.match(/NoUniqueRematches\((TRAINER_\w+)\)/);
    if (single) rows.push([single[1]]);
    const full = line.match(/\{([^}]*)\}/);
    if (full) rows.push([...new Set(full[1].split(",").map((s) => s.trim()))].filter((s) => s.startsWith("TRAINER_")));
  }
  return rows;
}

async function heartgoldTrainers(): Promise<{ trainers: Map<string, RawTrainer>; where: Map<string, string> }> {
  const consts = await cached("heartgold", "include/constants/trainers.h");
  const index = new Map<number, string>();
  for (const m of consts.matchAll(/#define (TRAINER_\w+)\s+(\d+)/g)) index.set(Number(m[2]), m[1]);
  const data = JSON.parse(await cached("heartgold", "files/poketool/trainer/trainers.json")) as {
    trainers: { class: string; name: string; double: number; party: { species: string; level: number }[] }[];
  };
  const trainers = new Map<string, RawTrainer>();
  data.trainers.forEach((t, i) => {
    const key = index.get(i);
    if (!key || t.party.length === 0) return;
    trainers.set(key, {
      name: titleName(t.name),
      cls: className(t.class),
      double: t.double !== 0,
      party: t.party.map((m) => [speciesId(m.species), m.level]),
    });
  });

  const headers = await cached("heartgold", "src/data/map_headers.h");
  const zones: { file: string; mapsec: string }[] = [];
  for (const m of headers.matchAll(/\.eventsBank = NARC_zone_event_(\w+)_bin,\s*\.mapsec = (MAPSEC_\w+)/g)) {
    zones.push({ file: `files/fielddata/eventdata/zone_event/${m[1]}.json`, mapsec: m[2] });
  }
  const where = new Map<string, string>();
  await mapLimited(zones, 16, async ({ file, mapsec }) => {
    let d: { objects?: { scriptId?: string }[] };
    try {
      d = JSON.parse(await cached("heartgold", file));
    } catch {
      return;
    }
    for (const o of d.objects ?? []) {
      const t = String(o.scriptId ?? "").match(/std_trainer\((TRAINER_\w+)\)/)?.[1];
      if (t && !where.has(t)) where.set(t, placeName(mapsec));
    }
  });
  return { trainers, where };
}

const WEEKDAYS = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const TIMES = { TIMEOFDAY_WILD_MORN: "morning", TIMEOFDAY_WILD_DAY: "day", TIMEOFDAY_WILD_NITE: "night" } as const;

/**
 * HG/SS's phone book: the weekday and time of day each registered trainer
 * (gym leaders included) agrees to a rematch when you call. Keyed by the
 * trainer family (the constant without its _2, _3 suffix).
 */
async function heartgoldCallSchedule(): Promise<Map<string, NonNullable<XpTrainer["call"]>>> {
  const book = JSON.parse(await cached("heartgold", "files/tel/pmtel_book.json")) as {
    pmtel_book: { trainerId: string; rematchWeekday: string; rematchTimeOfDay: string }[];
  };
  const out = new Map<string, NonNullable<XpTrainer["call"]>>();
  for (const c of book.pmtel_book) {
    if (c.trainerId === "TRAINER_NONE") continue;
    const day = WEEKDAYS.indexOf(c.rematchWeekday.replace("RTC_WEEK_", ""));
    out.set(c.trainerId.replace(/_\d+$/, ""), {
      weekday: day >= 0 ? day : null,
      time: TIMES[c.rematchTimeOfDay as keyof typeof TIMES] ?? null,
    });
  }
  return out;
}

// ── Building ───────────────────────────────────────────────────────────────

type Kind = XpTrainer["kind"];

function kindOf(cls: string, id: string): Kind {
  if (/Elite Four|Champion/.test(cls) || /SIDNEY|PHOEBE|GLACIA|DRAKE|WALLACE\b/.test(id)) return "league";
  if (/Leader/.test(cls)) return "leader";
  return "rematch";
}

function entry(
  id: string,
  t: RawTrainer,
  where: string,
  tier: number,
  baseExp: number[],
  kind: Kind = kindOf(t.cls, id),
): XpTrainer {
  return {
    id,
    name: t.name,
    cls: t.cls,
    where,
    tier,
    kind,
    double: t.double || undefined,
    party: t.party,
    exp: trainerExp(t.party, baseExp),
  };
}

/**
 * What the app ships: every League and gym leader battle, the trainers src/data/xp-spots.ts names, and each
 * game's strongest rematches (so "the best rematch in the game" stays checkable in the tests). The other few
 * hundred route rematches would only make the Level up chunk bigger.
 */
const KEEP_TOP_REMATCHES = 12;
function trimmed(games: XpData["games"]): XpData["games"] {
  const named = new Set(XP_SPOTS.flatMap((s) => [...(s.trainers?.ids ?? []), ...(s.rematches?.ids ?? [])]));
  const out = {} as XpData["games"];
  for (const [game, list] of Object.entries(games) as [keyof XpData["games"], XpTrainer[]][]) {
    const top = new Set(
      list
        .filter((t) => t.kind === "rematch")
        .sort((a, b) => b.exp - a.exp)
        .slice(0, KEEP_TOP_REMATCHES)
        .map((t) => t.id),
    );
    out[game] = list.filter((t) => t.kind !== "rematch" || named.has(t.id) || top.has(t.id));
  }
  const missing = [...named].filter((id) => !Object.values(out).some((l) => l.some((t) => t.id === id)));
  if (missing.length > 0) throw new Error(`xp-spots.ts names trainers the data doesn't have: ${missing.join(", ")}`);
  return out;
}

async function main() {
  const gen3 = await gen3BaseExp();
  const gen4 = await gen4BaseExp();
  const diffs = gen3.map((v, i) => (v !== undefined && v !== gen4[i] ? i : 0)).filter(Boolean);
  console.log(`Base EXP: ${gen3.filter(Boolean).length} Gen III, ${gen4.filter(Boolean).length} Gen IV species`);
  if (diffs.length > 0)
    console.log(`  differ between Gen III and Gen IV: ${diffs.map((i) => `#${i} ${gen3[i]}→${gen4[i]}`).join(", ")}`);
  const missing3 = Array.from({ length: 386 }, (_, i) => i + 1).filter((i) => !gen3[i]);
  if (missing3.length > 0) throw new Error(`No Gen III base EXP for ${missing3.join(", ")}`);

  const games: XpData["games"] = { emerald: [], firered: [], diamond: [], platinum: [], heartgold: [] };

  // Emerald: every Match Call rematch tier (the gym leaders' and Elite Four's are in the same table)
  {
    const trainers = await gen3Trainers("emerald");
    for (const r of await emeraldRematches()) {
      r.ids.forEach((id, tier) => {
        const t = trainers.get(id);
        if (t) games.emerald.push(entry(id, t, r.where, tier, gen3));
      });
    }
    // Gabby & Ty (not in the Match Call table: their interview rematches are scripted, and they move between routes)
    for (let tier = 0; tier < 6; tier++) {
      const t = trainers.get(`TRAINER_GABBY_AND_TY_${tier + 1}`);
      if (t) games.emerald.push(entry(`TRAINER_GABBY_AND_TY_${tier + 1}`, t, "Routes 111, 118 and 120", tier, gen3));
    }
  }

  // FireRed/LeafGreen: VS Seeker rematches, plus the Elite Four and Champion before and after the Sevii story
  {
    const trainers = await gen3Trainers("firered");
    for (const r of await fireredRematches()) {
      r.ids.forEach((id, tier) => {
        const t = trainers.get(id);
        if (t) games.firered.push(entry(id, t, r.where, tier, gen3));
      });
    }
    // The Champion's team depends on your starter: the three differ by a few EXP, so one of each tier is kept
    const champions = new Set<number>();
    for (const [id, t] of trainers) {
      // (The Hoenn Elite Four constants are left over from Ruby/Sapphire, with empty parties)
      if (!/^TRAINER_(ELITE_FOUR_(LORELEI|BRUNO|AGATHA|LANCE)|CHAMPION_(FIRST|REMATCH)_)/.test(id)) continue;
      const tier = /_2$|REMATCH/.test(id) ? 1 : 0;
      if (id.startsWith("TRAINER_CHAMPION_")) {
        if (champions.has(tier)) continue;
        champions.add(tier);
      }
      games.firered.push(entry(id, t, "Indigo Plateau", tier, gen3, "league"));
    }
  }

  // Platinum: every trainer in the VS Seeker table (one row per trainer, rematch levels in order),
  // the Elite Four / Cynthia rematches, and the gym leaders' Battleground rematches
  {
    const { trainers, where } = await platinumTrainers();
    for (const row of await platinumRematches()) {
      // Unused placeholders (TRAINER_DUMMY_*) stand nowhere
      const place = where.get(row[0]);
      if (!place) continue;
      row.forEach((id, tier) => {
        const t = trainers.get(id);
        if (t) games.platinum.push(entry(id, t, place, tier, gen4));
      });
    }
    for (const [id, t] of trainers) {
      if (/^TRAINER_(ELITE_FOUR_(AARON|BERTHA|FLINT|LUCIAN)|CHAMPION_CYNTHIA)(_REMATCH)?$/.test(id)) {
        games.platinum.push(entry(id, t, "Pokémon League", id.endsWith("_REMATCH") ? 1 : 0, gen4, "league"));
      } else if (/^TRAINER_LEADER_\w+_REMATCH$/.test(id)) {
        games.platinum.push(entry(id, t, "Battleground", 1, gen4, "leader"));
      }
    }
  }

  // Diamond/Pearl: rematch parties are the constants with a _2, _3, … suffix (VS Seeker); the Elite Four and
  // Cynthia have one team. D/P's map events are only binary in pret/pokediamond, so a rematch trainer's place is
  // the same trainer's (class and name) in Platinum, whose maps are the same; one Platinum doesn't have is left out
  {
    const consts = await cached("diamond", "include/constants/trainers.h");
    const index = new Map<number, string>();
    for (const m of consts.matchAll(/#define (TRAINER_\w+)\s+(\d+)/g)) index.set(Number(m[2]), m[1]);
    const data = JSON.parse(await cached("diamond", "files/poketool/trainer/trdata.json")) as {
      trdata: {
        index: number;
        class: string;
        name: string;
        doubleBattle: number;
        party: { species: string; level: number }[];
      }[];
    };
    const trainers = new Map<string, RawTrainer>();
    for (const t of data.trdata) {
      const key = index.get(t.index);
      if (!key || t.party.length === 0) continue;
      trainers.set(key, {
        name: titleName(t.name),
        cls: className(t.class),
        double: t.doubleBattle !== 0,
        party: t.party.map((m) => [speciesId(m.species), m.level]),
      });
    }
    const ptPlace = new Map<string, string>();
    for (const t of games.platinum) if (t.kind === "rematch") ptPlace.set(`${t.cls}|${t.name}`, t.where);
    const families = new Map<string, string[]>();
    for (const id of trainers.keys()) {
      const base = id.replace(/_\d+$/, "");
      if (!families.has(base)) families.set(base, []);
      families.get(base)!.push(id);
    }
    let unplaced = 0;
    for (const [base, ids] of families) {
      const t = trainers.get(base);
      if (!t) continue;
      if (/^TRAINER_(ELITE_FOUR_|CHAMPION_CYNTHIA$)/.test(base)) {
        games.diamond.push(entry(base, t, "Pokémon League", 0, gen4, "league"));
        continue;
      }
      if (ids.length < 2 || /GALACTIC|COMMANDER|RIVAL|LEADER/.test(base)) continue;
      const place = ptPlace.get(`${t.cls}|${t.name}`);
      if (!place) {
        unplaced++;
        continue;
      }
      ids.sort((a, b) => Number(a.match(/_(\d+)$/)?.[1] ?? 1) - Number(b.match(/_(\d+)$/)?.[1] ?? 1));
      ids.forEach((id, tier) => games.diamond.push(entry(id, trainers.get(id)!, place, tier, gen4)));
    }
    if (unplaced) console.log(`diamond: ${unplaced} rematch trainers with no Platinum counterpart left out`);
  }

  // HG/SS: rematch parties are the constants with a _2, _3, … suffix; they stand where the first one does
  {
    const { trainers, where } = await heartgoldTrainers();
    const schedule = await heartgoldCallSchedule();
    const families = new Map<string, string[]>();
    for (const id of trainers.keys()) {
      const base = id.replace(/_\d+$/, "");
      if (!families.has(base)) families.set(base, []);
      families.get(base)!.push(id);
    }
    for (const [base, ids] of families) {
      const league = /^TRAINER_(ELITE_FOUR_|CHAMPION_LANCE|PKMN_TRAINER_RED)/.test(base);
      const leader = /^TRAINER_LEADER_/.test(base);
      if (ids.length < 2 && !league) continue;
      if (!trainers.has(base)) continue;
      ids.sort((a, b) => Number(a.match(/_(\d+)$/)?.[1] ?? 1) - Number(b.match(/_(\d+)$/)?.[1] ?? 1));
      const place = league
        ? base.includes("RED")
          ? "Mt. Silver"
          : "Indigo Plateau"
        : leader
          ? "Saffron City Fighting Dojo"
          : where.get(base);
      // Story battles with several teams (Silver, the executives) and unused placeholders stand nowhere a
      // rematch can happen; only trainers placed on a map are phone rematches
      if (!place) continue;
      // League: the first team and the rematch team (Lance's third party is a story battle)
      if (league) ids.splice(2);
      const call = schedule.get(base);
      // Rematches come by phone: a trainer family that isn't in the phone book (grunts, twins) is several
      // different one-off battles, not rematches
      if (!league && !call) continue;
      ids.forEach((id, tier) => {
        // A leader's rematch is their _2 party at the Fighting Dojo (scr_seq_0832_T11R0101.s); the first is the gym battle
        if (leader && !id.endsWith("_2")) return;
        const e = entry(id, trainers.get(id)!, place, tier, gen4, league ? "league" : undefined);
        games.heartgold.push(call ? { ...e, call } : e);
      });
    }
  }

  for (const [game, list] of Object.entries(games)) {
    const unknown = list.filter((t) => !t.where).length;
    const best = [...list].sort((a, b) => b.exp - a.exp)[0];
    console.log(
      `${game}: ${list.length} battles${unknown ? ` (${unknown} without a place)` : ""}; most EXP: ${best.name} (${best.where}) ${best.exp}`,
    );
  }

  const out: XpData = {
    source: {
      pokeemerald: PRET_EMERALD_COMMIT,
      pokefirered: PRET_FIRERED_COMMIT,
      pokeplatinum: PRET_PLATINUM_COMMIT,
      pokeheartgold: PRET_HEARTGOLD_COMMIT,
      pokediamond: PRET_DIAMOND_COMMIT,
    },
    baseExp: { 3: gen3.map((v) => v ?? 0), 4: gen4.map((v) => v ?? 0) },
    games: trimmed(games),
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(out) + "\n");
  console.log(`Wrote ${path.relative(process.cwd(), OUT_FILE)} (${(fs.statSync(OUT_FILE).size / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
