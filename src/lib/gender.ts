/**
 * A species' gender ratio for display. PokéAPI's genderRate is eighths female
 * (0–8), or -1 for genderless.
 */

const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/** "87.5% ♂ · 12.5% ♀", "Always female", "Genderless" */
export function genderText(genderRate: number): string {
  if (genderRate === -1) return "Genderless";
  if (genderRate === 0) return "Always male";
  if (genderRate === 8) return "Always female";
  const female = (genderRate / 8) * 100;
  return `${pct(100 - female)} ♂ · ${pct(female)} ♀`;
}

/** The two parts of the ratio bar, in percent; null for genderless. */
export function genderBar(genderRate: number): { male: number; female: number } | null {
  if (genderRate < 0) return null;
  const female = (genderRate / 8) * 100;
  return { male: 100 - female, female };
}
