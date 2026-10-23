/**
 * Tidies an encounter area's name for display. The generated data keeps PokéAPI's
 * names as they are ("Cave Of Origin B1f", "Mt Coronet 1f Route 207", "Ice Path (B1F)");
 * this only changes how they are shown — matching and links still use the data's names.
 *
 * - "of", "and", "the", "in", "to", "at" are lower case after the first word
 * - floors are "1F" / "B1F", with no brackets ("Ice Path B1F")
 * - "Mt" is "Mt."
 */
const SMALL_WORDS = new Set(["of", "and", "the", "in", "to", "at"]);

export function areaDisplayName(name: string): string {
  let out = name
    // Floors: 1f / b1f / (1F) → 1F / B1F; "1fsmall Room" → "1F Small Room"
    .replace(/\(\s*([Bb]?\d+[Ff])\s*\)/g, "$1")
    .replace(/\b([Bb]?)(\d+)[Ff](?=[a-z]|\b)/g, (_, b: string, n: string) => `${b.toUpperCase()}${n}F`)
    .replace(/(\d+F)([a-z])/g, (_, floor: string, c: string) => `${floor} ${c.toUpperCase()}`)
    .replace(/\bMt (?=[A-Z])/g, "Mt. ");
  out = out
    .split(" ")
    .map((word, i) => (i > 0 && SMALL_WORDS.has(word.toLowerCase()) ? word.toLowerCase() : word))
    .join(" ");
  return out.replace(/\s{2,}/g, " ").trim();
}
