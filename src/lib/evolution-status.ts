import type { EvolutionStep, Pokemon } from "../types";

// Shared by the "Needs attention" filter and the detail panel's evolution reminder,
// so both agree on what counts as "caught but not evolved yet".

/**
 * The evolutions of `pokemon` that are still uncaught. `maxId` limits this to
 * species that exist in the active generation (Eevee has no Sylveon in Gen IV).
 */
export function uncaughtEvolutions(
  pokemon: Pokemon,
  caught: ReadonlySet<number>,
  maxId: number,
): EvolutionStep[] {
  return pokemon.evolvesTo.filter((step) => step.speciesId <= maxId && !caught.has(step.speciesId));
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
