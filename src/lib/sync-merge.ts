/**
 * Merge logic for sync. Pure functions — no stores, no network — so two devices
 * that both changed things can be reconciled without either losing data.
 *
 * Tracker marks (caught / pending / shiny / placed) merge per entry: for each
 * (field, generation, Pokémon) the side with the newer timestamp wins, which
 * covers un-marks too. Entries without a timestamp (old payloads, v1 backups)
 * count as 0; when both sides are tied, a mark beats a non-mark so nothing is lost.
 *
 * Designer slots, IV sessions, box slots and save summaries stay last-write-wins,
 * but per section and by timestamp, so a stale device can't overwrite a newer one.
 */
import type { BackupData, SectionName, TrackerData } from "./backup";
import { DEX_FIELDS, type DexField, type DexTimestamps } from "../store/useDexStore";

type GenRecord = Record<number, number[]>;

const FIELD_KEY = {
  caught: "caughtByGen",
  pending: "pendingByGen",
  shiny: "shinyByGen",
  placed: "placedByGen",
} as const;

export const SECTIONS: SectionName[] = ["ivChecker", "boxSlots", "designer", "saveSummaries"];

/** A merged tracker always carries every field, whatever the inputs were missing. */
export interface MergedTracker {
  caughtByGen: GenRecord;
  pendingByGen: GenRecord;
  shinyByGen: GenRecord;
  placedByGen: GenRecord;
  updatedAt: DexTimestamps;
}

function fieldRecord(tracker: TrackerData | undefined, field: DexField): GenRecord {
  return tracker?.[FIELD_KEY[field]] ?? {};
}

export function mergeTracker(
  local: TrackerData | undefined,
  remote: TrackerData | undefined,
): MergedTracker {
  const out: MergedTracker = {
    caughtByGen: {},
    pendingByGen: {},
    shinyByGen: {},
    placedByGen: {},
    updatedAt: { caught: {}, pending: {}, shiny: {}, placed: {} },
  };

  for (const field of DEX_FIELDS) {
    const localIds = fieldRecord(local, field);
    const remoteIds = fieldRecord(remote, field);
    const localTs = local?.updatedAt?.[field] ?? {};
    const remoteTs = remote?.updatedAt?.[field] ?? {};

    const gens = new Set(
      [localIds, remoteIds, localTs, remoteTs].flatMap((r) => Object.keys(r).map(Number)),
    );

    for (const gen of gens) {
      const lSet = new Set(localIds[gen] ?? []);
      const rSet = new Set(remoteIds[gen] ?? []);
      const lTs = localTs[gen] ?? {};
      const rTs = remoteTs[gen] ?? {};
      const ids = new Set([
        ...lSet,
        ...rSet,
        ...Object.keys(lTs).map(Number),
        ...Object.keys(rTs).map(Number),
      ]);

      const marked: number[] = [];
      const stamps: Record<number, number> = {};
      for (const id of ids) {
        const lt = lTs[id] ?? 0;
        const rt = rTs[id] ?? 0;
        const value = rt > lt ? rSet.has(id) : lt > rt ? lSet.has(id) : lSet.has(id) || rSet.has(id);
        if (value) marked.push(id);
        const ts = Math.max(lt, rt);
        if (ts > 0) stamps[id] = ts;
      }

      out[FIELD_KEY[field]][gen] = marked.sort((a, b) => a - b);
      if (Object.keys(stamps).length > 0) out.updatedAt[field][gen] = stamps;
    }
  }
  return out;
}

function isEmptySection(name: SectionName, value: unknown): boolean {
  if (value == null) return true;
  if (name === "ivChecker") return ((value as BackupData["ivChecker"]).savedSessions ?? []).length === 0;
  if (name === "designer") return !Array.isArray(value) || value.every((s) => s?.pokemonId == null);
  if (name === "saveSummaries") return ((value as NonNullable<BackupData["saveSummaries"]>).profiles ?? []).length === 0;
  // boxSlots: gen → game → boxes → slots
  return !Object.values(value as NonNullable<BackupData["boxSlots"]>).some((games) =>
    Object.values(games).some((boxes) => boxes.some((box) => box.some((id) => id != null))),
  );
}

/**
 * Merges the server's payload into the local one. Returns a payload that is
 * safe to both apply locally and push back.
 */
export function mergePayload(local: BackupData, remote: BackupData | null | undefined): BackupData {
  if (!remote) return local;

  const merged: BackupData = {
    ...local,
    tracker: mergeTracker(local.tracker, remote.tracker),
    sectionUpdatedAt: { ...local.sectionUpdatedAt },
  };

  for (const name of SECTIONS) {
    const lt = local.sectionUpdatedAt?.[name] ?? 0;
    const rt = remote.sectionUpdatedAt?.[name] ?? 0;
    const remoteValue = remote[name];
    if (remoteValue === undefined) continue;
    // On a tie (normally both 0, i.e. data from before timestamps existed) the
    // server copy wins — unless it is empty and the local one isn't.
    const takeRemote =
      rt > lt || (rt === lt && !(isEmptySection(name, remoteValue) && !isEmptySection(name, local[name])));
    if (takeRemote) {
      (merged as unknown as Record<string, unknown>)[name] = remoteValue;
      merged.sectionUpdatedAt![name] = rt;
    }
  }
  return merged;
}

// ── Comparison ────────────────────────────────────────────────────────────

function sortedKeys<T>(obj: Record<string, T> | undefined, map: (v: T) => unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj ?? {}).sort()) out[k] = map((obj as Record<string, T>)[k]);
  return out;
}

function canonicalTracker(tracker: TrackerData | undefined) {
  const ids = (rec: GenRecord | undefined) => {
    // An empty generation is the same as an absent one
    const nonEmpty = Object.fromEntries(Object.entries(rec ?? {}).filter(([, v]) => v.length > 0));
    return sortedKeys(nonEmpty, (v) => [...v].sort((a, b) => a - b));
  };
  const stamps = (ts: DexTimestamps[DexField] | undefined) =>
    sortedKeys(ts as Record<string, Record<number, number>> | undefined, (byId) => sortedKeys(byId as Record<string, number>, (n) => n));
  return {
    caught: ids(tracker?.caughtByGen),
    pending: ids(tracker?.pendingByGen),
    shiny: ids(tracker?.shinyByGen),
    placed: ids(tracker?.placedByGen),
    updatedAt: DEX_FIELDS.map((f) => stamps(tracker?.updatedAt?.[f])),
  };
}

function canonicalSaves(saves: BackupData["saveSummaries"]) {
  // Fixed field order, so the same data compares equal whichever device wrote it
  const profiles = [...(saves?.profiles ?? [])]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => [p.id, p.label, p.role, p.startBox, p.fileName, p.importedAt, p.saveCount, p.family, p.trainer.name, p.trainer.tid, p.trainer.sid, p.ownOnly ?? false]);
  return { profiles, summaries: sortedKeys(saves?.summaries, (s) => [s.boxNames, s.mons]) };
}

/** True when two payloads carry the same data (ignores exportedAt, version and array order of marks). */
export function payloadsEqual(a: BackupData | null | undefined, b: BackupData | null | undefined): boolean {
  if (!a || !b) return a == b;
  const canonical = (p: BackupData) =>
    JSON.stringify({
      tracker: canonicalTracker(p.tracker),
      ivChecker: p.ivChecker?.savedSessions ?? [],
      boxSlots: p.boxSlots ?? {},
      designer: p.designer ?? [],
      saveSummaries: canonicalSaves(p.saveSummaries),
      sections: SECTIONS.map((s) => p.sectionUpdatedAt?.[s] ?? 0),
    });
  return canonical(a) === canonical(b);
}
