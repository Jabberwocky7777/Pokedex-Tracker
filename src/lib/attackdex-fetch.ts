import type { MoveDetail, RawMove } from "./move-fetch";
import { buildMoveDetail } from "./move-fetch";

export interface AttackdexDetail extends MoveDetail {
  effect: string;
  shortEffect: string;
  contestType: string | null;
  flavorTextEntries: { text: string; versionGroup: string }[];
  learnedByPokemon: { name: string; url: string }[];
}

const attackdexCache = new Map<string, AttackdexDetail>();

export async function fetchAttackdexDetail(slug: string): Promise<AttackdexDetail> {
  if (attackdexCache.has(slug)) return attackdexCache.get(slug)!;

  const res = await fetch(`https://pokeapi.co/api/v2/move/${slug}`);
  if (!res.ok) throw new Error(`PokéAPI: failed to fetch move "${slug}" (${res.status})`);

  const data = await res.json() as RawMove & {
    effect_entries: { effect: string; short_effect: string; language: { name: string } }[];
    flavor_text_entries: { flavor_text: string; version_group: { name: string }; language: { name: string } }[];
    contest_type: { name: string } | null;
    learned_by_pokemon: { name: string; url: string }[];
  };

  const enEffect = data.effect_entries.find((e) => e.language.name === "en");
  const flavorEntries = data.flavor_text_entries
    .filter((e) => e.language.name === "en")
    .map((e) => ({ text: e.flavor_text.replace(/\n|\f/g, " "), versionGroup: e.version_group.name }));

  const detail: AttackdexDetail = {
    ...buildMoveDetail(slug, data),
    effect: enEffect?.effect ?? "",
    shortEffect: enEffect?.short_effect ?? "",
    contestType: data.contest_type?.name ?? null,
    flavorTextEntries: flavorEntries,
    learnedByPokemon: data.learned_by_pokemon,
  };

  attackdexCache.set(slug, detail);
  return detail;
}
