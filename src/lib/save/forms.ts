/**
 * Form names for the Gen IV species that have more than one form.
 * Shown on the Pokémon card only — the tracker itself stays species-level.
 */

const UNOWN = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "!", "?"];
const CLOAKS = ["Plant", "Sandy", "Trash"];
const SEAS = ["West", "East"];
// Arceus' form index is the internal type index, which includes the ??? type at 9
const ARCEUS = [
  "Normal", "Fighting", "Flying", "Poison", "Ground", "Rock", "Bug", "Ghost", "Steel", "???",
  "Fire", "Water", "Grass", "Electric", "Psychic", "Ice", "Dragon", "Dark",
];

const FORMS: Record<number, string[]> = {
  172: ["", "Spiky-eared"],
  201: UNOWN,
  386: ["Normal", "Attack", "Defense", "Speed"],
  412: CLOAKS,
  413: CLOAKS,
  422: SEAS,
  423: SEAS,
  479: ["Normal", "Heat", "Wash", "Frost", "Fan", "Mow"],
  487: ["Altered", "Origin"],
  492: ["Land", "Sky"],
  493: ARCEUS,
};

/** The form's name, or null when the species has no forms (or the index is unknown). */
export function formName(species: number, form: number): string | null {
  return FORMS[species]?.[form] || null;
}
