/**
 * A made-up collection, the same one the README screenshots use: about two
 * thirds of the National Dex caught (more of the early numbers, like a real
 * run), some pending, a few shinies, two notes, with catch dates spread over
 * four months. Deterministic, so every run makes the same one.
 *
 * Used by "Try it with sample data" on the login screen (offline only, with a
 * banner and a one-click reset) and by scripts/capture-screenshots.ts.
 */
import { safeSetItem } from "./safe-storage";

const SAMPLE_KEY = "pokedex_sample_data";
const DAY = 24 * 60 * 60 * 1000;

/** Small deterministic PRNG, so every run gives the same marks */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SampleCollection {
  caught: number[];
  pending: number[];
  shiny: number[];
  /** When each mark was made (epoch ms) */
  at: Record<number, number>;
  notes: Record<string, { text: string; at: number }>;
}

export function sampleCollection(now: number): SampleCollection {
  const random = mulberry32(493);
  const caught: number[] = [];
  const pending: number[] = [];
  const at: Record<number, number> = {};
  for (let id = 1; id <= 493; id++) {
    const chance = 0.85 - (id / 493) * 0.45;
    const roll = random();
    if (roll < chance) {
      caught.push(id);
      // Spread over the last 120 days, older for lower numbers
      at[id] = now - Math.round((1 - id / 493) * 110 * DAY + random() * 10 * DAY);
    } else if (roll < chance + 0.05) {
      pending.push(id);
      at[id] = now - 3 * DAY;
    }
  }
  const shiny = [25, 94, 133, 197, 448].filter((id) => caught.includes(id));
  return {
    caught,
    pending,
    shiny,
    at,
    notes: {
      "4:94": { text: "Haunter traded over and back — keep this one for the living dex.", at: now - 2 * DAY },
      "4:448": { text: "Riolu egg from the Iron Island guy. Lucario at friendship 220, daytime.", at: now - DAY },
    },
  };
}

/** The sample collection as the persisted stores' localStorage entries (Gen IV) */
export function sampleStorage(now: number): Record<string, string> {
  const s = sampleCollection(now);
  const stamps = (ids: number[]) => ({ 4: Object.fromEntries(ids.map((id) => [id, s.at[id] ?? now])) });
  return {
    "pokedex-tracker-v2": JSON.stringify({
      state: {
        caughtByGen: { 4: s.caught },
        pendingByGen: { 4: s.pending },
        shinyByGen: { 4: s.shiny },
        placedByGen: {},
        updatedAt: { caught: stamps(s.caught), pending: stamps(s.pending), shiny: stamps(s.shiny), placed: {} },
      },
      version: 0,
    }),
    "pokedex-notes-v1": JSON.stringify({ state: { entries: s.notes }, version: 0 }),
  };
}

/** Puts the sample collection on this device (offline). The caller reloads the page so the stores read it. */
export function loadSampleData(now = Date.now()): void {
  for (const [key, value] of Object.entries(sampleStorage(now))) safeSetItem(key, value);
  // The marks are Gen IV: open on Gen IV, keeping any other setting already there
  let settings: { state?: Record<string, unknown>; version?: number } = {};
  try {
    settings = (JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as typeof settings) ?? {};
  } catch {
    // Unreadable settings: start from the defaults
  }
  safeSetItem(
    SETTINGS_KEY,
    JSON.stringify({ state: { ...settings.state, activeGeneration: 4 }, version: settings.version ?? 0 }),
  );
  safeSetItem(SAMPLE_KEY, "1");
}

const SETTINGS_KEY = "pokedex-settings-v1";

/** True while the sample collection is what's on this device */
export function isSampleData(): boolean {
  try {
    return localStorage.getItem(SAMPLE_KEY) === "1";
  } catch {
    return false;
  }
}
