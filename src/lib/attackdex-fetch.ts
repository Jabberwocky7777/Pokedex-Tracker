import type { MoveDetail } from "./move-fetch";
import { buildMoveDetail, fetchLearners, loadMoveIndex } from "./move-fetch";
import { VERSION_GROUPS } from "./move-data";

export interface AttackdexDetail extends MoveDetail {
  effect: string;
  shortEffect: string;
  contestType: string | null;
  flavorTextEntries: { text: string; versionGroup: string }[];
  /** Species ids that learn the move in at least one Gen III–IV game, by any method */
  learnedBy: number[];
}

const attackdexCache = new Map<string, AttackdexDetail>();

/** Everything the Attackdex shows for a move, from the generated data files. */
export async function fetchAttackdexDetail(slug: string): Promise<AttackdexDetail> {
  const cached = attackdexCache.get(slug);
  if (cached) return cached;

  const record = (await loadMoveIndex()).bySlug.get(slug);
  if (!record) throw new Error(`Unknown move "${slug}"`);

  const detail: AttackdexDetail = {
    ...buildMoveDetail(record),
    effect: record.effect,
    shortEffect: record.shortEffect,
    contestType: record.contest,
    flavorTextEntries: VERSION_GROUPS.flatMap((versionGroup) => {
      const text = record.flavor[versionGroup];
      return text ? [{ text, versionGroup }] : [];
    }),
    learnedBy: await fetchLearners(record.slug),
  };

  attackdexCache.set(slug, detail);
  return detail;
}
