/**
 * Where to get species the living dex is still missing, from the encounter
 * data already in pokemon.json. Used by the to-do list (one best location per
 * species) and the cross-save transfer planner (a shopping list per game).
 */
import type { GameVersion, Pokemon } from "../../types";
import { GAME_LABELS } from "../../types";
import { buildNextLocations } from "../what-next";
import { pairedVersion } from "../generation";
import { allocatePending, analyzeProfile, breedingHints } from "./living-dex";
import type { ProfileMons, SaveFamily, SlimMon } from "./types";

/** Games a save of each family could be. */
const FAMILY_GAMES: Record<SaveFamily, GameVersion[]> = {
  platinum: ["platinum"],
  dp: ["diamond", "pearl"],
  hgss: ["heartgold", "soulsilver"],
  rse: ["ruby", "sapphire", "emerald"],
  frlg: ["firered", "leafgreen"],
};

/** The games a profile stands for: the exact one when its label names it, else the whole family. */
export function profileGames(profile: ProfileMons["profile"]): GameVersion[] {
  const games = FAMILY_GAMES[profile.family];
  const named = games.filter((g) => profile.label.toLowerCase().includes(GAME_LABELS[g].toLowerCase()));
  return named.length > 0 ? named : games;
}

export interface CatchSpot {
  game: GameVersion;
  slug: string;
  location: string;
  minLevel: number;
  maxLevel: number;
  /** Found in this game but not in its paired version */
  exclusive: boolean;
  /** The game is one the user has imported a save from */
  inYourGames: boolean;
}

export type Acquisition =
  | { kind: "catch"; species: number; spot: CatchSpot }
  | { kind: "evolve"; species: number; from: number; trade: boolean }
  | { kind: "none"; species: number };

export interface AcquireOptions {
  /** Every Pokémon of the generation */
  pokemon: Pokemon[];
  /** All games of the generation, in display order */
  genGames: readonly GameVersion[];
  /** Games the user has saves for, most preferred first */
  yourGames: readonly GameVersion[];
}

function catchableIn(p: Pokemon, game: string): boolean {
  return p.encounters.some((e) => e.version === game && e.locations.some((l) => l.details.some((d) => d.method !== "trade")));
}

function isExclusive(p: Pokemon, game: GameVersion): boolean {
  const other = pairedVersion(game);
  return other !== null && !catchableIn(p, other);
}

/**
 * How to get each missing species: the best place to catch it (the location
 * holding the most missing species, in the user's own games first), or the
 * earlier stage to evolve it from.
 */
export function planAcquisition(missing: readonly number[], opts: AcquireOptions): Map<number, Acquisition> {
  const { pokemon, genGames, yourGames } = opts;
  const missingSet = new Set(missing);
  const everythingElse = new Set(pokemon.filter((p) => !missingSet.has(p.id)).map((p) => p.id));
  const byId = new Map(pokemon.map((p) => [p.id, p]));
  const out = new Map<number, Acquisition>();

  // Pass 1: the user's games. Pass 2: any game of the generation.
  for (const games of [yourGames, genGames.filter((g) => !yourGames.includes(g))]) {
    if (games.length === 0) continue;
    // Ranked so that a trip to one location covers as many missing species as possible
    for (const loc of buildNextLocations(pokemon, games, everythingElse, false)) {
      for (const { targets } of loc.byMethod) {
        for (const t of targets) {
          if (out.has(t.pokemon.id)) continue;
          const game = (games.find((g) => t.games.includes(g)) ?? t.games[0]) as GameVersion;
          out.set(t.pokemon.id, {
            kind: "catch",
            species: t.pokemon.id,
            spot: {
              game, slug: loc.slug, location: loc.displayName, minLevel: t.minLevel, maxLevel: t.maxLevel,
              exclusive: isExclusive(t.pokemon, game), inYourGames: yourGames.includes(game),
            },
          });
        }
      }
    }
  }

  for (const id of missing) {
    if (out.has(id)) continue;
    const from = byId.get(id)?.evolvesFrom ?? null;
    const step = from !== null ? byId.get(from)?.evolvesTo.find((s) => s.speciesId === id) : undefined;
    out.set(id, from !== null ? { kind: "evolve", species: id, from, trade: step?.trigger === "trade" } : { kind: "none", species: id });
  }
  return out;
}

/** "Box 3 · slot 8" style reference to a copy in another save. */
export interface SendSource {
  profileId: string;
  label: string;
  boxNames: string[];
  mon: SlimMon;
}

/** For each species, a copy in a non-living-dex save that could be sent over. */
export function sendSources(others: ProfileMons[]): Map<number, SendSource> {
  const out = new Map<number, SendSource>();
  for (const p of others) {
    for (const mon of p.mons) {
      if (mon.isEgg || out.has(mon.species)) continue;
      out.set(mon.species, { profileId: p.profile.id, label: p.profile.label, boxNames: p.boxNames, mon });
    }
  }
  return out;
}

// ── Cross-save transfer plan: a shopping list per game ───────────────────────

export interface GamePlan {
  game: GameVersion;
  /** The user has imported a save of this game */
  yours: boolean;
  /** Missing species best caught in this game */
  toCatch: { species: number; spot: CatchSpot }[];
  /** Missing species the user already has in a save of this game */
  toSend: { species: number; source: SendSource }[];
}

export interface TransferPlan {
  games: GamePlan[];
  /** Missing species that come from evolving something: `have` = an earlier stage is already waiting */
  toEvolve: { species: number; from: number; trade: boolean; have: boolean }[];
  toBreed: { species: number; parent: number }[];
  /** No wild encounter and nothing to evolve it from */
  unavailable: number[];
  /** Species the living-dex save has no copy of at all */
  missing: number;
}

/**
 * Combines ownership in other saves, encounter availability per game and
 * evolutions into one plan for everything the living-dex save lacks.
 */
export function buildTransferPlan(
  profiles: ProfileMons[],
  opts: { pokemon: Pokemon[]; genGames: readonly GameVersion[]; maxSpecies: number },
): TransferPlan | null {
  const living = profiles.find((p) => p.profile.role === "living-dex");
  if (!living) return null;
  const { pokemon, genGames, maxSpecies } = opts;
  const dex = new Map(pokemon.map((p) => [p.id, p]));
  const a = analyzeProfile(living, dex, maxSpecies);
  const others = profiles.filter((p) => p !== living);
  const allocation = allocatePending(profiles, dex, maxSpecies);
  const breeding = breedingHints(allocation.owned, dex, maxSpecies);
  const elsewhere = sendSources(others);
  const gameOfProfile = new Map(others.map((p) => [p.profile.id, profileGames(p.profile)[0]]));
  const yourGames = [...new Set(profiles.flatMap((p) => profileGames(p.profile)))].filter((g) => genGames.includes(g));

  const plans = new Map<GameVersion, GamePlan>();
  const planFor = (game: GameVersion) => {
    let plan = plans.get(game);
    if (!plan) plans.set(game, (plan = { game, yours: yourGames.includes(game), toCatch: [], toSend: [] }));
    return plan;
  };
  const out: TransferPlan = { games: [], toEvolve: [], toBreed: [], unavailable: [], missing: 0 };
  const isTrade = (from: number, to: number) => dex.get(from)?.evolvesTo.find((s) => s.speciesId === to)?.trigger === "trade";

  const toAcquire: number[] = [];
  for (const species of a.slots.keys()) {
    if (a.owned.has(species)) continue; // already in the living-dex save, placed or not
    out.missing++;
    const source = elsewhere.get(species);
    const pending = allocation.pending.get(species);
    const parent = breeding.get(species);
    if (source) planFor(gameOfProfile.get(source.profileId)!).toSend.push({ species, source });
    else if (pending) {
      // The next step towards it may itself be a trade (Onix → Steelix), or a later one (Abra → Kadabra → Alakazam)
      const via = dex.get(species)?.evolvesFrom ?? pending.from;
      out.toEvolve.push({ species, from: pending.from, trade: isTrade(via, species), have: true });
    } else if (parent !== undefined) out.toBreed.push({ species, parent });
    else toAcquire.push(species);
  }

  for (const how of planAcquisition(toAcquire, { pokemon, genGames, yourGames }).values()) {
    if (how.kind === "catch") planFor(how.spot.game).toCatch.push({ species: how.species, spot: how.spot });
    else if (how.kind === "evolve") out.toEvolve.push({ species: how.species, from: how.from, trade: how.trade, have: false });
    else out.unavailable.push(how.species);
  }

  const livingGame = profileGames(living.profile)[0];
  out.games = [...plans.values()].sort((x, y) =>
    Number(y.game === livingGame) - Number(x.game === livingGame)
    || Number(y.yours) - Number(x.yours)
    || (y.toCatch.length + y.toSend.length) - (x.toCatch.length + x.toSend.length));
  out.toEvolve.sort((x, y) => Number(y.have) - Number(x.have) || x.species - y.species);
  return out;
}
