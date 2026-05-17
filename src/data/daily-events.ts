export interface DailyPokemon {
  id: number;
  name: string;
  location: string;
  games?: string; // version restriction label, e.g. "D/P", "Pt", "Diamond"
  note?: string;  // extra info, e.g. "1%", "Always available"
}

export interface DailyEventSection {
  id: string;
  title: string;
  games: string;          // display label, e.g. "D/P/Pt"
  genIds: number[];       // which app activeGeneration values show this section
  versions: string[];     // game version slugs that have this section (matches GameVersion values)
  how: string;            // one-line tip shown below the tab bar
  pokemon: DailyPokemon[];
}

export const DAILY_EVENT_SECTIONS: DailyEventSection[] = [
  {
    id: 'swarm-sinnoh',
    title: 'Mass Outbreaks',
    games: 'D/P/Pt',
    genIds: [4],
    versions: ['diamond', 'pearl', 'platinum'],
    how: 'Check the Pokétch Map app or your TV at home for today\'s swarm route.',
    pokemon: [
      // D/P only
      { id: 16,  name: 'Pidgey',      location: 'Route 229',        games: 'D/P' },
      { id: 81,  name: 'Magnemite',   location: 'Fuego Ironworks',  games: 'D/P' },
      { id: 108, name: 'Lickitung',   location: 'Lake Valor',       games: 'D/P' },
      { id: 220, name: 'Swinub',      location: 'Route 217',        games: 'D/P' },
      { id: 225, name: 'Delibird',    location: 'Route 216',        games: 'D/P' },
      { id: 238, name: 'Smoochum',    location: 'Lake Acuity',      games: 'D/P' },
      { id: 283, name: 'Surskit',     location: 'Lake Verity',      games: 'D/P' },
      { id: 299, name: 'Nosepass',    location: 'Route 206',        games: 'D/P' },
      { id: 359, name: 'Absol',       location: 'Route 213',        games: 'D/P' },
      // Platinum only
      { id: 127, name: 'Pinsir',      location: 'Route 229',        games: 'Pt' },
      { id: 225, name: 'Delibird',    location: 'Route 217',        games: 'Pt' },
      { id: 246, name: 'Larvitar',    location: 'Route 206',        games: 'Pt' },
      // All three games (D/P + Pt)
      { id: 83,  name: "Farfetch'd",  location: 'Route 221' },
      { id: 84,  name: 'Doduo',       location: 'Route 201' },
      { id: 96,  name: 'Drowzee',     location: 'Route 215' },
      { id: 98,  name: 'Krabby',      location: 'Route 226' },
      { id: 100, name: 'Voltorb',     location: 'Route 218' },
      { id: 104, name: 'Cubone',      location: 'Route 203' },
      { id: 177, name: 'Natu',        location: 'Route 224' },
      { id: 206, name: 'Dunsparce',   location: 'Route 208' },
      { id: 209, name: 'Snubbull',    location: 'Route 209' },
      { id: 222, name: 'Corsola',     location: 'Route 230' },
      { id: 231, name: 'Phanpy',      location: 'Route 207' },
      { id: 263, name: 'Zigzagoon',   location: 'Route 202' },
      { id: 287, name: 'Slakoth',     location: 'Eterna Forest' },
      { id: 296, name: 'Makuhita',    location: 'Route 225' },
      { id: 300, name: 'Skitty',      location: 'Route 222' },
      { id: 309, name: 'Electrike',   location: 'Valley Windworks' },
      { id: 325, name: 'Spoink',      location: 'Route 214' },
      { id: 327, name: 'Spinda',      location: 'Route 227' },
      { id: 374, name: 'Beldum',      location: 'Route 228' },
    ],
  },
  {
    id: 'great-marsh',
    title: 'Great Marsh',
    games: 'D/P/Pt',
    genIds: [4],
    versions: ['diamond', 'pearl', 'platinum'],
    how: 'Use the binoculars at the entrance to see today\'s rotation before going in.',
    pokemon: [
      { id: 115, name: 'Kangaskhan', location: 'Great Marsh', note: 'After National Dex' },
      { id: 193, name: 'Yanma',      location: 'Great Marsh', games: 'D/Pt' },
      { id: 357, name: 'Tropius',    location: 'Great Marsh', games: 'P/Pt' },
      { id: 438, name: 'Bonsly',     location: 'Great Marsh', games: 'D/P' },
      { id: 439, name: 'Mime Jr.',   location: 'Great Marsh', games: 'D/P' },
      { id: 446, name: 'Munchlax',   location: 'Great Marsh', games: 'D/P' },
      { id: 285, name: 'Shroomish',  location: 'Great Marsh', games: 'Pt', note: 'After National Dex' },
      { id: 316, name: 'Gulpin',     location: 'Great Marsh', games: 'Pt', note: 'After National Dex' },
      { id: 352, name: 'Kecleon',    location: 'Great Marsh', games: 'Pt', note: 'After National Dex' },
      { id: 451, name: 'Skorupi',    location: 'Great Marsh', games: 'Pt' },
      { id: 455, name: 'Carnivine',  location: 'Great Marsh', note: 'Always available' },
    ],
  },
  {
    id: 'trophy-garden',
    title: 'Trophy Garden',
    games: 'D/P/Pt',
    genIds: [4],
    versions: ['diamond', 'pearl', 'platinum'],
    how: 'D/P: Save before talking to Mr. Backlot — reset until he mentions the one you need. Pt: Pokémon rotate daily; 2 of 16 are active at a time.',
    pokemon: [
      // Daily via Backlot (all games)
      { id: 113, name: 'Chansey',    location: 'Trophy Garden', note: 'Daily via Backlot' },
      { id: 173, name: 'Cleffa',     location: 'Trophy Garden', note: 'Daily via Backlot' },
      { id: 174, name: 'Igglybuff',  location: 'Trophy Garden', note: 'Daily via Backlot' },
      { id: 183, name: 'Marill',     location: 'Trophy Garden', note: 'Daily via Backlot' },
      { id: 351, name: 'Castform',   location: 'Trophy Garden', note: 'Daily via Backlot' },
      { id: 438, name: 'Bonsly',     location: 'Trophy Garden', note: 'Daily via Backlot' },
      { id: 439, name: 'Mime Jr.',   location: 'Trophy Garden', note: 'Daily via Backlot' },
      { id: 440, name: 'Happiny',    location: 'Trophy Garden', note: 'Daily via Backlot' },
      // Daily via Backlot (Platinum only — also "Always" in D/P)
      { id: 35,  name: 'Clefairy',   location: 'Trophy Garden', games: 'Pt', note: 'Daily via Backlot' },
      { id: 39,  name: 'Jigglypuff', location: 'Trophy Garden', games: 'Pt', note: 'Daily via Backlot' },
      { id: 52,  name: 'Meowth',     location: 'Trophy Garden', games: 'Pt', note: 'Daily via Backlot' },
      { id: 133, name: 'Eevee',      location: 'Trophy Garden', games: 'Pt', note: 'Daily via Backlot' },
      { id: 132, name: 'Ditto',      location: 'Trophy Garden', games: 'Pt', note: 'Daily via Backlot' },
      { id: 298, name: 'Azurill',    location: 'Trophy Garden', games: 'Pt', note: 'Daily via Backlot' },
      { id: 311, name: 'Plusle',     location: 'Trophy Garden', games: 'Pt', note: 'Daily via Backlot' },
      { id: 312, name: 'Minun',      location: 'Trophy Garden', games: 'Pt', note: 'Daily via Backlot' },
      // Always available (all games)
      { id: 25,  name: 'Pikachu',    location: 'Trophy Garden', note: 'Always' },
      { id: 172, name: 'Pichu',      location: 'Trophy Garden', note: 'Always' },
      // Always available (D/P only — daily rotation in Pt)
      { id: 35,  name: 'Clefairy',   location: 'Trophy Garden', games: 'D/P', note: 'Always' },
      { id: 39,  name: 'Jigglypuff', location: 'Trophy Garden', games: 'D/P', note: 'Always' },
      { id: 52,  name: 'Meowth',     location: 'Trophy Garden', games: 'D/P', note: 'Always' },
      { id: 133, name: 'Eevee',      location: 'Trophy Garden', games: 'D/P', note: 'Always' },
      { id: 137, name: 'Porygon',    location: 'Trophy Garden', games: 'D/P', note: 'Always' },
      // Always available (Platinum only)
      { id: 315, name: 'Roselia',    location: 'Trophy Garden', games: 'Pt', note: 'Always' },
      { id: 397, name: 'Staravia',   location: 'Trophy Garden', games: 'Pt', note: 'Always' },
    ],
  },
  {
    id: 'honey-trees',
    title: 'Honey Trees',
    games: 'D/P/Pt',
    genIds: [4],
    versions: ['diamond', 'pearl', 'platinum'],
    how: 'Slather honey on a tree and return in ~6 hours. Munchlax only appears on 4 specific trees per save file.',
    pokemon: [
      { id: 265, name: 'Wurmple',   location: 'Any honey tree', note: '40%' },
      { id: 412, name: 'Burmy',     location: 'Any honey tree', note: '20%' },
      { id: 415, name: 'Combee',    location: 'Any honey tree', note: '20%' },
      { id: 420, name: 'Cherubi',   location: 'Any honey tree', note: '20%' },
      { id: 190, name: 'Aipom',     location: 'Any honey tree', note: '10%' },
      { id: 266, name: 'Silcoon',   location: 'Any honey tree', games: 'D/Pt', note: '25%' },
      { id: 268, name: 'Cascoon',   location: 'Any honey tree', games: 'P/Pt', note: '25%' },
      { id: 214, name: 'Heracross', location: 'Any honey tree', note: '5%' },
      { id: 446, name: 'Munchlax',  location: '4 specific trees',               note: '1%' },
    ],
  },
  {
    id: 'swarm-hgss',
    title: 'Mass Outbreaks',
    games: 'HG/SS',
    genIds: [4],
    versions: ['heartgold', 'soulsilver'],
    how: 'Call trainers saved in your PokéGear to hear about today\'s swarm location.',
    pokemon: [
      { id: 113, name: 'Chansey',   location: 'Route 13' },
      { id: 132, name: 'Ditto',     location: 'Route 47' },
      { id: 183, name: 'Marill',    location: 'Mt. Mortar' },
      { id: 193, name: 'Yanma',     location: 'Route 35' },
      { id: 206, name: 'Dunsparce', location: 'Dark Cave' },
      { id: 209, name: 'Snubbull',  location: 'Route 38' },
      { id: 211, name: 'Qwilfish',  location: 'Route 32' },
      { id: 223, name: 'Remoraid',  location: 'Route 44' },
      { id: 261, name: 'Poochyena', location: 'Route 1 (Kanto)' },
      { id: 278, name: 'Wingull',   location: 'Vermilion City (surf)' },
      { id: 280, name: 'Ralts',     location: 'Route 34' },
      { id: 333, name: 'Swablu',    location: 'Route 45' },
      { id: 366, name: 'Clamperl',  location: 'Sea Route 19' },
      { id: 369, name: 'Relicanth', location: 'Route 12' },
      { id: 370, name: 'Luvdisc',   location: 'Route 27' },
      { id: 401, name: 'Kricketot', location: 'Viridian Forest' },
      { id: 427, name: 'Buneary',   location: 'Route 25' },
    ],
  },
];
