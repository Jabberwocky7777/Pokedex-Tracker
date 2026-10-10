/**
 * Ready-to-evolve detection: compares a Pokémon's real level, friendship, held
 * item and moves with the evolution data in pokemon.json.
 *
 * Works from the slim summary alone for level-based evolutions; friendship,
 * item and move checks need the full save, and say so when it isn't there.
 */
import { isEarlierStage } from "./living-dex";
import { heldItemName, moveName } from "./tables";
import type { EvoStep, SaveMon, SlimMon, SpeciesMap } from "./types";

/**
 * ready   — can be done right now (level reached, item in hand, ready to trade…)
 * waiting — something measurable is still missing (levels, friendship, a move, a held item)
 * manual  — the game condition can't be read from the save (place, time, party, stats)
 */
export type EvolveStatus = "ready" | "waiting" | "manual";

export interface EvolveCheck {
  target: number;
  status: EvolveStatus;
  /** Short method: "Level 7", "Moon Stone", "Trade", "High friendship" */
  method: string;
  /** What to do or what is missing: "Ready now", "3 levels to go", "Use a Moon Stone" */
  text: string;
}

const FRIENDSHIP_TO_EVOLVE = 220;

// Stone evolutions that also depend on gender (not spelled out in the data)
const GENDER_LOCKED: Record<number, "male" | "female"> = { 475: "male", 478: "female" };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const article = (noun: string) => (/^[aeiou]/i.test(noun) ? "an" : "a");

/** A trailing "(day)" / "(night)" / "(female)" style condition in the details text. */
function condition(details: string): string | null {
  return details.match(/\(([^)]+)\)\s*$/)?.[1] ?? null;
}

export function checkEvolution(mon: SlimMon, full: SaveMon | undefined, step: EvoStep): EvolveCheck {
  const details = step.details ?? "";
  const cond = condition(details);
  const base = { target: step.speciesId };
  const needsFull = (method: string): EvolveCheck => ({ ...base, status: "manual", method, text: details || method });

  // Gender-locked evolutions can be ruled out outright
  const wantsGender = cond === "male" || cond === "female" ? cond : GENDER_LOCKED[step.speciesId];
  if (wantsGender && full && full.gender !== wantsGender) {
    return { ...base, status: "manual", method: details, text: `Only a ${wantsGender} one can evolve this way` };
  }

  if (step.trigger === "trade") {
    const item = details.match(/holding (.+)$/i)?.[1];
    if (!item) return { ...base, status: "ready", method: "Trade", text: "Needs a trade" };
    if (!full) return needsFull(`Trade holding ${item}`);
    return full.heldItem > 0 && norm(heldItemName(full)) === norm(item)
      ? { ...base, status: "ready", method: `Trade holding ${item}`, text: `Ready to trade — it's holding the ${item}` }
      : { ...base, status: "waiting", method: `Trade holding ${item}`, text: `Give it ${article(item)} ${item}, then trade` };
  }

  if (step.trigger === "use-item") {
    return { ...base, status: "ready", method: details, text: `Use ${article(details)} ${details}` };
  }

  if (step.trigger === "level-up") {
    if (step.minLevel) {
      const method = `Level ${step.minLevel}`;
      const extra = cond && cond !== "male" && cond !== "female" ? ` (${cond})` : "";
      const togo = step.minLevel - mon.level;
      return togo <= 0
        ? { ...base, status: "ready", method, text: `Ready now — level it once${extra}` }
        : { ...base, status: "waiting", method, text: `${togo} level${togo === 1 ? "" : "s"} to go${extra}` };
    }
    if (/high friendship/i.test(details)) {
      const method = "High friendship";
      const when = cond ? ` during the ${cond}` : "";
      if (!full) return needsFull(method);
      return full.friendship >= FRIENDSHIP_TO_EVOLVE
        ? { ...base, status: "ready", method, text: `Friendship is high enough — level it once${when}` }
        : { ...base, status: "waiting", method, text: `Friendship ${full.friendship}/${FRIENDSHIP_TO_EVOLVE}${when ? ` (then level up${when})` : ""}` };
    }
    const move = details.match(/knowing (.+)$/i)?.[1];
    if (move) {
      if (!full) return needsFull(`Knowing ${move}`);
      return full.moves.some((id) => id > 0 && norm(moveName(id)) === norm(move))
        ? { ...base, status: "ready", method: `Knowing ${move}`, text: `It knows ${move} — level it once` }
        : { ...base, status: "waiting", method: `Knowing ${move}`, text: `Teach it ${move}, then level up` };
    }
    const held = details.match(/holding (.+?)(?: \(|$)/i)?.[1];
    if (held) {
      const when = cond ? ` during the ${cond}` : "";
      if (!full) return needsFull(`Holding ${held}`);
      return full.heldItem > 0 && norm(heldItemName(full)) === norm(held)
        ? { ...base, status: "ready", method: `Holding ${held}`, text: `It's holding the ${held} — level it once${when}` }
        : { ...base, status: "waiting", method: `Holding ${held}`, text: `Give it ${article(held)} ${held}, then level up${when}` };
    }
  }

  // Place, Beauty, party members, Shedinja… — show the game's condition as written
  return { ...base, status: "manual", method: details || "Special", text: details || "Special condition" };
}

/** Every evolution open to this Pokémon (within the generation), checked. */
export function evolutionChecks(mon: SlimMon, full: SaveMon | undefined, dex: SpeciesMap, maxSpecies: number): EvolveCheck[] {
  if (mon.isEgg) return [];
  return (dex.get(mon.species)?.evolvesTo ?? [])
    .filter((step) => step.speciesId <= maxSpecies)
    .map((step) => checkEvolution(mon, full, step));
}

/**
 * The next step this Pokémon has to take to become `target` — for a Caterpie
 * holding Butterfree's slot that is the Caterpie → Metapod step.
 */
export function checkTowards(
  mon: SlimMon, full: SaveMon | undefined, target: number, dex: SpeciesMap,
): EvolveCheck | null {
  const step = (dex.get(mon.species)?.evolvesTo ?? []).find(
    (s) => s.speciesId === target || isEarlierStage(dex, s.speciesId, target),
  );
  return step ? checkEvolution(mon, full, step) : null;
}
