import type { StatKey } from "./iv-calc";
import { STAT_LABELS } from "./iv-calc";

const STAT_KEYWORDS: Record<string, StatKey> = {
  hp: "hp", health: "hp",
  attack: "atk", atk: "atk",
  defense: "def", defence: "def", def: "def",
  "sp atk": "spAtk", spatk: "spAtk", "special attack": "spAtk", spa: "spAtk",
  "sp def": "spDef", spdef: "spDef", "special defense": "spDef", "special defence": "spDef", spd: "spDef",
  speed: "spe", spe: "spe",
};

export function detectStatKey(q: string): StatKey | null {
  return STAT_KEYWORDS[q.trim().toLowerCase()] ?? null;
}

// Gen-aware curated EV grinding spots (community favourites, 3★ = best, 2★ = great)
export const FEATURED_GRINDERS: Record<number, Partial<Record<StatKey, { id: number; stars: 2 | 3 }[]>>> = {
  3: {
    hp:    [{ id: 263, stars: 3 }, { id: 265, stars: 3 }, { id: 293, stars: 2 }], // Zigzagoon, Wurmple, Whismur
    atk:   [{ id: 261, stars: 3 }, { id: 262, stars: 3 }, { id: 66,  stars: 2 }], // Poochyena, Mightyena, Machop
    def:   [{ id: 74,  stars: 3 }, { id: 75,  stars: 3 }, { id: 299, stars: 2 }], // Geodude, Graveler, Nosepass
    spAtk: [{ id: 43,  stars: 3 }, { id: 44,  stars: 3 }, { id: 218, stars: 2 }], // Oddish, Gloom, Slugma
    spDef: [{ id: 72,  stars: 3 }, { id: 73,  stars: 3 }, { id: 333, stars: 2 }], // Tentacool, Tentacruel, Swablu
    spe:   [{ id: 278, stars: 3 }, { id: 41,  stars: 3 }, { id: 309, stars: 2 }], // Wingull, Zubat, Electrike
  },
  4: {
    hp:    [{ id: 194, stars: 3 }, { id: 422, stars: 3 }, { id: 423, stars: 2 }], // Wooper, Shellos, Gastrodon
    atk:   [{ id: 400, stars: 3 }, { id: 419, stars: 3 }, { id: 67,  stars: 2 }], // Bibarel, Floatzel, Machoke
    def:   [{ id: 74,  stars: 3 }, { id: 75,  stars: 3 }, { id: 449, stars: 2 }], // Geodude, Graveler, Hippopotas
    spAtk: [{ id: 92,  stars: 3 }, { id: 315, stars: 3 }, { id: 406, stars: 2 }], // Gastly, Roselia, Budew
    spDef: [{ id: 72,  stars: 3 }, { id: 73,  stars: 3 }, { id: 226, stars: 2 }], // Tentacool, Tentacruel, Mantine
    spe:   [{ id: 396, stars: 3 }, { id: 397, stars: 3 }, { id: 41,  stars: 2 }], // Starly, Staravia, Zubat
  },
};

// Convenience re-export so consumers can import both from the same module
export { STAT_LABELS as STAT_LABELS_SHORT };
