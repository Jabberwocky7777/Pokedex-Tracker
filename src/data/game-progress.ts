import type { GameVersion } from "../types";

// Game Progress: the badges and story milestones of each Gen III / IV game.
// ("Milestones" in ProgressView / progress-history.ts are catch counts — a different thing.)
//
// Badge numbers are the game's own badge ids, which are also the bits a save
// stores them in: pret/pokediamond include/constants/badge.h, pret/pokeplatinum
// generated/badges.txt, pret/pokeheartgold include/constants/badge.h (Johto 0–7,
// Kanto 8–15), and FLAG_BADGE01_GET … FLAG_BADGE08_GET in pret/pokeemerald,
// pokeruby and pokefirered include/constants/flags.h. They are listed in the
// order the gyms are usually beaten, which in Platinum differs from the ids.
//
// The milestones and their order were checked (2026-10-26) against Bulbapedia's
// National Pokédex, Sevii Islands, Fight Area and Mt. Silver pages:
// - Diamond / Pearl: National Pokédex from Rowan after seeing the 150 Sinnoh
//   Pokémon (only possible after the Hall of Fame); the Fight Area by ferry from
//   Snowpoint once Champion; the rest of the Battle Zone (Routes 225–230) needs
//   the National Pokédex.
// - Platinum: the same, after seeing all 210 of Platinum's Sinnoh Pokédex.
// - HeartGold / SoulSilver: the National Pokédex from Oak when you first try to
//   board the S.S. Aqua after the Hall of Fame; Kanto's gyms after that; Mt.
//   Silver (Red) once all 16 badges are in.
// - Emerald: the National Pokédex from Birch after the first Hall of Fame.
//   Ruby / Sapphire: only by trading with FireRed, LeafGreen or Emerald.
// - FireRed / LeafGreen: One–Three Island after the Volcano Badge (Celio's Tri-Pass);
//   the National Pokédex from Oak after the Hall of Fame with 60 Kanto Pokémon
//   owned; Four–Seven Island with the Rainbow Pass, after the Hall of Fame and
//   the National Pokédex.

export interface BadgeDef {
  /** The game's badge id (its bit in the save) */
  id: number;
  name: string;
  leader: string;
  /** "Johto" / "Kanto" in HeartGold and SoulSilver */
  region?: string;
}

export interface MilestoneDef {
  id: MilestoneId;
  label: string;
  /** One line on how it is reached */
  detail: string;
}

export type MilestoneId = "hall-of-fame" | "national-dex" | "fight-area" | "kanto" | "red" | "sevii-1-3" | "sevii-4-7";

export interface GameProgressDef {
  badges: BadgeDef[];
  /** Story order */
  milestones: MilestoneDef[];
}

const SINNOH_DP: BadgeDef[] = [
  { id: 0, name: "Coal Badge", leader: "Roark" },
  { id: 1, name: "Forest Badge", leader: "Gardenia" },
  { id: 2, name: "Cobble Badge", leader: "Maylene" },
  { id: 3, name: "Fen Badge", leader: "Crasher Wake" },
  { id: 4, name: "Relic Badge", leader: "Fantina" },
  { id: 5, name: "Mine Badge", leader: "Byron" },
  { id: 6, name: "Icicle Badge", leader: "Candice" },
  { id: 7, name: "Beacon Badge", leader: "Volkner" },
];
// Platinum moves Fantina to third; the ids stay the same
const SINNOH_PT: BadgeDef[] = [0, 1, 4, 2, 3, 5, 6, 7].map((id) => SINNOH_DP.find((b) => b.id === id)!);

const JOHTO: BadgeDef[] = [
  { id: 0, name: "Zephyr Badge", leader: "Falkner", region: "Johto" },
  { id: 1, name: "Hive Badge", leader: "Bugsy", region: "Johto" },
  { id: 2, name: "Plain Badge", leader: "Whitney", region: "Johto" },
  { id: 3, name: "Fog Badge", leader: "Morty", region: "Johto" },
  { id: 4, name: "Storm Badge", leader: "Chuck", region: "Johto" },
  { id: 5, name: "Mineral Badge", leader: "Jasmine", region: "Johto" },
  { id: 6, name: "Glacier Badge", leader: "Pryce", region: "Johto" },
  { id: 7, name: "Rising Badge", leader: "Clair", region: "Johto" },
];
const KANTO_LEADERS = ["Brock", "Misty", "Lt. Surge", "Erika", "Koga", "Sabrina", "Blaine", "Giovanni"];
const KANTO_NAMES = ["Boulder", "Cascade", "Thunder", "Rainbow", "Soul", "Marsh", "Volcano", "Earth"];
const KANTO_FRLG: BadgeDef[] = KANTO_NAMES.map((n, i) => ({ id: i, name: `${n} Badge`, leader: KANTO_LEADERS[i] }));
// In HG/SS Koga's place is Janine's, and Blue leads the Viridian Gym
const KANTO_HGSS: BadgeDef[] = KANTO_NAMES.map((n, i) => ({
  id: 8 + i, name: `${n} Badge`, leader: i === 4 ? "Janine" : i === 7 ? "Blue" : KANTO_LEADERS[i], region: "Kanto",
}));

const HOENN: BadgeDef[] = [
  { id: 0, name: "Stone Badge", leader: "Roxanne" },
  { id: 1, name: "Knuckle Badge", leader: "Brawly" },
  { id: 2, name: "Dynamo Badge", leader: "Wattson" },
  { id: 3, name: "Heat Badge", leader: "Flannery" },
  { id: 4, name: "Balance Badge", leader: "Norman" },
  { id: 5, name: "Feather Badge", leader: "Winona" },
  { id: 6, name: "Mind Badge", leader: "Tate & Liza" },
  { id: 7, name: "Rain Badge", leader: "Wallace" },
];
const HOENN_E: BadgeDef[] = HOENN.map((b) => (b.id === 7 ? { ...b, leader: "Juan" } : b));

const HOF: MilestoneDef = { id: "hall-of-fame", label: "Elite Four (Hall of Fame)", detail: "Beat the Elite Four and the Champion" };

const SINNOH_MILESTONES = (seen: number): MilestoneDef[] => [
  HOF,
  { id: "national-dex", label: "National Pokédex", detail: `From Professor Rowan after seeing all ${seen} Sinnoh Pokémon` },
  { id: "fight-area", label: "Battle Zone (Fight Area)", detail: "By ferry from Snowpoint City, once you are Champion" },
];

export const GAME_PROGRESS: Partial<Record<GameVersion, GameProgressDef>> = {
  diamond: { badges: SINNOH_DP, milestones: SINNOH_MILESTONES(150) },
  pearl: { badges: SINNOH_DP, milestones: SINNOH_MILESTONES(150) },
  platinum: { badges: SINNOH_PT, milestones: SINNOH_MILESTONES(210) },
  heartgold: { badges: [...JOHTO, ...KANTO_HGSS], milestones: hgssMilestones() },
  soulsilver: { badges: [...JOHTO, ...KANTO_HGSS], milestones: hgssMilestones() },
  ruby: { badges: HOENN, milestones: [HOF, { id: "national-dex", label: "National Pokédex", detail: "Only by trading with FireRed, LeafGreen or Emerald" }] },
  sapphire: { badges: HOENN, milestones: [HOF, { id: "national-dex", label: "National Pokédex", detail: "Only by trading with FireRed, LeafGreen or Emerald" }] },
  emerald: { badges: HOENN_E, milestones: [HOF, { id: "national-dex", label: "National Pokédex", detail: "From Professor Birch after your first Hall of Fame" }] },
  firered: { badges: KANTO_FRLG, milestones: frlgMilestones() },
  leafgreen: { badges: KANTO_FRLG, milestones: frlgMilestones() },
};

function hgssMilestones(): MilestoneDef[] {
  return [
    HOF,
    { id: "national-dex", label: "National Pokédex", detail: "From Professor Oak when you first board the S.S. Aqua" },
    { id: "kanto", label: "Kanto", detail: "Reached by the S.S. Aqua after the Hall of Fame" },
    { id: "red", label: "Red at Mt. Silver", detail: "Oak opens Mt. Silver once you have all 16 badges" },
  ];
}

function frlgMilestones(): MilestoneDef[] {
  return [
    { id: "sevii-1-3", label: "Sevii Islands 1–3", detail: "With Bill, after the Volcano Badge (Tri-Pass)" },
    HOF,
    { id: "national-dex", label: "National Pokédex", detail: "From Professor Oak with 60 Kanto Pokémon owned" },
    { id: "sevii-4-7", label: "Sevii Islands 4–7", detail: "Rainbow Pass from Celio, after the Hall of Fame and National Pokédex" },
  ];
}

/** The Pokédex's own words for each milestone, for unlock text ("Unlocks at: National Pokédex (Pt)") */
export function milestoneLabel(game: string, id: MilestoneId): string {
  return GAME_PROGRESS[game as GameVersion]?.milestones.find((m) => m.id === id)?.label ?? id;
}
