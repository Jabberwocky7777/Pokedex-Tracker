/**
 * Where to get EXP, per game: what players recommend, checked against the
 * games' own data. The EXP numbers are never written here — the level-up
 * view works them out from src/data/xp-trainers.json (trainer parties from the
 * pret decompilations, scripts/fetch-xp-data.ts) and public/data/pokemon.json
 * (wild encounter tables), so `verdict` only states comparisons, and
 * src/lib/__tests__/xp-spots.test.ts fails if one of them stops being true.
 *
 * Unlock conditions were read from the games' scripts:
 * - FR/LG: the Elite Four use their rematch teams once FLAG_SYS_CAN_LINK_WITH_RS
 *   is set (the Network Machine fixed, end of the Sevii story) —
 *   pokefirered data/maps/PokemonLeague_LoreleisRoom/scripts.inc.
 * - Platinum: rematch teams after FLAG_ARRESTED_CHARON_STARK_MOUNTAIN —
 *   pokeplatinum res/field/scripts/scripts_pokemon_league_aaron_room.s.
 * - HG/SS gym leaders: all 16 badges (PlayerProfile_CountBadges in
 *   src/application/pokegear/phone/scripts/phone_scripts_gym_leader.c), then a call on the
 *   leader's weekday and time of day from files/tel/pmtel_book.json; the battles are at the
 *   Saffron City Fighting Dojo (scr_seq_0832_T11R0101.s).
 * - HG/SS: rematch teams once VAR_UNK_4135 (+1 per Kanto badge) reaches 8 —
 *   pokeheartgold scr_seq_0820_T10R0201.s and the Kanto gym scripts; Red is
 *   shown again each time you enter the Hall of Fame (scr_seq_0825_T10R0701.s).
 * - Emerald: the Elite Four have one team (src/battle_setup.c lists the same
 *   trainer for all five rematch levels).
 */
import type { GameVersion } from "../types";
import type { XpGame } from "../lib/xp";
import type { UnlockRequirement } from "./route-unlocks";

const HOF: UnlockRequirement = { milestone: "hall-of-fame" };
const NAT: UnlockRequirement = { milestone: "national-dex" };
const FIGHT_AREA: UnlockRequirement = { milestone: "fight-area" };
const SEVII_4_7: UnlockRequirement = { milestone: "sevii-4-7" };

export interface XpSource {
  label: string;
  url: string;
}

export interface XpSpot {
  id: string;
  title: string;
  games: GameVersion[];
  /** When it opens up */
  when: string;
  /**
   * The nearest Game Progress has to it (data/game-progress.ts), for picking a spot you can reach: some
   * conditions (Charon arrested, the Network Machine fixed) come after the milestone named here
   */
  needs?: UnlockRequirement[];
  /** What to do there */
  how: string;
  /** One run: these trainers, in the game's data (xp-trainers.json); the EXP shown is their sum */
  trainers?: { game: XpGame; ids: string[] };
  /** The strongest of a set of rematch trainers, listed with their EXP (one battle each) */
  rematches?: { game: XpGame; ids: string[] };
  /** Show the trainers as a week (HG/SS phone rematches, from their `call` day and time) */
  schedule?: boolean;
  /** A wild area: the EXP shown is the average for one battle there */
  wild?: { game: GameVersion; slug: string; method: string };
  /** What players say */
  said?: string;
  /** What the numbers say */
  verdict: string;
  /** Repeatable as often as you like, or limited (daily, by phone, by VS Seeker charge) */
  repeat: "any time" | "daily" | "rematch";
  sources?: XpSource[];
}

const POKEBASE_HGSS: XpSource = {
  label: "PokéBase: best way to level up in HG/SS",
  url: "https://pokemondb.net/pokebase/92813/what-is-the-best-way-to-level-up-in-heartgold-soulsilver",
};
const DRAGONFLY_HGSS: XpSource = {
  label: "The Cave of Dragonflies: HG/SS places to train",
  url: "https://www.dragonflycave.com/hgsstraining.aspx",
};
const POKEBASE_EMERALD: XpSource = {
  label: "PokéBase: best ways to train in Emerald",
  url: "https://pokemondb.net/pokebase/288082/what-are-best-ways-to-train-in-pokemon-emerald",
};
const FANDOMSPOT_RSE: XpSource = {
  label: "FandomSpot: RSE grinding spots",
  url: "https://www.fandomspot.com/pokemon-rse-grinding-spots/",
};
const SUPERCHEATS_PT: XpSource = {
  label: "SuperCheats: Platinum training, Lv 40s on",
  url: "https://www.supercheats.com/nintendods/questions/pokemonplatinum/140395/a-place-to-train-level-40s-through.htm",
};
const BULBA_REMATCH: XpSource = {
  label: "Bulbapedia: Rematch",
  url: "https://bulbapedia.bulbagarden.net/wiki/Rematch",
};
const BULBA_E4: XpSource = {
  label: "Bulbapedia: Elite Four",
  url: "https://bulbapedia.bulbagarden.net/wiki/Elite_Four",
};

export const XP_SPOTS: XpSpot[] = [
  // ── Ruby / Sapphire / Emerald ──────────────────────────────────────────
  {
    id: "em-league",
    title: "Elite Four + Wallace",
    games: ["ruby", "sapphire", "emerald"],
    needs: [HOF],
    when: "After the Hall of Fame",
    how: "Run the whole League. Bring Revives and Full Restores — you can't heal between rooms.",
    trainers: {
      game: "emerald",
      ids: ["TRAINER_SIDNEY", "TRAINER_PHOEBE", "TRAINER_GLACIA", "TRAINER_DRAKE", "TRAINER_WALLACE"],
    },
    said: "The usual answer for training past Lv 50.",
    verdict:
      "Right: the most EXP per trip in Emerald. Their teams never get stronger, so it slows down once your Pokémon are in their 60s. Ruby/Sapphire's Champion is Steven, with a similar team.",
    repeat: "any time",
    sources: [POKEBASE_EMERALD, BULBA_E4],
  },
  {
    id: "em-leaders",
    title: "Gym leader rematches",
    games: ["emerald"],
    needs: [HOF],
    when: "After the Hall of Fame; they call you through Match Call",
    how: "Register the leaders in Match Call and wait for a call. Each rematch is a double battle, and the teams go up a level with each round.",
    rematches: {
      game: "emerald",
      ids: [
        "TRAINER_JUAN_5",
        "TRAINER_NORMAN_5",
        "TRAINER_TATE_AND_LIZA_5",
        "TRAINER_WINONA_5",
        "TRAINER_FLANNERY_5",
        "TRAINER_ROXANNE_5",
        "TRAINER_WATTSON_5",
        "TRAINER_BRAWLY_5",
      ],
    },
    verdict:
      "A top-round Juan is worth more than any single Elite Four member. You can't choose when they call, so take them when they do.",
    repeat: "rematch",
    sources: [BULBA_REMATCH],
  },
  {
    id: "em-wally",
    title: "Wally, Victory Road",
    games: ["emerald"],
    needs: [HOF],
    when: "After the Hall of Fame (he stays at the Victory Road entrance)",
    how: "Register him and accept his rematch calls.",
    rematches: {
      game: "emerald",
      ids: ["TRAINER_WALLY_VR_5", "TRAINER_WALLY_VR_4", "TRAINER_WALLY_VR_3", "TRAINER_WALLY_VR_2"],
    },
    verdict: "The best regular-trainer rematch in Emerald by a wide margin.",
    repeat: "rematch",
  },
  {
    id: "em-victory-road",
    title: "Victory Road B1F, wild",
    games: ["ruby", "sapphire", "emerald"],
    needs: [{ badges: 8 }],
    when: "Before the League",
    how: "Walk in the cave. Wild battles have no 1.5× trainer bonus, but there is no wait between them.",
    wild: { game: "emerald", slug: "hoenn-victory-road-b1f", method: "walk" },
    said: "Recommended for the last levels before the League; slow for a team already past Lv 50.",
    verdict: "The best wild EXP in Hoenn, ahead of Meteor Falls and Sky Pillar.",
    repeat: "any time",
    sources: [FANDOMSPOT_RSE],
  },
  {
    id: "em-gabby-ty",
    title: "Gabby & Ty (interviewers)",
    games: ["ruby", "sapphire", "emerald"],
    when: "They move between Routes 111, 118 and 120 as the story goes on",
    how: "A double battle each time you meet them after an interview.",
    rematches: {
      game: "emerald",
      ids: ["TRAINER_GABBY_AND_TY_6", "TRAINER_GABBY_AND_TY_5", "TRAINER_GABBY_AND_TY_3"],
    },
    said: "Often recommended with the Exp. Share for weaker Pokémon.",
    verdict: "Not worth seeking out: even their last team gives a fraction of a Victory Road Wally rematch.",
    repeat: "rematch",
    sources: [
      {
        label: "PokéCommunity: best way to level up",
        url: "https://www.pokecommunity.com/threads/what-is-the-best-way-to-level-up.382405",
      },
    ],
  },

  // ── FireRed / LeafGreen ────────────────────────────────────────────────
  {
    id: "fr-league-rematch",
    title: "Elite Four rematch teams",
    games: ["firered", "leafgreen"],
    needs: [SEVII_4_7],
    when: "After the Sevii Islands story (the Network Machine fixed); before that they use their first teams",
    how: "Run the League. Every member brings a stronger team after the Network Machine is fixed.",
    trainers: {
      game: "firered",
      ids: [
        "TRAINER_ELITE_FOUR_LORELEI_2",
        "TRAINER_ELITE_FOUR_BRUNO_2",
        "TRAINER_ELITE_FOUR_AGATHA_2",
        "TRAINER_ELITE_FOUR_LANCE_2",
        "TRAINER_CHAMPION_REMATCH_SQUIRTLE",
      ],
    },
    said: "The best source of EXP for high-level Pokémon.",
    verdict: "Right: the most EXP per trip in FR/LG once the rematch teams are in.",
    repeat: "any time",
    sources: [BULBA_E4],
  },
  {
    id: "fr-league",
    title: "Elite Four, first teams",
    games: ["firered", "leafgreen"],
    needs: [HOF],
    when: "After the Hall of Fame",
    how: "Run the League. The Champion's team depends on your starter (a few EXP either way).",
    trainers: {
      game: "firered",
      ids: [
        "TRAINER_ELITE_FOUR_LORELEI",
        "TRAINER_ELITE_FOUR_BRUNO",
        "TRAINER_ELITE_FOUR_AGATHA",
        "TRAINER_ELITE_FOUR_LANCE",
        "TRAINER_CHAMPION_FIRST_SQUIRTLE",
      ],
    },
    verdict: "Still the best per trip until the rematch teams unlock.",
    repeat: "any time",
  },
  {
    id: "fr-sevault",
    title: "Cooltrainers Leroy & Michelle, Sevault Canyon",
    games: ["firered", "leafgreen"],
    needs: [SEVII_4_7],
    when: "Seven Island, after the National Dex",
    how: "Use the VS Seeker next to them; they rematch with stronger teams.",
    rematches: {
      game: "firered",
      ids: ["TRAINER_COOLTRAINER_LEROY_2", "TRAINER_COOLTRAINER_MICHELLE_2", "TRAINER_PKMN_RANGER_JACKSON_2"],
    },
    verdict: "The best VS Seeker rematches in the game, and close together.",
    repeat: "rematch",
  },
  {
    id: "fr-cerulean-cave",
    title: "Cerulean Cave, wild",
    games: ["firered", "leafgreen"],
    needs: [NAT],
    when: "After the Sevii story (National Dex)",
    how: "Walk on 2F or B1F.",
    wild: { game: "firered", slug: "cerulean-cave-2f", method: "walk" },
    verdict: "The best wild EXP in FR/LG.",
    repeat: "any time",
  },
  {
    id: "fr-kindle-road",
    title: "Kindle Road, wild",
    games: ["firered", "leafgreen"],
    needs: [{ milestone: "sevii-1-3" }],
    when: "One Island, mid-game",
    how: "Walk in the grass; Ember Spa heals you for free nearby.",
    wild: { game: "firered", slug: "kindle-road-area", method: "walk" },
    said: "Often called the best late-game training spot.",
    verdict: "Handy because of the free healing, but Cerulean Cave gives about twice as much a battle.",
    repeat: "any time",
    sources: [
      {
        label: "ItemLevel: level up fast in FR/LG",
        url: "https://itemlevel.net/how-to-level-up-fast-in-pokemon-firered-leafgreen/",
      },
    ],
  },

  // ── Diamond / Pearl / Platinum ─────────────────────────────────────────
  {
    id: "pt-league-rematch",
    title: "Elite Four + Cynthia rematch",
    games: ["platinum"],
    needs: [FIGHT_AREA],
    when: "After the Stark Mountain story with Buck (Charon arrested); before that, their first teams",
    how: "Run the League.",
    trainers: {
      game: "platinum",
      ids: [
        "TRAINER_ELITE_FOUR_AARON_REMATCH",
        "TRAINER_ELITE_FOUR_BERTHA_REMATCH",
        "TRAINER_ELITE_FOUR_FLINT_REMATCH",
        "TRAINER_ELITE_FOUR_LUCIAN_REMATCH",
        "TRAINER_CHAMPION_CYNTHIA_REMATCH",
      ],
    },
    said: "Everyone's answer for the post-game.",
    verdict: "Right: the most EXP per trip in Platinum.",
    repeat: "any time",
    sources: [SUPERCHEATS_PT, BULBA_E4],
  },
  {
    id: "pt-league",
    title: "Elite Four + Cynthia, first teams",
    games: ["platinum"],
    needs: [HOF],
    when: "After the Hall of Fame",
    how: "Run the League.",
    trainers: {
      game: "platinum",
      ids: [
        "TRAINER_ELITE_FOUR_AARON",
        "TRAINER_ELITE_FOUR_BERTHA",
        "TRAINER_ELITE_FOUR_FLINT",
        "TRAINER_ELITE_FOUR_LUCIAN",
        "TRAINER_CHAMPION_CYNTHIA",
      ],
    },
    verdict: "Already ahead of every other repeatable battle in Platinum.",
    repeat: "any time",
  },
  {
    id: "pt-battleground",
    title: "Gym leaders at the Battleground",
    games: ["platinum"],
    needs: [FIGHT_AREA],
    when: "Post-game, past the Fight Area; which leaders are there changes day by day",
    how: "Battle whoever is there today.",
    rematches: {
      game: "platinum",
      ids: [
        "TRAINER_LEADER_CANDICE_REMATCH",
        "TRAINER_LEADER_ROARK_REMATCH",
        "TRAINER_LEADER_BYRON_REMATCH",
        "TRAINER_LEADER_FANTINA_REMATCH",
        "TRAINER_LEADER_GARDENIA_REMATCH",
        "TRAINER_LEADER_WAKE_REMATCH",
        "TRAINER_LEADER_VOLKNER_REMATCH",
        "TRAINER_LEADER_MAYLENE_REMATCH",
      ],
    },
    said: "Mentioned for its gym leaders and other strong trainers.",
    verdict: "Worth a daily stop: each leader gives close to an Elite Four member.",
    repeat: "daily",
    sources: [
      {
        label: "SuperCheats: Platinum Battle Zone",
        url: "https://www.supercheats.com/guides/pokemon-platinum/battle-zone",
      },
    ],
  },
  {
    id: "pt-vs-seeker",
    title: "VS Seeker rematches",
    games: ["platinum"],
    when: "After the National Dex for their strongest teams",
    how: "Use the VS Seeker on these trainers.",
    rematches: {
      game: "platinum",
      ids: [
        "TRAINER_RANCHER_MARCO_REMATCH_2",
        "TRAINER_ACE_TRAINER_MAYA_REMATCH_2",
        "TRAINER_VETERAN_BRIAN_REMATCH_2",
        "TRAINER_ACE_TRAINER_DENNIS_REMATCH_2",
      ],
    },
    verdict: "Good when you are passing by; Rancher Marco on Route 210 is the best of them.",
    repeat: "rematch",
  },
  {
    id: "pt-stark",
    title: "Stark Mountain / Routes 227–228, wild",
    games: ["platinum"],
    needs: [FIGHT_AREA],
    when: "Post-game (Battle Zone)",
    how: "Walk in the grass or the cave.",
    wild: { game: "platinum", slug: "stark-mountain-area", method: "walk" },
    said: "The Survival Area, Route 225 and Stark Mountain come up often.",
    verdict: "The best wild EXP in Platinum, a little ahead of Route 225.",
    repeat: "any time",
    sources: [SUPERCHEATS_PT],
  },
  {
    id: "pt-iron-island",
    title: "Iron Island, wild",
    games: ["platinum"],
    when: "Mid-game (Canalave City)",
    how: "Walk in the cave.",
    wild: { game: "platinum", slug: "iron-island-b2f-left", method: "walk" },
    said: "A common mid-game suggestion.",
    verdict: "Fine before the League, but about half of Stark Mountain later.",
    repeat: "any time",
    sources: [SUPERCHEATS_PT],
  },
  {
    id: "dp-league",
    title: "Elite Four + Cynthia",
    games: ["diamond", "pearl"],
    needs: [HOF],
    when: "After the Hall of Fame",
    how: "Run the League. In Diamond and Pearl they keep the same teams — the stronger rematch teams are Platinum's.",
    trainers: {
      game: "diamond",
      ids: [
        "TRAINER_ELITE_FOUR_AARON_AARON",
        "TRAINER_ELITE_FOUR_BERTHA_BERTHA",
        "TRAINER_ELITE_FOUR_FLINT_FLINT",
        "TRAINER_ELITE_FOUR_LUCIEN_LUCIAN",
        "TRAINER_CHAMPION_CYNTHIA",
      ],
    },
    verdict:
      "The most EXP per trip in Diamond and Pearl — but their teams never change (the game has one party each), so it gets slower as you level.",
    repeat: "any time",
    sources: [BULBA_E4],
  },
  {
    id: "dp-vs-seeker",
    title: "VS Seeker rematches",
    games: ["diamond", "pearl"],
    when: "Their last teams come late in the post-game",
    how: "Use the VS Seeker near them; each rematch steps their team up.",
    rematches: {
      game: "diamond",
      ids: [
        "TRAINER_VETERAN_ARMANDO_2",
        "TRAINER_VETERAN_BRIAN_3",
        "TRAINER_BLACK_BELT_DAVON_2",
        "TRAINER_SAILOR_ZACHARIAH_2",
        "TRAINER_PSYCHIC_F_ABIGAIL_3",
      ],
    },
    verdict: "Each is worth a little over half an Elite Four member; Route 224, 210 and 228 have the best.",
    repeat: "rematch",
  },
  {
    id: "dp-iron-island",
    title: "Iron Island, wild",
    games: ["diamond", "pearl"],
    when: "Mid-game (Canalave City)",
    how: "Walk in the cave.",
    wild: { game: "diamond", slug: "iron-island-b2f-left", method: "walk" },
    said: "A common mid-game suggestion.",
    verdict: "Fine before the League, about half of the post-game spots later.",
    repeat: "any time",
    sources: [SUPERCHEATS_PT],
  },
  {
    id: "dp-turnback",
    title: "Turnback Cave / Route 228, wild",
    games: ["diamond", "pearl"],
    needs: [FIGHT_AREA],
    when: "Post-game (Battle Zone)",
    how: "Walk in the cave or the grass.",
    wild: { game: "diamond", slug: "sinnoh-route-228-area", method: "walk" },
    verdict: "The best wild EXP in Diamond and Pearl.",
    repeat: "any time",
  },

  // ── HeartGold / SoulSilver ─────────────────────────────────────────────
  {
    id: "hg-league-red",
    title: "Elite Four + Lance rematch, then Red",
    games: ["heartgold", "soulsilver"],
    needs: [{ badges: 16 }],
    when: "Rematch teams once you have all 8 Kanto badges; Red is back on Mt. Silver after every Hall of Fame",
    how: "Run the League, then fly to Mt. Silver for Red.",
    trainers: {
      game: "heartgold",
      ids: [
        "TRAINER_ELITE_FOUR_WILL_WILL_2",
        "TRAINER_ELITE_FOUR_KOGA_KOGA_2",
        "TRAINER_ELITE_FOUR_BRUNO_BRUNO_2",
        "TRAINER_ELITE_FOUR_KAREN_KAREN_2",
        "TRAINER_CHAMPION_LANCE_2",
        "TRAINER_PKMN_TRAINER_RED_RED",
      ],
    },
    said: "Rematching the Elite Four (and Red) beats everything else.",
    verdict: "Right: the most EXP per trip in HG/SS. Before the 16th badge the League is worth a lot less.",
    repeat: "any time",
    sources: [POKEBASE_HGSS],
  },
  {
    id: "hg-league",
    title: "Elite Four + Lance, first teams",
    games: ["heartgold", "soulsilver"],
    needs: [HOF],
    when: "After the Hall of Fame, until the 16th badge",
    how: "Run the League.",
    trainers: {
      game: "heartgold",
      ids: [
        "TRAINER_ELITE_FOUR_WILL_WILL",
        "TRAINER_ELITE_FOUR_KOGA_KOGA",
        "TRAINER_ELITE_FOUR_BRUNO_BRUNO",
        "TRAINER_ELITE_FOUR_KAREN_KAREN",
        "TRAINER_CHAMPION_LANCE",
      ],
    },
    verdict: "Still the best per trip until the rematch teams.",
    repeat: "any time",
  },
  {
    id: "hg-leaders",
    title: "Gym leader rematches, Saffron Fighting Dojo",
    games: ["heartgold", "soulsilver"],
    needs: [{ badges: 16 }],
    when: "After all 16 badges, once a leader has given you their number",
    how: "Call the leader on their day, at their time of day: they agree to meet at the Fighting Dojo in Saffron City. On any other day they turn you down.",
    rematches: {
      game: "heartgold",
      ids: [
        "TRAINER_LEADER_FALKNER_FALKNER_2",
        "TRAINER_LEADER_BUGSY_BUGSY_2",
        "TRAINER_LEADER_WHITNEY_2",
        "TRAINER_LEADER_MORTY_MORTY_2",
        "TRAINER_LEADER_PRYCE_PRYCE_2",
        "TRAINER_LEADER_JASMINE_JASMINE_2",
        "TRAINER_LEADER_CHUCK_CHUCK_2",
        "TRAINER_LEADER_CLAIR_CLAIR_2",
        "TRAINER_LEADER_BROCK_BROCK_2",
        "TRAINER_LEADER_MISTY_MISTY_2",
        "TRAINER_LEADER_LT_SURGE_LT__SURGE_2",
        "TRAINER_LEADER_ERIKA_ERIKA_2",
        "TRAINER_LEADER_JANINE_JANINE_2",
        "TRAINER_LEADER_SABRINA_SABRINA_2",
        "TRAINER_LEADER_BLAINE_BLAINE_2",
        "TRAINER_LEADER_BLUE_BLUE_2",
      ],
    },
    schedule: true,
    verdict:
      "Between three-quarters of an Elite Four member and more than one, and at least one leader is in every day of the week. Blue on Sunday nights is the best.",
    repeat: "rematch",
    sources: [POKEBASE_HGSS],
  },
  {
    id: "hg-phone",
    title: "Phone rematches",
    games: ["heartgold", "soulsilver"],
    when: "Register trainers after beating them; their teams get stronger as the story goes on",
    how: "Call them on their day at their time of day, or wait for them to call you, then go to where they stand.",
    rematches: {
      game: "heartgold",
      ids: [
        "TRAINER_POKE_MANIAC_BRENT_4",
        "TRAINER_SCHOOL_KID_M_ALAN_4",
        "TRAINER_ACE_TRAINER_F_REENA_4",
        "TRAINER_BIKER_AIDEN_4",
        "TRAINER_HIKER_KENNY_4",
        "TRAINER_FISHERMAN_KYLE_4",
        "TRAINER_PICNICKER_LIZ_4",
        "TRAINER_PICNICKER_ERIN_4",
      ],
    },
    schedule: true,
    verdict: "Worth taking on their day; none comes near a League run.",
    repeat: "rematch",
    sources: [BULBA_REMATCH],
  },
  {
    id: "hg-mt-silver",
    title: "Mt. Silver, wild",
    games: ["heartgold", "soulsilver"],
    needs: [{ badges: 16 }],
    when: "After the 16th badge",
    how: "Walk on 2F (Rock Climb needed higher up).",
    wild: { game: "heartgold", slug: "mt-silver-2f", method: "walk" },
    said: "The highest-EXP wild spot.",
    verdict: "Right for wild battles, ahead of Route 28.",
    repeat: "any time",
    sources: [DRAGONFLY_HGSS],
  },
];

/** Where to find a Lucky Egg (× 1.5 EXP): a wild Chansey holds one 5% of the time (pret species data) */
export const LUCKY_EGG: Partial<Record<GameVersion, string>> = {
  ruby: "No wild Chansey in Hoenn — only one traded in from FireRed/LeafGreen holding it.",
  sapphire: "No wild Chansey in Hoenn — only one traded in from FireRed/LeafGreen holding it.",
  emerald: "No wild Chansey in Hoenn — only one traded in from FireRed/LeafGreen holding it.",
  firered: "Wild Chansey in the Safari Zone hold one 5% of the time (Thief or Covet takes it).",
  leafgreen: "Wild Chansey in the Safari Zone hold one 5% of the time (Thief or Covet takes it).",
  diamond: "Wild Chansey on Routes 209 and 210 and in the Trophy Garden hold one 5% of the time.",
  pearl: "Wild Chansey on Routes 209 and 210 and in the Trophy Garden hold one 5% of the time.",
  platinum: "Wild Chansey on Routes 209 and 210 and in the Trophy Garden hold one 5% of the time.",
  heartgold:
    "Wild Chansey on Routes 13–15 (a Route 13 swarm makes them common) hold one 5% of the time; Frisk shows it.",
  soulsilver:
    "Wild Chansey on Routes 13–15 (a Route 13 swarm makes them common) hold one 5% of the time; Frisk shows it.",
};
