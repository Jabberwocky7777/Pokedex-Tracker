import type { VersionGroup } from "./move-fetch";

type TmLocationMap = Record<string, Partial<Record<VersionGroup, string>>>;

// ── Gen III TM/HM locations ───────────────────────────────────────────────────

export const GEN3_TM_LOCATIONS: TmLocationMap = {
  // TM01 Focus Punch
  "focus-punch": {
    "ruby-sapphire":     "Sootopolis City (given by a resident)",
    "emerald":           "Sootopolis City (given by a resident)",
    "firered-leafgreen": "Mt. Ember (found in cave)",
  },
  // TM02 Dragon Claw
  "dragon-claw": {
    "ruby-sapphire":     "Meteor Falls (found in cave)",
    "emerald":           "Meteor Falls (found in cave)",
    "firered-leafgreen": "Victory Road (found in cave)",
  },
  // TM03 Water Pulse
  "water-pulse": {
    "ruby-sapphire":     "Sootopolis City Gym (reward from Wallace)",
    "emerald":           "Sootopolis City Gym (reward from Wallace)",
    "firered-leafgreen": "Cerulean City Gym (reward from Misty)",
  },
  // TM04 Calm Mind
  "calm-mind": {
    "ruby-sapphire":     "Mossdeep City Gym (reward from Tate & Liza)",
    "emerald":           "Mossdeep City Gym (reward from Tate & Liza)",
    "firered-leafgreen": "Saffron City Gym (reward from Sabrina)",
  },
  // TM05 Roar
  "roar": {
    "ruby-sapphire":     "Route 114 (found on ground)",
    "emerald":           "Route 114 (found on ground)",
    "firered-leafgreen": "Route 36 (found on ground) / Pokémon Tower",
  },
  // TM06 Toxic
  "toxic": {
    "ruby-sapphire":     "Fiery Path (found in cave)",
    "emerald":           "Fiery Path (found in cave)",
    "firered-leafgreen": "Fuchsia City Gym (reward from Koga)",
  },
  // TM07 Hail
  "hail": {
    "ruby-sapphire":     "Shoal Cave (found in ice cave)",
    "emerald":           "Shoal Cave (found in ice cave)",
    "firered-leafgreen": "Icefall Cave (found in cave)",
  },
  // TM08 Bulk Up
  "bulk-up": {
    "ruby-sapphire":     "Dewford Town Gym (reward from Brawly)",
    "emerald":           "Dewford Town Gym (reward from Brawly)",
    "firered-leafgreen": "Silph Co. (found in building)",
  },
  // TM09 Bullet Seed
  "bullet-seed": {
    "ruby-sapphire":     "Route 104 (found on ground)",
    "emerald":           "Route 104 (found on ground)",
    "firered-leafgreen": "Berry Forest (found in cave)",
  },
  // TM10 Hidden Power
  "hidden-power": {
    "ruby-sapphire":     "Slateport City / Fortree City (purchase, ¥3,000)",
    "emerald":           "Slateport City / Fortree City (purchase, ¥3,000)",
    "firered-leafgreen": "Celadon Dept. Store 4F (purchase, ¥3,000)",
  },
  // TM11 Sunny Day
  "sunny-day": {
    "ruby-sapphire":     "Scorched Slab (found in cave)",
    "emerald":           "Scorched Slab (found in cave)",
    "firered-leafgreen": "Mt. Ember (found in cave)",
  },
  // TM12 Taunt
  "taunt": {
    "ruby-sapphire":     "Slateport City / Fortree City (purchase, ¥3,000)",
    "emerald":           "Slateport City / Fortree City (purchase, ¥3,000)",
    "firered-leafgreen": "Celadon Dept. Store 4F (purchase, ¥3,000)",
  },
  // TM13 Ice Beam
  "ice-beam": {
    "ruby-sapphire":     "Abandoned Ship (found in ship) / Slateport City (purchase, ¥5,500)",
    "emerald":           "Abandoned Ship (found in ship) / Mauville City Game Corner (10,000 coins)",
    "firered-leafgreen": "Celadon City Game Corner (4,000 coins)",
  },
  // TM14 Blizzard
  "blizzard": {
    "ruby-sapphire":     "Slateport City / Lilycove City Dept. Store (purchase, ¥5,500)",
    "emerald":           "Lilycove City Dept. Store (purchase, ¥5,500)",
    "firered-leafgreen": "Celadon Dept. Store 4F (purchase, ¥5,500)",
  },
  // TM15 Hyper Beam
  "hyper-beam": {
    "ruby-sapphire":     "Lilycove City Dept. Store (purchase, ¥7,500)",
    "emerald":           "Lilycove City Dept. Store (purchase, ¥7,500)",
    "firered-leafgreen": "Celadon Dept. Store 4F (purchase, ¥7,500)",
  },
  // TM16 Light Screen
  "light-screen": {
    "ruby-sapphire":     "Slateport City / Lilycove City Dept. Store (purchase, ¥3,000)",
    "emerald":           "Lilycove City Dept. Store (purchase, ¥3,000)",
    "firered-leafgreen": "Celadon Dept. Store 4F (purchase, ¥3,000)",
  },
  // TM17 Protect
  "protect": {
    "ruby-sapphire":     "Slateport City / Lilycove City Dept. Store (purchase, ¥3,000)",
    "emerald":           "Lilycove City Dept. Store (purchase, ¥3,000)",
    "firered-leafgreen": "Celadon Dept. Store 4F (purchase, ¥3,000)",
  },
  // TM18 Rain Dance
  "rain-dance": {
    "ruby-sapphire":     "Abandoned Ship (found in ship)",
    "emerald":           "Abandoned Ship (found in ship)",
    "firered-leafgreen": "Vermilion City (found in house)",
  },
  // TM19 Giga Drain
  "giga-drain": {
    "ruby-sapphire":     "Route 123 (found on ground)",
    "emerald":           "Route 123 (found on ground)",
    "firered-leafgreen": "Celadon City Gym (reward from Erika)",
  },
  // TM20 Safeguard
  "safeguard": {
    "ruby-sapphire":     "Slateport City / Lilycove City Dept. Store (purchase, ¥3,000)",
    "emerald":           "Lilycove City Dept. Store (purchase, ¥3,000)",
    "firered-leafgreen": "Celadon Dept. Store 4F (purchase, ¥3,000)",
  },
  // TM21 Frustration
  "frustration": {
    "ruby-sapphire":     "Pacifidlog Town (given by a resident, low friendship)",
    "emerald":           "Pacifidlog Town (given by a resident, low friendship)",
    "firered-leafgreen": "Saffron City (given by a resident, low friendship)",
  },
  // TM22 Solar Beam
  "solar-beam": {
    "ruby-sapphire":     "Safari Zone (found in tall grass)",
    "emerald":           "Safari Zone (found in tall grass)",
    "firered-leafgreen": "Pokémon Mansion (found in building)",
  },
  // TM23 Iron Tail
  "iron-tail": {
    "ruby-sapphire":     "Meteor Falls (found in cave)",
    "emerald":           "Meteor Falls (found in cave)",
    "firered-leafgreen": "Silence Bridge / Pewter City Museum (given by a character)",
  },
  // TM24 Thunderbolt
  "thunderbolt": {
    "ruby-sapphire":     "Mauville City Gym (reward from Wattson) / Mauville City Game Corner (4,000 coins)",
    "emerald":           "Mauville City Gym (reward from Wattson) / Mauville City Game Corner (4,000 coins)",
    "firered-leafgreen": "Celadon City Game Corner (4,000 coins)",
  },
  // TM25 Thunder
  "thunder": {
    "ruby-sapphire":     "Slateport City / Lilycove City Dept. Store (purchase, ¥5,500)",
    "emerald":           "Lilycove City Dept. Store (purchase, ¥5,500)",
    "firered-leafgreen": "Celadon Dept. Store 4F (purchase, ¥5,500)",
  },
  // TM26 Earthquake
  "earthquake": {
    "ruby-sapphire":     "Seafloor Cavern (found in cave)",
    "emerald":           "Seafloor Cavern (found in cave)",
    "firered-leafgreen": "Viridian City Gym (reward from Giovanni)",
  },
  // TM27 Return
  "return": {
    "ruby-sapphire":     "Pacifidlog Town (given by a resident, high friendship)",
    "emerald":           "Pacifidlog Town (given by a resident, high friendship)",
    "firered-leafgreen": "Saffron City (given by a resident, high friendship)",
  },
  // TM28 Dig
  "dig": {
    "ruby-sapphire":     "Route 114 (given by a character)",
    "emerald":           "Route 114 (given by a character)",
    "firered-leafgreen": "Cerulean City (given by a character)",
  },
  // TM29 Psychic
  "psychic": {
    "ruby-sapphire":     "Mauville City Game Corner (3,500 coins) / Victory Road (found in cave)",
    "emerald":           "Mauville City Game Corner (3,500 coins) / Victory Road (found in cave)",
    "firered-leafgreen": "Saffron City (given by a character) / Celadon City Game Corner (3,500 coins)",
  },
  // TM30 Shadow Ball
  "shadow-ball": {
    "ruby-sapphire":     "Mt. Pyre (found on mountain)",
    "emerald":           "Mt. Pyre (found on mountain)",
    "firered-leafgreen": "Lavender Town (Pokémon Tower, given by Mr. Fuji)",
  },
  // TM31 Brick Break
  "brick-break": {
    "ruby-sapphire":     "Sootopolis City (given by a character)",
    "emerald":           "Sootopolis City (given by a character)",
    "firered-leafgreen": "Silph Co. (found in building)",
  },
  // TM32 Double Team
  "double-team": {
    "ruby-sapphire":     "Slateport City / Mauville City Game Corner (1,500 coins)",
    "emerald":           "Mauville City Game Corner (1,500 coins)",
    "firered-leafgreen": "Celadon City Game Corner (1,500 coins)",
  },
  // TM33 Reflect
  "reflect": {
    "ruby-sapphire":     "Slateport City / Lilycove City Dept. Store (purchase, ¥3,000)",
    "emerald":           "Lilycove City Dept. Store (purchase, ¥3,000)",
    "firered-leafgreen": "Celadon Dept. Store 4F (purchase, ¥3,000)",
  },
  // TM34 Shock Wave
  "shock-wave": {
    "ruby-sapphire":     "Mauville City Gym (reward from Wattson)",
    "emerald":           "Mauville City Gym (reward from Wattson)",
    "firered-leafgreen": "Cerulean City Gym (reward from Misty)",
  },
  // TM35 Flamethrower
  "flamethrower": {
    "ruby-sapphire":     "Fallarbor Town (from Battleground prize) / Mt. Chimney (cable car reward)",
    "emerald":           "Fallarbor Town (from Battleground prize)",
    "firered-leafgreen": "Celadon City Game Corner (4,000 coins)",
  },
  // TM36 Sludge Bomb
  "sludge-bomb": {
    "ruby-sapphire":     "Dewford Town (given by a character)",
    "emerald":           "Dewford Town (given by a character)",
    "firered-leafgreen": "Team Rocket Hideout (found in building)",
  },
  // TM37 Sandstorm
  "sandstorm": {
    "ruby-sapphire":     "Route 111 (found on ground) / Slateport City",
    "emerald":           "Route 111 (found on ground)",
    "firered-leafgreen": "Four Island (found on ground)",
  },
  // TM38 Fire Blast
  "fire-blast": {
    "ruby-sapphire":     "Lilycove City Dept. Store (purchase, ¥5,500)",
    "emerald":           "Lilycove City Dept. Store (purchase, ¥5,500)",
    "firered-leafgreen": "Celadon Dept. Store 4F (purchase, ¥5,500)",
  },
  // TM39 Rock Tomb
  "rock-tomb": {
    "ruby-sapphire":     "Rustboro City Gym (reward from Roxanne)",
    "emerald":           "Rustboro City Gym (reward from Roxanne)",
    "firered-leafgreen": "Rock Tunnel (found in cave)",
  },
  // TM40 Aerial Ace
  "aerial-ace": {
    "ruby-sapphire":     "Fortree City Gym (reward from Winona)",
    "emerald":           "Fortree City Gym (reward from Winona)",
    "firered-leafgreen": "Fuchsia City Gym (reward from Koga)",
  },
  // TM41 Torment
  "torment": {
    "ruby-sapphire":     "Slateport City / Fortree City (purchase, ¥3,000)",
    "emerald":           "Slateport City / Fortree City (purchase, ¥3,000)",
    "firered-leafgreen": "Celadon Dept. Store 4F (purchase, ¥3,000)",
  },
  // TM42 Facade
  "facade": {
    "ruby-sapphire":     "Petalburg City Gym (reward from Norman)",
    "emerald":           "Petalburg City Gym (reward from Norman)",
    "firered-leafgreen": "Pewter City Gym (reward from Brock)",
  },
  // TM43 Secret Power
  "secret-power": {
    "ruby-sapphire":     "Route 111 (given by a character)",
    "emerald":           "Route 111 (given by a character)",
    "firered-leafgreen": "Route 26 (found on ground)",
  },
  // TM44 Rest
  "rest": {
    "ruby-sapphire":     "Lilycove City Dept. Store (purchase, ¥3,000)",
    "emerald":           "Lilycove City Dept. Store (purchase, ¥3,000)",
    "firered-leafgreen": "Celadon Dept. Store 4F (purchase, ¥3,000)",
  },
  // TM45 Attract
  "attract": {
    "ruby-sapphire":     "Verdanturf Town (given by a character)",
    "emerald":           "Verdanturf Town (given by a character)",
    "firered-leafgreen": "Celadon Dept. Store 4F (purchase, ¥3,000)",
  },
  // TM46 Thief
  "thief": {
    "ruby-sapphire":     "Slateport City / Fortree City (purchase, ¥3,000)",
    "emerald":           "Slateport City / Fortree City (purchase, ¥3,000)",
    "firered-leafgreen": "Celadon Dept. Store 4F (purchase, ¥3,000)",
  },
  // TM47 Steel Wing
  "steel-wing": {
    "ruby-sapphire":     "Granite Cave (found in cave)",
    "emerald":           "Granite Cave (found in cave)",
    "firered-leafgreen": "Rock Tunnel (found in cave)",
  },
  // TM48 Skill Swap
  "skill-swap": {
    "ruby-sapphire":     "Slateport City / Fortree City (purchase, ¥3,000)",
    "emerald":           "Slateport City / Fortree City (purchase, ¥3,000)",
    "firered-leafgreen": "Celadon Dept. Store 4F (purchase, ¥3,000)",
  },
  // TM49 Snatch
  "snatch": {
    "ruby-sapphire":     "S.S. Tidal (found on ship)",
    "emerald":           "S.S. Tidal (found on ship)",
    "firered-leafgreen": "Team Rocket Hideout (found in building)",
  },
  // TM50 Overheat
  "overheat": {
    "ruby-sapphire":     "Lavaridge Town Gym (reward from Flannery)",
    "emerald":           "Lavaridge Town Gym (reward from Flannery)",
    "firered-leafgreen": "Cinnabar Island Gym (reward from Blaine)",
  },
  // HM01 Cut
  "cut": {
    "ruby-sapphire":     "Rustboro City (given by the Captain after rescuing him)",
    "emerald":           "Rustboro City (given by the Captain after rescuing him)",
    "firered-leafgreen": "S.S. Anne (given by the Captain)",
  },
  // HM02 Fly
  "fly": {
    "ruby-sapphire":     "Route 119 (found on ground)",
    "emerald":           "Route 119 (found on ground)",
    "firered-leafgreen": "Route 16 (given by a character)",
  },
  // HM03 Surf
  "surf": {
    "ruby-sapphire":     "Petalburg City (given by Wally's father after defeating Norman)",
    "emerald":           "Petalburg City (given by Wally's father after defeating Norman)",
    "firered-leafgreen": "Safari Zone (given by the Warden)",
  },
  // HM04 Strength
  "strength": {
    "ruby-sapphire":     "Rustboro City (given by a character in the Cutter's House)",
    "emerald":           "Rustboro City (given by a character in the Cutter's House)",
    "firered-leafgreen": "Fuchsia City (given by the Safari Zone Warden)",
  },
  // HM05 Flash
  "flash": {
    "ruby-sapphire":     "Granite Cave (given by a character at the entrance)",
    "emerald":           "Granite Cave (given by a character at the entrance)",
    "firered-leafgreen": "Route 2 (given by Prof. Oak's Aide)",
  },
  // HM06 Rock Smash
  "rock-smash": {
    "ruby-sapphire":     "Mauville City (given by a character)",
    "emerald":           "Mauville City (given by a character)",
    "firered-leafgreen": "One Island (given by a character)",
  },
  // HM07 Waterfall
  "waterfall": {
    "ruby-sapphire":     "Cave of Origin (found in cave)",
    "emerald":           "Cave of Origin (found in cave)",
    "firered-leafgreen": "Icefall Cave (found in cave)",
  },
  // HM08 Dive
  "dive": {
    "ruby-sapphire":     "Mossdeep City (given by Steven Stone)",
    "emerald":           "Mossdeep City (given by Steven Stone)",
    "firered-leafgreen": "Not available",
  },
};

// ── Gen IV TM/HM locations ────────────────────────────────────────────────────

export const GEN4_TM_LOCATIONS: TmLocationMap = {
  // TM01 Focus Punch
  "focus-punch": {
    "diamond-pearl":        "Oreburgh Gate B1F (found in cave)",
    "platinum":             "Oreburgh Gate B1F (found in cave)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM02 Dragon Claw
  "dragon-claw": {
    "diamond-pearl":        "Mt. Coronet 2F (found in cave)",
    "platinum":             "Mt. Coronet 2F (found in cave)",
    "heartgold-soulsilver": "Victory Road (found in cave)",
  },
  // TM03 Water Pulse
  "water-pulse": {
    "diamond-pearl":        "Pastoria City Gym (reward from Crasher Wake)",
    "platinum":             "Pastoria City Gym (reward from Crasher Wake)",
    "heartgold-soulsilver": "Cerulean City Gym (reward from Misty)",
  },
  // TM04 Calm Mind
  "calm-mind": {
    "diamond-pearl":        "Veilstone City Gym (reward from Maylene)",
    "platinum":             "Veilstone City Gym (reward from Maylene)",
    "heartgold-soulsilver": "Saffron City Gym (reward from Sabrina)",
  },
  // TM05 Roar
  "roar": {
    "diamond-pearl":        "Route 213 (found on ground)",
    "platinum":             "Route 213 (found on ground)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,000)",
  },
  // TM06 Toxic
  "toxic": {
    "diamond-pearl":        "Pastoria City (found on ground near the Great Marsh)",
    "platinum":             "Pastoria City (found on ground near the Great Marsh)",
    "heartgold-soulsilver": "Fuchsia City Gym (reward from Janine)",
  },
  // TM07 Hail
  "hail": {
    "diamond-pearl":        "Snowpoint City (purchase in Pokémart, ¥2,000)",
    "platinum":             "Snowpoint City (purchase in Pokémart, ¥2,000)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥2,000)",
  },
  // TM08 Bulk Up
  "bulk-up": {
    "diamond-pearl":        "Veilstone City Gym (reward from Maylene)",
    "platinum":             "Veilstone City Gym (reward from Maylene)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM09 Bullet Seed
  "bullet-seed": {
    "diamond-pearl":        "Route 204 (found on ground)",
    "platinum":             "Route 204 (found on ground)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥2,000)",
  },
  // TM10 Hidden Power
  "hidden-power": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM11 Sunny Day
  "sunny-day": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥2,000)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥2,000)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥2,000)",
  },
  // TM12 Taunt
  "taunt": {
    "diamond-pearl":        "Veilstone City (found in warehouse)",
    "platinum":             "Veilstone City (found in warehouse)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,500)",
  },
  // TM13 Ice Beam
  "ice-beam": {
    "diamond-pearl":        "Route 216 (found on ground)",
    "platinum":             "Route 216 (found on ground)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 5F (purchase, ¥5,500)",
  },
  // TM14 Blizzard
  "blizzard": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥5,500)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥5,500)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 5F (purchase, ¥5,500)",
  },
  // TM15 Hyper Beam
  "hyper-beam": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥7,500)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥7,500)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 5F (purchase, ¥7,500)",
  },
  // TM16 Light Screen
  "light-screen": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM17 Protect
  "protect": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM18 Rain Dance
  "rain-dance": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥2,000)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥2,000)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥2,000)",
  },
  // TM19 Giga Drain
  "giga-drain": {
    "diamond-pearl":        "Route 209 (found on ground)",
    "platinum":             "Route 209 (found on ground)",
    "heartgold-soulsilver": "Celadon City Gym (reward from Erika)",
  },
  // TM20 Safeguard
  "safeguard": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM21 Frustration
  "frustration": {
    "diamond-pearl":        "Pokémon Center (given by a lady, low friendship)",
    "platinum":             "Pokémon Center (given by a lady, low friendship)",
    "heartgold-soulsilver": "Goldenrod City (given by a lady, low friendship)",
  },
  // TM22 Solar Beam
  "solar-beam": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 5F (purchase, ¥3,000)",
  },
  // TM23 Iron Tail
  "iron-tail": {
    "diamond-pearl":        "Iron Island (given by Riley)",
    "platinum":             "Iron Island (given by Riley)",
    "heartgold-soulsilver": "Olivine City (given by a character)",
  },
  // TM24 Thunderbolt
  "thunderbolt": {
    "diamond-pearl":        "Veilstone City Game Corner (10,000 coins)",
    "platinum":             "Sunyshore City Gym (reward from Volkner)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 5F (purchase, ¥5,500)",
  },
  // TM25 Thunder
  "thunder": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥5,500)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥5,500)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 5F (purchase, ¥5,500)",
  },
  // TM26 Earthquake
  "earthquake": {
    "diamond-pearl":        "Wayward Cave B1F (found in cave)",
    "platinum":             "Wayward Cave B1F (found in cave)",
    "heartgold-soulsilver": "Victory Road (found in cave)",
  },
  // TM27 Return
  "return": {
    "diamond-pearl":        "Pokémon Center (given by a lady, high friendship)",
    "platinum":             "Pokémon Center (given by a lady, high friendship)",
    "heartgold-soulsilver": "Goldenrod City (given by a lady, high friendship)",
  },
  // TM28 Dig
  "dig": {
    "diamond-pearl":        "Route 214 (found on ground)",
    "platinum":             "Route 214 (found on ground)",
    "heartgold-soulsilver": "National Park (found on ground)",
  },
  // TM29 Psychic
  "psychic": {
    "diamond-pearl":        "Veilstone City Game Corner (10,000 coins)",
    "platinum":             "Route 211 (found on ground) / Veilstone Game Corner",
    "heartgold-soulsilver": "Saffron City (given by a character)",
  },
  // TM30 Shadow Ball
  "shadow-ball": {
    "diamond-pearl":        "Route 210 (found on ground)",
    "platinum":             "Route 210 (found on ground)",
    "heartgold-soulsilver": "Ecruteak City Gym (reward from Morty)",
  },
  // TM31 Brick Break
  "brick-break": {
    "diamond-pearl":        "Oreburgh Gate 1F (found in cave)",
    "platinum":             "Oreburgh Gate 1F (found in cave)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM32 Double Team
  "double-team": {
    "diamond-pearl":        "Veilstone City Game Corner (1,500 coins)",
    "platinum":             "Veilstone City Game Corner (1,500 coins)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,000)",
  },
  // TM33 Reflect
  "reflect": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM34 Shock Wave
  "shock-wave": {
    "diamond-pearl":        "Veilstone City Game Corner (3,500 coins)",
    "platinum":             "Pastoria City (given by a character)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,500)",
  },
  // TM35 Flamethrower
  "flamethrower": {
    "diamond-pearl":        "Fuego Ironworks (found inside)",
    "platinum":             "Fuego Ironworks (found inside)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 5F (purchase, ¥5,500)",
  },
  // TM36 Sludge Bomb
  "sludge-bomb": {
    "diamond-pearl":        "Pastoria City (found near the Great Marsh)",
    "platinum":             "Pastoria City (found near the Great Marsh)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM37 Sandstorm
  "sandstorm": {
    "diamond-pearl":        "Route 228 (found on ground)",
    "platinum":             "Route 228 (found on ground)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥2,000)",
  },
  // TM38 Fire Blast
  "fire-blast": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥5,500)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥5,500)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 5F (purchase, ¥5,500)",
  },
  // TM39 Rock Tomb
  "rock-tomb": {
    "diamond-pearl":        "Oreburgh City Gym (reward from Roark)",
    "platinum":             "Oreburgh City Gym (reward from Roark)",
    "heartgold-soulsilver": "Mt. Moon Square (found on ground)",
  },
  // TM40 Aerial Ace
  "aerial-ace": {
    "diamond-pearl":        "Route 213 (found on ground)",
    "platinum":             "Route 213 (found on ground)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM41 Torment
  "torment": {
    "diamond-pearl":        "Veilstone City (found in warehouse)",
    "platinum":             "Veilstone City (found in warehouse)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,500)",
  },
  // TM42 Facade
  "facade": {
    "diamond-pearl":        "Route 209 (found on ground)",
    "platinum":             "Route 209 (found on ground)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM43 Secret Power
  "secret-power": {
    "diamond-pearl":        "Amity Square (found inside)",
    "platinum":             "Route 212 (given by a character)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM44 Rest
  "rest": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM45 Attract
  "attract": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,000)",
  },
  // TM46 Thief
  "thief": {
    "diamond-pearl":        "Eterna City (found in building)",
    "platinum":             "Eterna City (found in building)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,500)",
  },
  // TM47 Steel Wing
  "steel-wing": {
    "diamond-pearl":        "Iron Island (found in cave)",
    "platinum":             "Iron Island (found in cave)",
    "heartgold-soulsilver": "Victory Road (found in cave)",
  },
  // TM48 Skill Swap
  "skill-swap": {
    "diamond-pearl":        "Veilstone City Game Corner (6,000 coins)",
    "platinum":             "Veilstone City Game Corner (6,000 coins)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM49 Snatch
  "snatch": {
    "diamond-pearl":        "Veilstone City (found in warehouse)",
    "platinum":             "Veilstone City (found in warehouse)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM50 Overheat
  "overheat": {
    "diamond-pearl":        "Stark Mountain (found inside)",
    "platinum":             "Stark Mountain (found inside)",
    "heartgold-soulsilver": "Mt. Silver / Goldenrod Dept. Store 5F (purchase, ¥3,000)",
  },
  // TM51 Roost
  "roost": {
    "diamond-pearl":        "Route 210 (found on ground)",
    "platinum":             "Route 210 (found on ground)",
    "heartgold-soulsilver": "Route 28 (found on ground)",
  },
  // TM52 Focus Blast
  "focus-blast": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥5,500)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥5,500)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 5F (purchase, ¥5,500)",
  },
  // TM53 Energy Ball
  "energy-ball": {
    "diamond-pearl":        "Route 226 (found on ground)",
    "platinum":             "Route 226 (found on ground)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 5F (purchase, ¥3,000)",
  },
  // TM54 False Swipe
  "false-swipe": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥2,000)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥2,000)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥2,000)",
  },
  // TM55 Brine
  "brine": {
    "diamond-pearl":        "Pastoria City Gym (reward from Crasher Wake)",
    "platinum":             "Pastoria City Gym (reward from Crasher Wake)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM56 Fling
  "fling": {
    "diamond-pearl":        "Route 222 (found on ground)",
    "platinum":             "Route 222 (found on ground)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM57 Charge Beam
  "charge-beam": {
    "diamond-pearl":        "Sunyshore City Gym (reward from Volkner)",
    "platinum":             "Sunyshore City Gym (reward from Volkner)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM58 Endure
  "endure": {
    "diamond-pearl":        "Veilstone City Game Corner (1,000 coins)",
    "platinum":             "Veilstone City Game Corner (1,000 coins)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,000)",
  },
  // TM59 Dragon Pulse
  "dragon-pulse": {
    "diamond-pearl":        "Victory Road (found in cave)",
    "platinum":             "Victory Road (found in cave)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 5F (purchase, ¥3,000)",
  },
  // TM60 Drain Punch
  "drain-punch": {
    "diamond-pearl":        "Veilstone City Game Corner (8,000 coins)",
    "platinum":             "Veilstone City Game Corner (8,000 coins)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM61 Will-O-Wisp
  "will-o-wisp": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,000)",
  },
  // TM62 Silver Wind
  "silver-wind": {
    "diamond-pearl":        "Route 212 (found on ground)",
    "platinum":             "Route 212 (found on ground)",
    "heartgold-soulsilver": "National Park (prize for the Bug-Catching Contest)",
  },
  // TM63 Embargo
  "embargo": {
    "diamond-pearl":        "Veilstone City (found in warehouse)",
    "platinum":             "Veilstone City (found in warehouse)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,000)",
  },
  // TM64 Explosion
  "explosion": {
    "diamond-pearl":        "Mt. Coronet (found in cave)",
    "platinum":             "Mt. Coronet (found in cave)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 5F (purchase, ¥3,000)",
  },
  // TM65 Shadow Claw
  "shadow-claw": {
    "diamond-pearl":        "Hearthome City Gym (reward from Fantina)",
    "platinum":             "Hearthome City Gym (reward from Fantina)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM66 Payback
  "payback": {
    "diamond-pearl":        "Veilstone City (found in warehouse)",
    "platinum":             "Veilstone City (found in warehouse)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,500)",
  },
  // TM67 Recycle
  "recycle": {
    "diamond-pearl":        "Veilstone City Game Corner (1,000 coins)",
    "platinum":             "Veilstone City Game Corner (1,000 coins)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,000)",
  },
  // TM68 Giga Impact
  "giga-impact": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥7,500)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥7,500)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 5F (purchase, ¥7,500)",
  },
  // TM69 Rock Polish
  "rock-polish": {
    "diamond-pearl":        "Mt. Coronet (found in cave)",
    "platinum":             "Mt. Coronet (found in cave)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,500)",
  },
  // TM70 Flash
  "flash": {
    "diamond-pearl":        "Oreburgh Gate 1F (given by a character)",
    "platinum":             "Oreburgh Gate 1F (given by a character)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,000)",
  },
  // TM71 Stone Edge
  "stone-edge": {
    "diamond-pearl":        "Oreburgh City Gym (reward from Roark — post-National Dex) / Victory Road",
    "platinum":             "Victory Road (found in cave)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 5F (purchase, ¥5,500)",
  },
  // TM72 Avalanche
  "avalanche": {
    "diamond-pearl":        "Snowpoint City Gym (reward from Candice)",
    "platinum":             "Snowpoint City Gym (reward from Candice)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥2,000)",
  },
  // TM73 Thunder Wave
  "thunder-wave": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥1,000)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥1,000)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,000)",
  },
  // TM74 Gyro Ball
  "gyro-ball": {
    "diamond-pearl":        "Veilstone City Game Corner (15,000 coins)",
    "platinum":             "Veilstone City Game Corner (15,000 coins)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM75 Swords Dance
  "swords-dance": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,500)",
  },
  // TM76 Stealth Rock
  "stealth-rock": {
    "diamond-pearl":        "Oreburgh City Gym (reward from Roark)",
    "platinum":             "Oreburgh City Gym (reward from Roark)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥2,000)",
  },
  // TM77 Psych Up
  "psych-up": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥3,000)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,000)",
  },
  // TM78 Captivate
  "captivate": {
    "diamond-pearl":        "Route 213 (found on ground)",
    "platinum":             "Route 213 (found on ground)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,000)",
  },
  // TM79 Dark Pulse
  "dark-pulse": {
    "diamond-pearl":        "Victory Road (found in cave)",
    "platinum":             "Victory Road (found in cave)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 5F (purchase, ¥3,000)",
  },
  // TM80 Rock Slide
  "rock-slide": {
    "diamond-pearl":        "Mt. Coronet (found in cave)",
    "platinum":             "Mt. Coronet (found in cave)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM81 X-Scissor
  "x-scissor": {
    "diamond-pearl":        "Route 221 (found on ground)",
    "platinum":             "Route 221 (found on ground)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM82 Sleep Talk
  "sleep-talk": {
    "diamond-pearl":        "Veilstone City Game Corner (4,000 coins)",
    "platinum":             "Veilstone City Game Corner (4,000 coins)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,000)",
  },
  // TM83 Natural Gift
  "natural-gift": {
    "diamond-pearl":        "Veilstone Dept. Store 3F (purchase, ¥2,000)",
    "platinum":             "Veilstone Dept. Store 3F (purchase, ¥2,000)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥2,000)",
  },
  // TM84 Poison Jab
  "poison-jab": {
    "diamond-pearl":        "Route 212 (found on ground)",
    "platinum":             "Route 212 (found on ground)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM85 Dream Eater
  "dream-eater": {
    "diamond-pearl":        "Route 220 (found on ground)",
    "platinum":             "Route 220 (found on ground)",
    "heartgold-soulsilver": "Viridian City (given by a character)",
  },
  // TM86 Grass Knot
  "grass-knot": {
    "diamond-pearl":        "Eterna City Gym (reward from Gardenia)",
    "platinum":             "Eterna City Gym (reward from Gardenia)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM87 Swagger
  "swagger": {
    "diamond-pearl":        "Canalave City (found in building)",
    "platinum":             "Canalave City (found in building)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,000)",
  },
  // TM88 Pluck
  "pluck": {
    "diamond-pearl":        "Floaroma Town (given by a character)",
    "platinum":             "Floaroma Town (given by a character)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥2,000)",
  },
  // TM89 U-turn
  "u-turn": {
    "diamond-pearl":        "Canalave City Gym (reward from Byron)",
    "platinum":             "Canalave City Gym (reward from Byron)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM90 Substitute
  "substitute": {
    "diamond-pearl":        "Veilstone City Game Corner (2,000 coins)",
    "platinum":             "Veilstone City Game Corner (2,000 coins)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥3,000)",
  },
  // TM91 Flash Cannon
  "flash-cannon": {
    "diamond-pearl":        "Canalave City Gym (reward from Byron)",
    "platinum":             "Canalave City Gym (reward from Byron)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 5F (purchase, ¥3,000)",
  },
  // TM92 Trick Room
  "trick-room": {
    "diamond-pearl":        "Pokémon Mansion on Route 212 (given by Mr. Backlot)",
    "platinum":             "Pokémon Mansion on Route 212 (given by Mr. Backlot)",
    "heartgold-soulsilver": "Goldenrod Dept. Store 3F (purchase, ¥1,000)",
  },
  // HM01 Cut
  "cut": {
    "diamond-pearl":        "Eterna City (given by Cynthia)",
    "platinum":             "Eterna City (given by Cynthia)",
    "heartgold-soulsilver": "Ilex Forest (given by a character after catching the Farfetch'd)",
  },
  // HM02 Fly
  "fly": {
    "diamond-pearl":        "Team Galactic Warehouse, Veilstone City (found)",
    "platinum":             "Team Galactic Warehouse, Veilstone City (found)",
    "heartgold-soulsilver": "Chuck's wife, Cianwood City (given after defeating Chuck)",
  },
  // HM03 Surf
  "surf": {
    "diamond-pearl":        "Celestic Town (given by the elder after clearing the ruins)",
    "platinum":             "Celestic Town (given by the elder after clearing the ruins)",
    "heartgold-soulsilver": "Ecruteak City Dance Theatre (given by the Kimono Girls' Uncle)",
  },
  // HM04 Strength
  "strength": {
    "diamond-pearl":        "Lost Tower on Route 209 (given after completing the tower)",
    "platinum":             "Lost Tower on Route 209 (given after completing the tower)",
    "heartgold-soulsilver": "Olivine City (given by a sailor)",
  },
  // HM05 Defog (DPPt)
  "defog": {
    "diamond-pearl":        "Great Marsh (given by a character at the entrance)",
    "platinum":             "Great Marsh (given by a character at the entrance)",
  },
  // HM05 Whirlpool (HGSS)
  "whirlpool": {
    "heartgold-soulsilver": "Team Rocket HQ, Mahogany Town (given by Lance)",
  },
  // HM06 Rock Smash
  "rock-smash": {
    "diamond-pearl":        "Route 206 (given by a hiker)",
    "platinum":             "Route 206 (given by a hiker)",
    "heartgold-soulsilver": "Ruins of Alph (given by a character)",
  },
  // HM07 Waterfall
  "waterfall": {
    "diamond-pearl":        "Sunyshore City (given by Jasmine after clearing the lighthouse)",
    "platinum":             "Sunyshore City (given by Jasmine after clearing the lighthouse)",
    "heartgold-soulsilver": "Ice Path (found in ice cave)",
  },
  // HM08 Rock Climb
  "rock-climb": {
    "diamond-pearl":        "Route 217 (found in snowstorm route)",
    "platinum":             "Route 217 (found in snowstorm route)",
    "heartgold-soulsilver": "Professor Oak (given after defeating Red on Mt. Silver)",
  },
};
