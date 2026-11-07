/**
 * An encounter row's `table` (see `EncounterDetail.table`): one of several tables
 * a method has at one place, each adding up to 100% on its own. Rates are only
 * added up within one table; a place shows each table as its own list.
 */

const TABLE_LABELS: Record<string, string> = {
  "common-trees": "Common trees",
  "rare-trees": "Rare trees",
  "secret-trees": "Secret trees",
  surf: "Surfing",
  "old-rod": "Old Rod",
  "good-rod": "Good Rod",
  "super-rod": "Super Rod",
  "hoenn-sound": "Hoenn Sound",
  "sinnoh-sound": "Sinnoh Sound",
  blocks: "With Safari blocks",
  contest: "Bug-Catching Contest",
  "contest-tuesday": "Bug-Catching Contest, Tuesdays (National Dex)",
  "contest-thursday": "Bug-Catching Contest, Thursdays (National Dex)",
  "contest-saturday": "Bug-Catching Contest, Saturdays (National Dex)",
};

/** Display order; the method's main table (no `table`) comes first */
const TABLE_ORDER = Object.keys(TABLE_LABELS);

function tableLabel(table: string): string {
  return TABLE_LABELS[table] ?? table;
}

/** Sorts tables: the main one, then `TABLE_ORDER`, then anything unknown */
export function compareTables(a: string | undefined, b: string | undefined): number {
  const rank = (t: string | undefined) =>
    t === undefined ? -1 : TABLE_ORDER.includes(t) ? TABLE_ORDER.indexOf(t) : TABLE_ORDER.length;
  return rank(a) - rank(b);
}

/**
 * Tables that are only there some of the time or once you've set something up
 * (a swarm, the radio, Safari blocks, the contest), as opposed to headbutt's trees,
 * which are always there.
 */
export function isConditionalTable(table: string | undefined): boolean {
  return table !== undefined && !table.endsWith("-trees");
}

/**
 * One-time methods: each row is "you get one", not a share of a table, so rows
 * aren't added into a rate (Dragon's Den's two Dratini gifts are not "200%").
 */
const ONE_TIME_METHODS = new Set(["gift", "trade", "fossil"]);

/** What a row adds to its Pokémon's rate: 0 for one-time encounters (shown as "1×") */
export function rateShare(d: { method: string; chance: number; isStatic: boolean }): number {
  return d.isStatic || ONE_TIME_METHODS.has(d.method) ? 0 : d.chance;
}

/** "Headbutt · Rare trees"; just the method's label for its main table */
export function methodTableLabel(methodLabel: string, table: string | undefined): string {
  return table ? `${methodLabel} · ${tableLabel(table)}` : methodLabel;
}
