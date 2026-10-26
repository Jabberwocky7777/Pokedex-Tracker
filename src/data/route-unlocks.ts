import type { GameVersion } from "../types";
import type { MilestoneId } from "./game-progress";

// Which Game Progress milestone opens each encounter area (by locationAreaSlug)
// and each encounter method, per game. Anything not listed counts as available
// from the start — `npm run unlock-gaps` lists every area that isn't mapped, so
// the gaps stay visible. Only what could be checked is listed; where a source
// only gave a lower bound, that bound is used and said so.
//
// Sources (checked 2026-10-26):
// - Diamond / Pearl / Platinum: Bulbapedia's Sinnoh Route 224 and 225, Stark
//   Mountain and Fight Area pages — the Battle Zone past the Fight Area (Routes
//   225–230, Stark Mountain, the Resort Area) and Route 224 need the Hall of Fame
//   and the National Pokédex. Platinum's decompilation (pret/pokeplatinum):
//   src/overlay006/dual_slot_encounters.c only adds the Slot 2 Pokémon with the
//   National Pokédex; res/field/scripts/scripts_sandgem_town_counterpart_house_1f.s
//   enables outbreaks once you talk to the assistant's sister with the National
//   Pokédex; the Poké Radar is handed over right after SetNationalDexEnabled in
//   scripts_sandgem_town_pokemon_research_lab.s. Bulbapedia's Sandgem Town page
//   gives the same for Diamond and Pearl.
// - HeartGold / SoulSilver: Kanto is reached on the S.S. Aqua after the Hall of
//   Fame (Bulbapedia's National Pokédex page); Mt. Silver opens with all 16
//   badges (Bulbapedia's Mt. Silver page); Hoenn Sound and Sinnoh Sound on the
//   radio come with the National Pokédex (Bulbapedia's Hoenn Sound / Sinnoh
//   Sound page). Routes 26
//   and 27, Tohjo Falls and Victory Road are on the Johto side, before the
//   Elite Four. Cerulean Cave and Route 28 are mapped to Kanto as a lower bound.
// - FireRed / LeafGreen: Bulbapedia's Sevii Islands page — One to Three Island
//   with the Tri-Pass after the Volcano Badge, Four to Seven Island with the
//   Rainbow Pass after the Hall of Fame and the National Pokédex. Cerulean Cave
//   after the National Pokédex (and the Sevii story), from Bulbapedia's FR/LG
//   walkthrough, section 18.
// - Emerald: Bulbapedia's Desert Underpass page and Emerald walkthrough part 20
//   (post-game): Desert Underpass, the Safari Zone expansion, Artisan Cave, the
//   Battle Frontier, Terra Cave and Marine Cave come after the Hall of Fame.
// - Ruby / Sapphire: nothing mapped yet.

/** What opens an area or a method: a milestone, or a number of badges (HG/SS's Mt. Silver needs all 16) */
export type UnlockRequirement = { milestone: MilestoneId } | { badges: number };

const NAT: UnlockRequirement = { milestone: "national-dex" };
const HOF: UnlockRequirement = { milestone: "hall-of-fame" };
const KANTO: UnlockRequirement = { milestone: "kanto" };

const all = (req: UnlockRequirement, slugs: string[]) => Object.fromEntries(slugs.map((s) => [s, req]));

const BATTLE_ZONE = all(NAT, [
  "sinnoh-route-224-area",
  "sinnoh-route-225-area", "sinnoh-sea-route-226-area", "sinnoh-sea-route-226-island-house",
  "sinnoh-route-227-area", "sinnoh-route-228-area", "sinnoh-route-229-area", "sinnoh-sea-route-230-area",
  "stark-mountain", "stark-mountain-area", "stark-mountain-entrance", "stark-mountain-inside",
  "resort-area-area",
]);

const HGSS_KANTO = {
  ...all(KANTO, [
    "pallet-town-area", "viridian-city-area", "viridian-forest-area", "pewter-city-area", "pewter-city-pewter-museum-of-science",
    "cerulean-city-area", "vermilion-city", "vermilion-city-area", "vermilion-city-ss-anne-dock",
    "celadon-city-area", "celadon-city-prize-corner", "fuchsia-city-area", "saffron-city-magnet-train-station", "saffron-city-silph-co",
    "cinnabar-island-area", "mt-moon-1f", "mt-moon-2f", "mt-moon-mt-moon-square", "rock-tunnel-1f", "rock-tunnel-b1f",
    "digletts-cave-area", "power-plant", "kanto-power-plant-area", "route-25",
    "seafoam-islands", "seafoam-islands-1f", "seafoam-islands-b1f", "seafoam-islands-b2f", "seafoam-islands-b3f", "seafoam-islands-b4f",
    "cerulean-cave", "cerulean-cave-1f", "cerulean-cave-2f", "cerulean-cave-b1f", "roaming-kanto",
    "kanto-route-1-area", "kanto-route-2-north-towards-pewter-city", "kanto-route-2-south-towards-viridian-city",
    "kanto-route-3-area", "kanto-route-4-area", "kanto-route-5-area", "kanto-route-6-area", "kanto-route-7-area",
    "kanto-route-8-area", "kanto-route-9-area", "kanto-route-10-area", "kanto-route-11-area", "kanto-route-12-area",
    "kanto-route-13-area", "kanto-route-14-area", "kanto-route-15-area", "kanto-route-16-area", "kanto-route-17-area",
    "kanto-route-18-area", "kanto-sea-route-19-area", "kanto-sea-route-20-area", "kanto-sea-route-21-area",
    "kanto-route-22-area", "kanto-route-24-area", "kanto-route-25-area", "kanto-route-28-area",
  ]),
  ...all({ badges: 16 }, [
    "mt-silver", "mt-silver-1f", "mt-silver-1f-top", "mt-silver-2f", "mt-silver-3f", "mt-silver-4f",
    "mt-silver-mountainside", "mt-silver-outside", "mt-silver-top",
  ]),
};

const SEVII_1_3: UnlockRequirement = { milestone: "sevii-1-3" };
const SEVII_4_7: UnlockRequirement = { milestone: "sevii-4-7" };
const FRLG = {
  ...all(SEVII_1_3, [
    "one-island-area", "kindle-road-area", "treasure-beach-area",
    "mt-ember", "mt-ember-1f-cave-behind-team-rocket", "mt-ember-area", "mt-ember-b1f", "mt-ember-b2f", "mt-ember-b3f",
    "mt-ember-cave", "mt-ember-inside", "mt-ember-summit",
    "cape-brink-area", "three-isle-port-area", "bond-bridge-area", "berry-forest-area",
  ]),
  ...all(SEVII_4_7, [
    "four-island-area", "icefall-cave-1f", "icefall-cave-b1f", "icefall-cave-entrance", "icefall-cave-waterfall",
    "five-island-area", "five-isle-meadow-area", "memorial-pillar-area", "water-labyrinth-area", "resort-gorgeous-area",
    "water-path-area", "ruin-valley-area", "lost-cave-item-rooms",
    ...Array.from({ length: 10 }, (_, i) => `lost-cave-room-${i + 1}`),
    "outcast-island-area", "green-path-area", "pattern-bush-area", "kanto-altering-cave-a",
    "canyon-entrance-area", "sevault-canyon-area", "tanoby-ruins-area", "trainer-tower-area",
    "monean-chamber-area", "liptoo-chamber-area", "weepth-chamber-area", "dilford-chamber-area",
    "scufib-chamber-area", "rixy-chamber-area", "viapos-chamber-area",
  ]),
  ...all(NAT, ["cerulean-cave", "cerulean-cave-1f", "cerulean-cave-2f", "cerulean-cave-b1f"]),
};

const EMERALD = all(HOF, [
  "desert-underpass-area", "hoenn-safari-zone-expansion-north", "hoenn-safari-zone-expansion-south",
  "artisan-cave-area", "hoenn-battle-frontier-area", "terra-cave", "marine-cave",
]);

/** Encounter areas that open with a milestone, per game. */
export const AREA_UNLOCKS: Partial<Record<GameVersion, Record<string, UnlockRequirement>>> = {
  diamond: BATTLE_ZONE,
  pearl: BATTLE_ZONE,
  platinum: BATTLE_ZONE,
  heartgold: HGSS_KANTO,
  soulsilver: HGSS_KANTO,
  firered: FRLG,
  leafgreen: FRLG,
  emerald: EMERALD,
};

const SINNOH_METHODS = {
  "poke-radar": NAT, swarm: NAT,
  slot2: NAT, "slot2-ruby": NAT, "slot2-sapphire": NAT, "slot2-emerald": NAT, "slot2-firered": NAT, "slot2-leafgreen": NAT,
};
// Outbreaks in HG/SS are announced on Oak's show after the National Pokédex, but
// whether they can happen before it isn't confirmed, so swarms are left open
const JOHTO_METHODS = { radio: NAT };

/** Encounter methods that open with a milestone, per game, wherever they are. */
export const METHOD_UNLOCKS: Partial<Record<GameVersion, Record<string, UnlockRequirement>>> = {
  diamond: SINNOH_METHODS,
  pearl: SINNOH_METHODS,
  platinum: SINNOH_METHODS,
  heartgold: JOHTO_METHODS,
  soulsilver: JOHTO_METHODS,
};
