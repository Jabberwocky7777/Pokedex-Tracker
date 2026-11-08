import type { EvolutionStep, Pokemon } from "../types";

// Shared by the "Needs attention" filter and the detail panel's evolution reminder,
// so both agree on what counts as "caught but not evolved yet".

/**
 * The evolutions of `pokemon` that are still uncaught. `maxId` limits this to
 * species that exist in the active generation (Eevee has no Sylveon in Gen IV).
 */
export function uncaughtEvolutions(pokemon: Pokemon, caught: ReadonlySet<number>, maxId: number): EvolutionStep[] {
  return pokemon.evolvesTo.filter((step) => step.speciesId <= maxId && !caught.has(step.speciesId));
}

/**
 * Caught Pokémon worth catching again: their evolution is neither caught nor
 * pending, so a second copy is needed to evolve while the first stays (caught
 * Houndour, no Houndoom → catch another Houndour). Only the nearest stage
 * counts: with Charmander and Charmeleon caught, Charizard is Charmeleon's.
 *
 * With `games`, evolutions none of them can do are left out: levelling up at
 * a place (Leafeon at Eterna Forest, Magnezone at Mt. Coronet) is only
 * possible in Diamond, Pearl and Platinum.
 */
export function extraCopies(
  pokemon: readonly Pokemon[],
  caught: ReadonlySet<number>,
  pending: ReadonlySet<number>,
  maxId: number,
  games?: readonly string[],
): Map<number, EvolutionStep[]> {
  const sinnoh = !games || games.some((g) => SINNOH_GAMES.includes(g));
  const out = new Map<number, EvolutionStep[]>();
  for (const p of pokemon) {
    if (p.id > maxId || !caught.has(p.id)) continue;
    const steps = uncaughtEvolutions(p, caught, maxId).filter(
      (s) => !pending.has(s.speciesId) && (sinnoh || !isPlaceEvolution(s)),
    );
    if (steps.length > 0) out.set(p.id, steps);
  }
  return out;
}

const SINNOH_GAMES = ["diamond", "pearl", "platinum"];

/** Levelling up at one place in Sinnoh: Leafeon, Glaceon, Magnezone, Probopass */
export function isPlaceEvolution(step: EvolutionStep): boolean {
  return step.trigger === "level-up" && /^Level up at /.test(step.details);
}

export function isTradeEvolution(step: EvolutionStep): boolean {
  return step.trigger === "trade";
}

/** One sentence describing how to get from `from` to the step's species. */
export function describeEvolution(fromName: string, step: EvolutionStep): string {
  if (isTradeEvolution(step)) {
    const holding = step.details.match(/holding (.+)$/i);
    return holding
      ? `${fromName} evolves into ${step.displayName} by trade while holding ${holding[1]} — it needs a trade with another player.`
      : `${fromName} evolves into ${step.displayName} by trade — it needs a trade with another player.`;
  }
  if (step.trigger === "level-up" && step.minLevel) {
    return `${fromName} evolves into ${step.displayName} at ${step.details.replace(/^Level/, "level")}.`;
  }
  if (step.trigger === "use-item" && step.item) {
    return `Use a ${step.details} on ${fromName} to get ${step.displayName}.`;
  }
  return `${fromName} evolves into ${step.displayName}: ${step.details.charAt(0).toLowerCase()}${step.details.slice(1)}.`;
}
