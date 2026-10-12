/**
 * Working out what a move was like in an older game from PokéAPI's change
 * records. Pure, and used only by the data pipeline (scripts/moves-data.ts):
 * the app reads the finished per-game values from public/data/moves.json.
 */

export interface MoveValues {
  type: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
}

/** One entry of PokéAPI's move changelog: what a move was like *before* `versionGroup`. Null = unchanged. */
export interface PastMoveValues {
  versionGroup: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  type: string | null;
}

// Release order. Anything not listed is newer than all of these.
const VERSION_GROUP_ORDER = [
  "red-blue", "yellow", "gold-silver", "crystal", "ruby-sapphire", "emerald", "firered-leafgreen",
  "colosseum", "xd", "diamond-pearl", "platinum", "heartgold-soulsilver",
  "black-white", "black-2-white-2", "x-y", "omega-ruby-alpha-sapphire", "sun-moon", "ultra-sun-ultra-moon",
  "lets-go-pikachu-lets-go-eevee", "sword-shield", "the-isle-of-armor", "the-crown-tundra",
  "brilliant-diamond-shining-pearl", "legends-arceus", "scarlet-violet", "the-teal-mask", "the-indigo-disk",
];
const orderOf = (versionGroup: string): number => {
  const i = VERSION_GROUP_ORDER.indexOf(versionGroup);
  return i === -1 ? VERSION_GROUP_ORDER.length : i;
};

/**
 * A move's values in one game. Each past entry says what a field was before
 * its version group, so the value in `versionGroup` is the one from the
 * earliest later entry that mentions the field — or today's value if none does.
 */
export function moveValuesIn(current: MoveValues, past: PastMoveValues[], versionGroup: string): MoveValues {
  const later = past
    .filter((p) => orderOf(p.versionGroup) > orderOf(versionGroup))
    .sort((a, b) => orderOf(a.versionGroup) - orderOf(b.versionGroup));
  const pick = <K extends keyof MoveValues>(field: K): MoveValues[K] => {
    const entry = later.find((p) => p[field] != null);
    return (entry ? entry[field] : current[field]) as MoveValues[K];
  };
  return { type: pick("type"), power: pick("power"), accuracy: pick("accuracy"), pp: pick("pp") };
}
