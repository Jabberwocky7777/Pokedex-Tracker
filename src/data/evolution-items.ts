/**
 * Where to get each evolution item, per group of games.
 *
 * Hand-written from the acquisition tables of Bulbapedia's item pages
 * (checked 2026-10-14). Each line starts with the place, so the place can link
 * to Routes when it is an encounter area (LocationLink); what follows in
 * brackets is how. A group with no entry shows "trade it over", which is what
 * Bulbapedia says for those games. "(Platinum)" and the like mark a source only
 * one game of the group has.
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

const shardHunter = (shard: string) => `Route 124 (the Treasure Hunter trades one for a ${shard})`;
const UNDERGROUND = "The Underground (dig it out of a wall)";
const CELADON = "Celadon City (Dept. Store 4F, ¥2,100)";
const BILLS_GRANDFATHER = "Route 25 (Sea Cottage: Bill's grandfather, for showing him the Pokémon he asks about)";
const contest = (afterNationalDex: boolean) =>
  `National Park (Bug-Catching Contest first prize${afterNationalDex ? ", after the National Dex" : ""})`;
const pokeathlon = (points: string, days: string, afterNationalDex = false) =>
  `Pokéathlon Dome (prize shop, ${points} points, ${days}${afterNationalDex ? ", after the National Dex" : ""})`;
const pickup = (levels: string) => `Pickup ability (Pokémon at level ${levels})`;

/** Keyed by the item's name as the evolution data spells it ("Kings Rock", "Up Grade"). */
export const EVOLUTION_ITEM_SOURCES: Record<string, Sources> = {
  "Fire Stone": {
    rse: ["Fiery Path (found there)", shardHunter("Red Shard")],
    frlg: ["Mt. Ember (found there, two)", CELADON],
    dppt: [
      "Fuego Ironworks (found there; two in Diamond and Pearl, one in Platinum)",
      "Solaceon Ruins (found there, Platinum)",
      "Stark Mountain (found there, Platinum)",
      UNDERGROUND,
    ],
    hgss: [
      BILLS_GRANDFATHER,
      "Route 36 (Schoolboy Alan gives you one now and then, once you have his phone number)",
      contest(true),
      pokeathlon("2,500", "Sunday, Tuesday, Thursday"),
    ],
  },
  "Water Stone": {
    rse: ["Abandoned Ship (found there)", shardHunter("Blue Shard")],
    frlg: ["Seafoam Islands (found there, two)", CELADON],
    dppt: [
      "Route 213 (found there)",
      "Route 230 (found there, Platinum)",
      "Solaceon Ruins (found there, Platinum)",
      UNDERGROUND,
    ],
    hgss: [
      "Seafoam Islands (found there)",
      BILLS_GRANDFATHER,
      "Route 42 (Fisherman Tully gives you one now and then, once you have his phone number)",
      contest(true),
      pokeathlon("2,500", "Monday, Tuesday, Wednesday, Friday"),
    ],
  },
  "Thunder Stone": {
    rse: ["New Mauville (found there)", shardHunter("Yellow Shard")],
    frlg: ["Power Plant (found there, two)", CELADON],
    dppt: [
      "Sunyshore City (found there)",
      "Solaceon Ruins (found there, Platinum)",
      "Route 229 (found there, Platinum)",
      UNDERGROUND,
    ],
    hgss: [
      BILLS_GRANDFATHER,
      "Route 38 (Lass Dana gives you one now and then, once you have her phone number)",
      contest(true),
      pokeathlon("2,500", "Wednesday, Thursday, Saturday"),
    ],
  },
  "Leaf Stone": {
    rse: ["Route 119 (found there)", shardHunter("Green Shard")],
    frlg: ["Safari Zone (found there, two)", CELADON],
    dppt: [
      "Floaroma Meadow (found there)",
      "Route 225 (found there, Platinum)",
      "Great Marsh (found there, Platinum)",
      UNDERGROUND,
    ],
    hgss: [
      "Viridian Forest (found there)",
      BILLS_GRANDFATHER,
      "Route 34 (Picnicker Gina gives you one now and then, once you have her phone number)",
      contest(true),
      pokeathlon("2,500", "Tuesday, Thursday, Saturday"),
    ],
  },
  "Moon Stone": {
    rse: ["Meteor Falls (found there)", "Held by wild Lunatone (Sapphire, 5%)"],
    frlg: [
      "Mt. Moon (found there, two)",
      "Rocket Hideout (found there)",
      "Pokémon Mansion (found there)",
      "Held by wild Clefairy (5%)",
    ],
    dppt: [
      "Mt. Coronet (found there, Platinum)",
      "Eterna City (found there, Platinum)",
      UNDERGROUND,
      "Held by wild Lunatone, Clefairy and Cleffa (5%)",
    ],
    hgss: [
      "Tohjo Falls (found there)",
      "Ruins of Alph (found there)",
      "Mt. Moon (the square, Monday nights)",
      "Mom (one of the things she buys with the money she saves for you)",
      contest(true),
      pokeathlon("3,000", "Monday, Wednesday"),
      pickup("41–100"),
      "Held by wild Clefairy and Lunatone (5%)",
    ],
  },
  "Sun Stone": {
    rse: ["Mossdeep City (Space Center)", "Held by wild Solrock (Ruby, Emerald; 5%)"],
    frlg: ["Ruin Valley (found there)"],
    dppt: [
      "Valor Lakefront (found there, Platinum)",
      "Mt. Coronet (found there, Platinum)",
      UNDERGROUND,
      "Held by wild Solrock (5%)",
    ],
    hgss: [
      "Route 13 (Camper Tanner gives you one now and then, once you have his phone number)",
      contest(false),
      pokeathlon("3,000", "Sunday, Monday, Friday", true),
      pickup("31–100"),
      "Held by wild Solrock (5%)",
    ],
  },
  "Shiny Stone": {
    dppt: [
      "Iron Island (found there)",
      "Route 228 (found there)",
      "Route 210 (found there, Platinum)",
      pickup("41–100"),
    ],
    hgss: [
      "National Park (found there)",
      "Route 14 (Bird Keeper Josh gives you one now and then, once you have his phone number)",
      contest(true),
      pokeathlon("3,000", "Sunday, Monday, Wednesday, Thursday, Saturday", true),
    ],
  },
  "Dusk Stone": {
    dppt: [
      "Veilstone City (Galactic Warehouse)",
      "Victory Road (found there)",
      "Wayward Cave (found there, Platinum)",
      pickup("31–100"),
    ],
    hgss: [
      "Cerulean Cave (found there)",
      "Route 17 (Biker Reese gives you one now and then, once you have his phone number)",
      contest(true),
      pokeathlon("3,000", "Monday, Tuesday, Thursday, Friday, Saturday", true),
    ],
  },
  "Dawn Stone": {
    dppt: [
      "Mt. Coronet (found there)",
      "Route 225 (found there)",
      "Route 212 (found there, Platinum)",
      pickup("51–100"),
    ],
    hgss: [
      "Mt. Silver (found in the cave)",
      "Saffron City (Silph Co.: held by the Beldum you get in a trade there)",
      "Route 17 (Biker Aiden gives you one now and then, once you have his phone number)",
      contest(true),
      pokeathlon("3,000", "Tuesday, Wednesday, Friday, Saturday", true),
    ],
  },
  "Oval Stone": {
    dppt: ["Lost Tower (found there)", "Held by wild Happiny and Chansey (50%)"],
    hgss: [
      "Rock Tunnel (found there)",
      "Route 15 (Twins Kay & Tia give you one now and then, once you have their phone number)",
      contest(true),
      "Held by wild Chansey (50%)",
    ],
  },
  "Kings Rock": {
    rse: [
      "Mossdeep City",
      "Battle Tower (Ruby and Sapphire: a prize for a 35-win streak)",
      "Battle Frontier (Emerald: 64 BP)",
      pickup("11–30, Emerald"),
      "Held by wild Hariyama (5%)",
    ],
    frlg: ["Sevault Canyon (found there)", "Trainer Tower (prize for beating Mixed Mode)"],
    dppt: ["Celestic Town (found there, Platinum)", pickup("11–30"), "Held by wild Poliwhirl (5%)"],
    hgss: [
      "Slowpoke Well (found there)",
      pokeathlon("3,000", "Sunday, Monday, Thursday"),
      pickup("11–30"),
      "Held by wild Slowbro and Poliwhirl (5%)",
    ],
  },
  "Metal Coat": {
    rse: ["Held by wild Magnemite and Magneton (5%)"],
    frlg: ["Memorial Pillar (found there)", "Trainer Tower (prize for beating Knockout Mode)"],
    dppt: [
      "Iron Island (from Byron; another found there in Platinum)",
      "Held by wild Magnemite, Magneton (Platinum), Steelix, Beldum, Bronzor and Bronzong (5%)",
    ],
    hgss: [
      "S.S. Aqua",
      "Power Plant (held by the Magneton you get in a trade there)",
      pokeathlon("2,500", "Tuesday, Friday, Saturday"),
      "Held by wild Magnemite, Magneton, Steelix, Beldum, Metang, Bronzor and Bronzong (5%)",
    ],
  },
  "Dragon Scale": {
    rse: ["Held by wild Horsea and Bagon (5%)"],
    frlg: ["Water Path (found there)", "Trainer Tower (prize for beating Double Mode)"],
    dppt: ["Held by wild Horsea, Seadra, Dratini and Dragonair (5%)"],
    hgss: [
      "Mt. Mortar (found there)",
      pokeathlon("2,500", "Wednesday, Friday", true),
      "Held by wild Horsea, Seadra, Dratini and Dragonair (5%)",
    ],
  },
  "Up Grade": {
    frlg: ["Rocket Warehouse (Five Island, found there)", "Trainer Tower (prize for beating Single Mode)"],
    dppt: [
      "Eterna City",
      "Route 224 (found there, Platinum)",
      "Eterna City (Team Galactic's building, Platinum)",
    ],
    hgss: ["Saffron City (Silph Co.)"],
  },
  "Deep Sea Tooth": {
    rse: ["Slateport City (Capt. Stern gives you this or a Deep Sea Scale for the Scanner from the Abandoned Ship)"],
    dppt: ["Held by wild Carvanha and Sharpedo (5%)"],
    hgss: ["Route 20 (found there)"],
  },
  "Deep Sea Scale": {
    rse: ["Slateport City (Capt. Stern gives you this or a Deep Sea Tooth for the Scanner from the Abandoned Ship)"],
    dppt: ["Held by wild Chinchou, Lanturn and Relicanth (5%)"],
    hgss: ["Route 20 (found there)", "Held by wild Chinchou, Lanturn and Relicanth (5%)"],
  },
  "Razor Claw": {
    dppt: [
      "Route 224 (found there)",
      "Victory Road (found there)",
      "Veilstone City (Team Galactic HQ, Platinum)",
      "Battle Park (Diamond and Pearl: 48 BP)",
      "Battle Frontier (Platinum: 48 BP)",
    ],
    hgss: ["Battle Frontier (48 BP)"],
  },
  "Razor Fang": {
    dppt: [
      "Battle Park (Diamond and Pearl: found there, or 48 BP)",
      "Route 214 (found there, Platinum)",
      "Route 225 (found there, Platinum)",
      "Battle Frontier (Platinum: 48 BP)",
    ],
    hgss: ["Battle Frontier (48 BP)"],
  },
  "Protector": {
    dppt: ["Route 228 (found there)", "Iron Island (found there, Platinum)"],
    hgss: ["Mt. Mortar (found there)"],
  },
  "Electirizer": {
    dppt: [
      "Valley Windworks (found there, Platinum)",
      "Held by wild Elekid (50% in Diamond, 5% in Pearl) and Electabuzz (Platinum, 5%)",
    ],
    hgss: ["Cerulean Cave (found there)"],
  },
  "Magmarizer": {
    dppt: [
      "Route 214 (found there, Platinum)",
      "Held by wild Magby (5% in Diamond, 50% in Pearl) and Magmar (Platinum, 5%)",
    ],
    hgss: ["Cinnabar Island (found there)"],
  },
  "Dubious Disc": {
    dppt: ["Route 225 (found there)", "Veilstone City (Team Galactic HQ, Platinum)"],
    hgss: ["Route 42 (found there)"],
  },
  "Reaper Cloth": {
    dppt: ["Route 229 (found there)", "Acuity Lakefront (found there, Platinum)", "Turnback Cave"],
    hgss: ["Mt. Silver (found there)"],
  },
};

/** How the item is written for people. */
export const EVOLUTION_ITEM_NAMES: Record<string, string> = {
  "Kings Rock": "King's Rock",
  "Up Grade": "Up-Grade",
};
