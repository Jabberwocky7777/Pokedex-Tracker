/**
 * Where to get each evolution item, per group of games.
 *
 * Hand-written, like lib/tm-locations.ts, and not checked line by line against
 * the games — treat it as a pointer, not a guarantee. Each line starts with the
 * place, so the place can link to Routes when it is an encounter area
 * (LocationLink); what follows in brackets is how.
 */
import type { GameVersion } from "../types";

export interface GameGroup {
  id: "rse" | "frlg" | "dppt" | "hgss";
  label: string;
  games: GameVersion[];
}

export const GAME_GROUPS: GameGroup[] = [
  { id: "rse",  label: "Ruby / Sapphire / Emerald", games: ["ruby", "sapphire", "emerald"] },
  { id: "frlg", label: "FireRed / LeafGreen",       games: ["firered", "leafgreen"] },
  { id: "dppt", label: "Diamond / Pearl / Platinum", games: ["diamond", "pearl", "platinum"] },
  { id: "hgss", label: "HeartGold / SoulSilver",    games: ["heartgold", "soulsilver"] },
];

type Sources = Partial<Record<GameGroup["id"], string[]>>;

const SHARD_HUNTER = "Route 124 (the Diving Treasure Hunter trades one for a shard)";
const UNDERGROUND = "The Underground (dig it out of a wall)";
const POKEATHLON = "Pokéathlon Dome (prize shop; the stock changes by day)";
const CELADON = "Celadon City Dept. Store (4F, ¥2,100)";

/** Keyed by the item's name as the evolution data spells it ("Kings Rock", "Up Grade"). */
export const EVOLUTION_ITEM_SOURCES: Record<string, Sources> = {
  "Fire Stone": {
    rse: ["Fiery Path (on the ground)", SHARD_HUNTER],
    frlg: [CELADON],
    dppt: ["Fuego Ironworks (on the ground)", UNDERGROUND],
    hgss: ["Route 25 (Bill's grandfather, for showing him a Pokémon)", POKEATHLON],
  },
  "Water Stone": {
    rse: ["Abandoned Ship (on the ground)", SHARD_HUNTER],
    frlg: [CELADON],
    dppt: ["Route 213 (on the ground)", UNDERGROUND],
    hgss: ["Route 25 (Bill's grandfather, for showing him a Pokémon)", POKEATHLON],
  },
  "Thunder Stone": {
    rse: ["New Mauville (on the ground)", SHARD_HUNTER],
    frlg: [CELADON],
    dppt: ["Sunyshore City (on the ground)", UNDERGROUND],
    hgss: ["Route 25 (Bill's grandfather, for showing him a Pokémon)", POKEATHLON],
  },
  "Leaf Stone": {
    rse: ["Route 119 (on the ground)", SHARD_HUNTER],
    frlg: [CELADON],
    dppt: ["Floaroma Meadow (on the ground)", UNDERGROUND],
    hgss: ["Route 25 (Bill's grandfather, for showing him a Pokémon)", POKEATHLON],
  },
  "Moon Stone": {
    rse: ["Meteor Falls (on the ground)", "Held by wild Lunatone (Sapphire, Emerald)"],
    frlg: ["Mt. Moon (on the ground, more than one)"],
    dppt: ["Mt. Coronet (on the ground)", UNDERGROUND, "Held by wild Clefairy"],
    hgss: ["Tohjo Falls (on the ground)", "Mt. Moon (the square, Monday nights)", POKEATHLON],
  },
  "Sun Stone": {
    rse: ["Mossdeep City (Space Center, given by a sailor)", "Held by wild Solrock (Ruby, Emerald)"],
    frlg: ["Ruin Valley (hidden on the ground)"],
    dppt: [UNDERGROUND, "Held by wild Solrock (Diamond)"],
    hgss: ["National Park (first prize in the Bug-Catching Contest)", POKEATHLON],
  },
  "Shiny Stone": {
    dppt: ["Iron Island (on the ground)", "Route 228 (on the ground)"],
    hgss: ["National Park (Bug-Catching Contest prize, after the National Dex)", POKEATHLON],
  },
  "Dusk Stone": {
    dppt: ["Veilstone City (Galactic Warehouse)", "Victory Road (on the ground)"],
    hgss: [POKEATHLON],
  },
  "Dawn Stone": {
    dppt: ["Mt. Coronet (on the ground)", "Route 225 (on the ground)"],
    hgss: [POKEATHLON],
  },
  "Oval Stone": {
    dppt: ["Lost Tower (on the ground)", "Held by wild Happiny and Chansey"],
    hgss: ["National Park (Bug-Catching Contest prize)", "Held by wild Chansey"],
  },
  "Kings Rock": {
    rse: ["Mossdeep City (given by a boy)", "Held by wild Hariyama"],
    frlg: ["Sevault Canyon (on the ground)"],
    dppt: ["Held by wild Poliwhirl and Slowbro"],
    hgss: ["Slowpoke Well (B2F, needs Surf and Strength)", POKEATHLON],
  },
  "Metal Coat": {
    rse: ["New Mauville (held by wild Magnemite)"],
    frlg: ["Memorial Pillar (on the ground)"],
    dppt: ["Iron Island (from Byron, after the National Dex)", "Held by wild Magnemite, Steelix and Bronzor"],
    hgss: ["S.S. Aqua (given on board)", "Held by wild Magnemite"],
  },
  "Dragon Scale": {
    rse: ["Held by wild Horsea and Bagon"],
    frlg: ["Water Path (on the ground)"],
    dppt: ["Held by wild Horsea, Seadra and Dratini"],
    hgss: ["Mt. Mortar (on the ground)", "Held by wild Horsea and Dratini"],
  },
  "Up Grade": {
    frlg: ["Rocket Warehouse (Five Island, on the ground)"],
    dppt: ["Eterna City (from Professor Oak, after the National Dex)"],
    hgss: ["Saffron City (Silph Co., given by an employee)"],
  },
  "Deep Sea Tooth": {
    rse: ["Slateport City (from Capt. Stern, for the Scanner found in the Abandoned Ship)", "Held by wild Carvanha and Sharpedo"],
    dppt: ["Held by wild Carvanha and Sharpedo"],
    hgss: ["Held by wild Carvanha and Sharpedo (Safari Zone)"],
  },
  "Deep Sea Scale": {
    rse: ["Slateport City (from Capt. Stern, for the Scanner found in the Abandoned Ship)", "Held by wild Chinchou and Relicanth"],
    dppt: ["Held by wild Chinchou, Lanturn and Relicanth"],
    hgss: ["Held by wild Chinchou and Lanturn"],
  },
  "Razor Claw": {
    dppt: ["Victory Road (on the ground)", "Battle Tower (48 BP)"],
    hgss: ["Battle Frontier (48 BP)", "Held by wild Sneasel"],
  },
  "Razor Fang": {
    dppt: ["Battle Tower (48 BP)", "Held by wild Gligar"],
    hgss: ["Battle Frontier (48 BP)", "Held by wild Gligar"],
  },
  "Protector": {
    dppt: ["Route 228 (on the ground)"],
    hgss: ["Mt. Mortar (on the ground)"],
  },
  "Electirizer": {
    dppt: ["Held by wild Elekid and Electabuzz"],
    hgss: ["Cerulean Cave (on the ground)", "Held by wild Elekid and Electabuzz"],
  },
  "Magmarizer": {
    dppt: ["Held by wild Magby and Magmar"],
    hgss: ["Held by wild Magby and Magmar"],
  },
  "Dubious Disc": {
    dppt: ["Route 225 (on the ground; in Platinum, Galactic HQ in Veilstone City)"],
    hgss: ["Battle Frontier (BP)"],
  },
  "Reaper Cloth": {
    dppt: ["Route 229 (on the ground; in Platinum, Turnback Cave)"],
    hgss: ["Battle Frontier (BP)"],
  },
};

/** How the item is written for people. */
export const EVOLUTION_ITEM_NAMES: Record<string, string> = {
  "Kings Rock": "King's Rock",
  "Up Grade": "Up-Grade",
};
