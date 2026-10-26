/**
 * Merge logic for sync. Pure functions — no stores, no network — so two devices
 * that both changed things can be reconciled without either losing data.
 *
 * Tracker marks (caught / pending / shiny / placed) merge per entry: for each
 * (field, generation, Pokémon) the side with the newer timestamp wins, which
 * covers un-marks too. Entries without a timestamp (old payloads, v1 backups)
 * count as 0; when both sides are tied, a mark beats a non-mark so nothing is lost.
 *
 * Designer slots, IV sessions and box slots stay last-write-wins, but per section
 * and by timestamp, so a stale device can't overwrite a newer one.
 *
 * Imported saves merge per profile: two devices that each import a different
 * save both keep theirs, the newer import of the same save wins, and a removal
 * travels as a timestamp so it isn't undone by a device that still has the save.
 */
import type { BackupData, SectionName, TrackerData } from "./backup";
import { canonicalEntries, mergeEntries, type Entries } from "./entries";

/**
 * Sections merged entry by entry (lib/entries.ts). Listed here rather than
 * imported from backup.ts, which pulls in the stores: this file stays pure.
 */
export const ENTRY_SECTION_NAMES = ["roamers", "notes", "shinyHunts", "workingOn", "journal", "gameProgress"] as const;
import { DEX_FIELDS, type DexField, type DexTimestamps } from "../store/useDexStore";

type GenRecord = Record<number, number[]>;

const FIELD_KEY = {
  caught: "caughtByGen",
  pending: "pendingByGen",
  shiny: "shinyByGen",
  placed: "placedByGen",
} as const;

const SECTIONS: SectionName[] = ["ivChecker", "boxSlots", "designer", "saveSummaries"];

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
  // boxSlots: gen → game → boxes → slots
  return !Object.values(value as NonNullable<BackupData["boxSlots"]>).some((games) =>
    Object.values(games).some((boxes) => boxes.some((box) => box.some((id) => id != null))),
  );
}

type SaveSummaries = NonNullable<BackupData["saveSummaries"]>;

/**
 * Merges imported saves profile by profile. `remoteIsNewer` (the section
 * timestamps) only decides between two copies of the same import whose
 * settings — name, role, start box — differ.
 */
export function mergeSaves(
  local: SaveSummaries | undefined,
  remote: SaveSummaries | undefined,
  remoteIsNewer: boolean,
): SaveSummaries | undefined {
  if (!remote) return local;
  if (!local) return remote;

  const removed: Record<string, number> = { ...local.removed };
  for (const [id, at] of Object.entries(remote.removed ?? {})) removed[id] = Math.max(removed[id] ?? 0, at);

  const localById = new Map((local.profiles ?? []).map((p) => [p.id, p]));
  const remoteById = new Map((remote.profiles ?? []).map((p) => [p.id, p]));
  const profiles: SaveSummaries["profiles"] = [];
  const summaries: SaveSummaries["summaries"] = {};

  for (const id of new Set([...localById.keys(), ...remoteById.keys()])) {
    const l = localById.get(id);
    const r = remoteById.get(id);
    const takeRemote = !l || (!!r && (r.importedAt !== l.importedAt ? r.importedAt > l.importedAt : remoteIsNewer));
    const profile = (takeRemote ? r : l)!;
    // Removed after this copy was imported — importing it again later brings it back
    if ((removed[id] ?? 0) >= profile.importedAt) continue;
    profiles.push(profile);
    const [first, second] = takeRemote ? [remote, local] : [local, remote];
    const summary = first.summaries?.[id] ?? second.summaries?.[id];
    if (summary) summaries[id] = summary;
  }
  return { profiles, summaries, removed };
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

  for (const name of ENTRY_SECTION_NAMES) {
    const entries = mergeEntries(local[name] as Entries<unknown> | undefined, remote[name] as Entries<unknown> | undefined);
    (merged as unknown as Record<string, unknown>)[name] = entries;
  }

  for (const name of SECTIONS) {
    const lt = local.sectionUpdatedAt?.[name] ?? 0;
    const rt = remote.sectionUpdatedAt?.[name] ?? 0;
    if (name === "saveSummaries") {
      merged.saveSummaries = mergeSaves(local.saveSummaries, remote.saveSummaries, rt >= lt);
      if (Math.max(lt, rt) > 0) merged.sectionUpdatedAt![name] = Math.max(lt, rt);
      continue;
    }
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

  // Sections added by a newer version of the app are passed through untouched,
  // so an older copy (an iPhone not yet updated) never strips them from the
  // server — which would also make the two push over each other on every poll.
  const out = merged as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(remote)) {
    if (!(key in out)) out[key] = value;
  }
  for (const [name, at] of Object.entries(remote.sectionUpdatedAt ?? {})) {
    if (!(name in merged.sectionUpdatedAt!)) (merged.sectionUpdatedAt as Record<string, number>)[name] = at;
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
  return {
    profiles,
    summaries: sortedKeys(saves?.summaries, (s) => [s.boxNames, s.mons]),
    removed: sortedKeys(saves?.removed, (at) => at),
  };
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
      entries: ENTRY_SECTION_NAMES.map((name) => canonicalEntries(p[name])),
    });
  return canonical(a) === canonical(b);
}
