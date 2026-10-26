// Lists the encounter areas of each game that have no unlock data in
// src/data/route-unlocks.ts — they count as open from the start. Run with
// `npm run unlock-gaps`; it never fails, it is there to keep the gaps visible.
import fs from "node:fs";
import type { Pokemon } from "../src/types";
import { AREA_UNLOCKS } from "../src/data/route-unlocks";
import { areasOf } from "../src/lib/unlocks";

const pokemon = JSON.parse(fs.readFileSync("public/data/pokemon.json", "utf8")) as Pokemon[];
const GAMES = ["ruby", "sapphire", "emerald", "firered", "leafgreen", "diamond", "pearl", "platinum", "heartgold", "soulsilver"];

for (const game of GAMES) {
  const areas = [...areasOf(pokemon, game)].sort();
  const mapped = AREA_UNLOCKS[game as keyof typeof AREA_UNLOCKS] ?? {};
  const unmapped = areas.filter((a) => !(a in mapped));
  console.log(`\n${game}: ${areas.length - unmapped.length} of ${areas.length} areas have an unlock; open from the start:`);
  console.log(`  ${unmapped.join(", ")}`);
}
