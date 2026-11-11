/**
 * Backup & restore utilities for the Pokédex Tracker.
 *
 * A backup file is exactly the payload that sync pushes — both come from
 * buildPayload() in sync.ts, so a field can't be synced but missing from
 * backups or the other way round.
 *
 * Backup format (version 2):
 * {
 *   "version": 2,
 *   "exportedAt": "<ISO string>",
 *   "tracker": {
 *     "caughtByGen":  { "<gen>": [ids] },
 *     "pendingByGen": { "<gen>": [ids] },
 *     "shinyByGen":   { "<gen>": [ids] },
 *     "placedByGen":  { "<gen>": [ids] },      // in its own living-dex slot
 *     "updatedAt":    { "caught" | "pending" | "shiny" | "placed": { "<gen>": { "<id>": epochMs } } }
 *   },
 *   "ivChecker": { "savedSessions": [...] },
 *   "boxSlots":  { "<gen>": { "<game>": [[id | null, …30], …] } },
 *   "designer":  [ …90 slots ],
 *   "saveSummaries": {
 *     "profiles":  [ { id, label, role, startBox, fileName, importedAt, saveCount, family, trainer } ],
 *     "summaries": { "<profile id>": { "boxNames": [18 names],
 *                                      "mons": [ [box | -1 for party, slot, species, form, shiny, level, isEgg, own], … ] } },
 *     "removed":   { "<profile id>": epochMs }   // optional: saves removed on some device
 *   },
 *   "roamers": { "<game>:<dex number>": { "met": true, "at": epochMs } },   // entry-merged, see lib/entries.ts
 *   "notes":   { "<generation>:<dex number>": { "text": "…", "at": epochMs } },
 *   "shinyHunts": { "<hunt id>": { "generation", "pokemonId", "method", "count", "startedAt", "foundAt"?, "at": epochMs } },
 *   "workingOn": { "<item id>": { "text", "status", "link"?, "note"?, "createdAt", "order", "at": epochMs } },
 *   "journal": { "<entry id>": { "date": "YYYY-MM-DD", "game", "text", "createdAt", "at": epochMs } },
 *   "trips": { "<trip id>": { "slugs": [area slugs], "generation", "games": [games], "grouped", "printedAt", "at": epochMs } },
 *   "gameProgress": { "<game>": { "badges": [badge ids], "milestones": { "<id>": { "done", "at"?, "source" } }, "at": epochMs } },
 *   "sectionUpdatedAt": { "ivChecker": epochMs, "boxSlots": epochMs, "designer": epochMs, "saveSummaries": epochMs }
 * }
 *
 * saveSummaries is the slim view of each imported game save. The .sav files and
 * the fully parsed saves (IVs, moves, …) never leave the device that imported them.
 *
 * Version 1 files (no shinyByGen, updatedAt or sectionUpdatedAt) still restore:
 * missing shiny marks mean "none" and missing timestamps count as 0. Files from
 * before placedByGen / saveSummaries existed restore the same way.
 */

import { useDexStore } from "../store/useDexStore";
import type { DexTimestamps } from "../store/useDexStore";
import { useIvStore } from "../store/useIvStore";
import { useBoxSlotStore } from "../store/useBoxSlotStore";
import { isDesignerSlot, useDesignerStore } from "../store/useDesignerStore";
import type { DesignerSlot } from "../store/useDesignerStore";
import type { Pokemon } from "../types";
import { useSaveStore } from "../store/useSaveStore";
import type { SaveProfile, SaveSummary } from "./save/types";
import { buildPayload } from "./sync";
import { isEntries, restoreEntries, type Entries } from "./entries";
import { useRoamerStore, type RoamerStatus } from "../store/useRoamerStore";
import { useNotesStore, type PokemonNote } from "../store/useNotesStore";
import { useHuntStore, type ShinyHunt } from "../store/useHuntStore";
import { useWorkingOnStore, WORK_STATUSES, type WorkItem, type WorkStatus } from "../store/useWorkingOnStore";
import { useJournalStore, type JournalEntry } from "../store/useJournalStore";
import { useGameProgressStore } from "../store/useGameProgressStore";
import { useTripStore, type Trip } from "../store/useTripStore";
import type { GameProgress } from "./game-progress";
import { liveEntries } from "./entries";
import { stampNow } from "./clock";
import { notesIn } from "./notes";
import { generationVersions } from "./generation";
import { GAME_LABELS } from "../types";
import { notesMarkdown } from "./notes-export";
import { saveTextFile, type SaveResult } from "./save-file";
import { storageDelete, storageGet, storageSet } from "./save/storage";

/** The sections that merge entry by entry, each with the store that holds it. */
export const ENTRY_SECTIONS = {
  roamers: useRoamerStore,
  notes: useNotesStore,
  shinyHunts: useHuntStore,
  workingOn: useWorkingOnStore,
  journal: useJournalStore,
  gameProgress: useGameProgressStore,
  trips: useTripStore,
} as const;
export type EntrySectionName = keyof typeof ENTRY_SECTIONS;

/** Version written by buildPayload(); restore accepts this and version 1. */
export const BACKUP_VERSION = 2;

export type SectionName = "ivChecker" | "boxSlots" | "designer" | "saveSummaries";

export interface TrackerData {
  caughtByGen: Record<number, number[]>;
  pendingByGen: Record<number, number[]>;
  shinyByGen?: Record<number, number[]>;
  placedByGen?: Record<number, number[]>;
  // Partial: payloads written before a field existed have no timestamps for it
  updatedAt?: Partial<DexTimestamps>;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  tracker: TrackerData;
  ivChecker: {
    savedSessions: ReturnType<typeof useIvStore.getState>["savedSessions"];
  };
  boxSlots?: Record<number, Record<string, (number | null)[][]>>;
  designer?: DesignerSlot[];
  /** Imported game saves: profile metadata plus a slim per-Pokémon summary of each. */
  saveSummaries?: {
    profiles: SaveProfile[];
    summaries: Record<string, SaveSummary>;
    /** Profile id → when it was removed (epoch ms), so a removal reaches other devices. Absent in older payloads. */
    removed?: Record<string, number>;
  };
  /** Roaming legendaries met, keyed "<game>:<dex number>". Merged entry by entry (lib/entries.ts). */
  roamers?: Entries<RoamerStatus>;
  /** Per-Pokémon notes, keyed "<generation>:<dex number>". Merged note by note. */
  notes?: Entries<PokemonNote>;
  /** Shiny hunts, keyed by a generated id. Merged hunt by hunt. */
  shinyHunts?: Entries<ShinyHunt>;
  /** The "Working on" list, keyed by a generated id. Merged item by item. */
  workingOn?: Entries<WorkItem>;
  /** The run journal, keyed by a generated id. Merged entry by entry. */
  journal?: Entries<JournalEntry>;
  /** Game Progress (badges, story milestones), keyed by game. Merged game by game. */
  gameProgress?: Entries<GameProgress>;
  /** Printed What's next selections, for checking off on another device. Merged trip by trip. */
  trips?: Entries<Trip>;
  /** When each last-write-wins section was last changed on some device (epoch ms). */
  sectionUpdatedAt?: Partial<Record<SectionName, number>>;
}

// ─── Export ────────────────────────────────────────────────────────────────────

/**
 * A quoted CSV field. A value starting with = + - @ (or a tab / carriage return)
 * would run as a formula when the file is opened in Excel or Sheets, so it gets
 * a leading apostrophe, which spreadsheets show as plain text.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

export function csvText(value: string): string {
  const text = FORMULA_START.test(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadBackup(): Promise<SaveResult> {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return saveTextFile(JSON.stringify(buildPayload(), null, 2), `pokedex-backup-${date}.json`, "application/json");
}

export function exportFullCSV(allPokemon: Pokemon[]): Promise<SaveResult> {
  const { caughtByGen, pendingByGen, shinyByGen, placedByGen, updatedAt } = useDexStore.getState();
  const { slotsByGen } = useBoxSlotStore.getState();
  const notes = useNotesStore.getState().entries;

  const pokemonMap = new Map(allPokemon.map((p) => [p.id, p]));

  const gens = new Set([
    ...Object.keys(caughtByGen).map(Number),
    ...Object.keys(pendingByGen).map(Number),
    ...Object.keys(shinyByGen).map(Number),
    ...Object.keys(placedByGen).map(Number),
    ...liveEntries(notes).map(([key]) => Number(key.split(":")[0])),
  ]);

  const rows: string[] = [
    "dexNumber,name,gen,caught,pending,shiny,placed,boxGame,boxNumber,boxSlot,caughtDate,gamesAvailable,note",
  ];

  for (const gen of gens) {
    const caught = new Set(caughtByGen[gen] ?? []);
    const pending = new Set(pendingByGen[gen] ?? []);
    const shiny = new Set(shinyByGen[gen] ?? []);
    const placed = new Set(placedByGen[gen] ?? []);
    const noted = new Map(notesIn(notes, gen).map((n) => [n.pokemonId, n.text]));
    const allIds = [...new Set([...caught, ...pending, ...shiny, ...placed, ...noted.keys()])].sort((a, b) => a - b);
    const genGames = generationVersions(gen) as string[];
    const caughtStamps = updatedAt.caught?.[gen] ?? {};

    // Build box slot reverse map
    const slotMap = new Map<number, { game: string; box: number; slot: number }>();
    const genBoxes = slotsByGen[gen] ?? {};
    for (const [game, boxes] of Object.entries(genBoxes)) {
      boxes.forEach((box, boxIdx) => {
        box.forEach((id, slotIdx) => {
          if (id != null) slotMap.set(id, { game, box: boxIdx + 1, slot: slotIdx + 1 });
        });
      });
    }

    for (const id of allIds) {
      const p = pokemonMap.get(id);
      const name = p?.displayName ?? `#${id}`;
      const slotInfo = slotMap.get(id);
      rows.push(
        [
          id,
          csvText(name),
          gen,
          caught.has(id) ? 1 : 0,
          pending.has(id) ? 1 : 0,
          shiny.has(id) ? 1 : 0,
          placed.has(id) ? 1 : 0,
          slotInfo ? csvText(slotInfo.game) : "",
          slotInfo?.box ?? "",
          slotInfo?.slot ?? "",
          // The time of its latest caught mark; empty when not caught or caught before dates were kept
          caught.has(id) && caughtStamps[id] ? new Date(caughtStamps[id]).toISOString().slice(0, 10) : "",
          csvText(
            (p?.availableInGames ?? [])
              .filter((g) => genGames.includes(g))
              .map((g) => GAME_LABELS[g] ?? g)
              .join(" / "),
          ),
          csvText(noted.get(id) ?? ""),
        ].join(","),
      );
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  return saveTextFile(rows.join("\n"), `pokedex-export-${date}.csv`, "text/csv");
}

/** The Working on list, every Pokémon note and the journal, as Markdown. */
export function notesExportText(allPokemon: Pokemon[]): string {
  const byId = new Map(allPokemon.map((p) => [p.id, p.displayName]));
  return notesMarkdown({
    workingOn: useWorkingOnStore.getState().entries,
    notes: useNotesStore.getState().entries,
    journal: useJournalStore.getState().entries,
    generations: [3, 4],
    nameOf: (id) => byId.get(id) ?? `#${id}`,
    now: Date.now(),
  });
}

/** Saves the notes as a .md file (a download, or the share sheet in the iOS app). */
export function downloadNotes(allPokemon: Pokemon[]): Promise<SaveResult> {
  const date = new Date().toISOString().slice(0, 10);
  return saveTextFile(notesExportText(allPokemon), `pokedex-notes-${date}.md`, "text/markdown");
}

// ─── Import / Restore ─────────────────────────────────────────────────────────

export type RestoreResult =
  /** `skipped`: what a lenient restore left out as malformed (empty otherwise) */
  { ok: true; skipped?: string[] } | { ok: false; error: string };

/** A backup that passed validation, ready to show in the confirmation and then apply. */
export type PreparedRestore = { ok: true; data: BackupData; skipped: string[] } | { ok: false; error: string };

/**
 * Checks a parsed backup without changing anything. Lenient (a server snapshot,
 * which sync wrote): malformed sections and entries are left out, as sync does,
 * rather than refusing the whole copy. A backup file stays strict: a bad one
 * is better refused than half-restored.
 */
export function prepareRestore(raw: unknown, { lenient = false }: { lenient?: boolean } = {}): PreparedRestore {
  let skipped: string[] = [];
  if (lenient) {
    const clean = sanitizeRemote(raw);
    if (!clean.data) return { ok: false, error: "Invalid backup — expected a JSON object." };
    skipped = [
      ...clean.dropped,
      ...Object.entries(clean.passThrough).flatMap(([name, entries]) =>
        Object.keys(entries).map((key) => `${name}[${key}]`),
      ),
    ];
    raw = clean.data;
  }
  const validated = validateBackup(raw);
  if (!validated.ok) return validated;
  return { ok: true, data: validated.data, skipped };
}

/**
 * Replaces local data with a parsed backup. Restoring is a deliberate "make it
 * look like this" action, so every mark that changes is stamped now and the
 * restored sections count as freshly edited — the restore then wins in sync
 * rather than being merged away. The UI goes through prepareRestore, a
 * confirmation and applyRestore (which keeps an undo point); this is both in one.
 */
export function restoreBackupData(raw: unknown, options: { lenient?: boolean } = {}): RestoreResult {
  const prepared = prepareRestore(raw, options);
  if (!prepared.ok) return prepared;
  applyRestoreNow(prepared.data);
  return prepared.skipped.length > 0 ? { ok: true, skipped: prepared.skipped } : { ok: true };
}

/**
 * Applies a prepared restore, first keeping what is on this device now (in
 * IndexedDB) so the restore can be undone. `label` says what was restored, for
 * the "Undo restore" button. If the undo point can't be kept, the restore
 * still goes ahead and `undoKept` is false.
 */
export async function applyRestore(data: BackupData, label: string): Promise<{ undoKept: boolean }> {
  let undoKept = true;
  try {
    const point: RestoreUndoPoint = { at: Date.now(), label, payload: buildPayload() };
    await storageSet(UNDO_KEY, point);
  } catch {
    undoKept = false;
  }
  applyRestoreNow(data);
  return { undoKept };
}

const UNDO_KEY = "restore-undo";

export interface RestoreUndoPoint {
  /** When the restore was made (device clock) */
  at: number;
  /** What was restored ("backup of 3 Nov", "server copy of …") */
  label: string;
  /** This device's data from just before the restore */
  payload: BackupData;
}

/** The undo point of the last restore on this device, if any. */
export async function restoreUndoPoint(): Promise<RestoreUndoPoint | null> {
  try {
    const point = await storageGet<RestoreUndoPoint>(UNDO_KEY);
    return point && typeof point.at === "number" && point.payload ? point : null;
  } catch {
    return null;
  }
}

/** Puts back what was on this device before the last restore. It syncs like any other restore. */
export async function undoRestore(): Promise<RestoreResult> {
  const point = await restoreUndoPoint();
  if (!point) return { ok: false, error: "There is no restore to undo." };
  const result = restoreBackupData(point.payload, { lenient: true });
  if (result.ok) await forgetRestoreUndo();
  return result;
}

export async function forgetRestoreUndo(): Promise<void> {
  try {
    await storageDelete(UNDO_KEY);
  } catch {
    // Nothing kept, or storage unavailable: nothing to forget
  }
}

function applyRestoreNow(data: BackupData): void {
  // v1 files have no shinyByGen (and older v2 files no placedByGen) — importTracker treats that as "none"
  useDexStore.getState().importTracker(data.tracker);

  useIvStore.setState({ savedSessions: data.ivChecker.savedSessions });

  if (data.boxSlots) {
    useBoxSlotStore.getState().setSlotsByGen(data.boxSlots);
  }

  if (Array.isArray(data.designer)) {
    useDesignerStore.getState().setSlots(data.designer);
  }

  if (data.saveSummaries && Array.isArray(data.saveSummaries.profiles)) {
    // A save removed since the backup was made has a tombstone that outlives its
    // importedAt, and the next sync would remove it again. Restoring it counts
    // as importing it now.
    const removed = useSaveStore.getState().removedProfiles;
    const now = stampNow();
    const profiles = data.saveSummaries.profiles.map((p) => {
      const removedAt = removed[p.id] ?? 0;
      // Strictly after the tombstone, even when both fall in the same millisecond
      return removedAt >= p.importedAt ? { ...p, importedAt: Math.max(now, removedAt + 1) } : p;
    });
    useSaveStore.getState().replaceAll(profiles, data.saveSummaries.summaries ?? {});
  }

  // Entry-merged sections: what the backup has is written as of now, the rest removed as of now
  // (and "now" is after every stamp already there, so the restore wins the merge)
  for (const name of Object.keys(ENTRY_SECTIONS) as EntrySectionName[]) {
    const store = ENTRY_SECTIONS[name];
    const current = store.getState().entries as Entries<unknown>;
    const now = stampNow(Math.max(0, ...Object.values(current).map((e) => e.at)) || undefined);
    const restored = restoreEntries(current, data[name] as Entries<unknown> | undefined, now);
    store.getState().replaceAll(restored as never);
  }
}

/** Backup files larger than this are refused before they are read. Real ones are well under 1 MB per save. */
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

/** Reads and validates a backup file. Nothing is changed until the result is passed to applyRestore. */
export async function readBackupFile(file: File): Promise<PreparedRestore> {
  if (file.size > MAX_BACKUP_BYTES) {
    return { ok: false, error: "That file is over 10 MB, which is far larger than any backup. Is it the right file?" };
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: "Could not read the file." };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Could not parse backup file — is it valid JSON?" };
  }
  return prepareRestore(raw);
}

// ─── What a restore would change ─────────────────────────────────────────────

export interface RestoreRow {
  label: string;
  /** On this device now */
  now: number;
  /** In the copy being restored */
  then: number;
  /** Entries here now that the restore removes or replaces with an older copy */
  lost: number;
}

const ENTRY_LABELS: Record<EntrySectionName, string> = {
  notes: "Pokémon notes",
  journal: "Journal entries",
  workingOn: "Working on items",
  shinyHunts: "Shiny hunts",
  roamers: "Roamers met",
  gameProgress: "Games with progress",
  trips: "Printed trips",
};

const markCount = (byGen: Record<number, number[]> | undefined, gen: number) => (byGen?.[gen] ?? []).length;

/**
 * Side by side, what is on this device and what the restore would put there,
 * section by section — for the confirmation before restoring.
 */
export function compareForRestore(current: BackupData, incoming: BackupData): RestoreRow[] {
  const rows: RestoreRow[] = [];
  const gens = [
    ...new Set([...Object.keys(current.tracker.caughtByGen), ...Object.keys(incoming.tracker.caughtByGen)].map(Number)),
  ].sort((a, b) => a - b);
  for (const gen of gens) {
    const before = new Set(current.tracker.caughtByGen[gen] ?? []);
    const after = new Set(incoming.tracker.caughtByGen[gen] ?? []);
    rows.push({
      label: `Caught, Gen ${gen}`,
      now: markCount(current.tracker.caughtByGen, gen),
      then: markCount(incoming.tracker.caughtByGen, gen),
      lost: [...before].filter((id) => !after.has(id)).length,
    });
  }
  for (const name of Object.keys(ENTRY_SECTIONS) as EntrySectionName[]) {
    const mine = Object.fromEntries(liveEntries(current[name] as Entries<unknown> | undefined));
    const theirs = Object.fromEntries(liveEntries(incoming[name] as Entries<unknown> | undefined));
    const lost = Object.entries(mine).filter(([key, entry]) => !theirs[key] || theirs[key].at < entry.at).length;
    rows.push({ label: ENTRY_LABELS[name], now: Object.keys(mine).length, then: Object.keys(theirs).length, lost });
  }
  const saves = (d: BackupData) => d.saveSummaries?.profiles ?? [];
  const theirSaves = new Set(saves(incoming).map((p) => p.id));
  rows.push({
    label: "Imported saves",
    now: saves(current).length,
    then: saves(incoming).length,
    lost: saves(current).filter((p) => !theirSaves.has(p.id)).length,
  });
  const used = (d: BackupData) => (d.designer ?? []).filter((slot) => slot && slot.pokemonId != null).length;
  rows.push({ label: "Designer slots in use", now: used(current), then: used(incoming), lost: 0 });
  return rows;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateBackup(raw: unknown): { ok: true; data: BackupData } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Invalid backup file — expected a JSON object." };
  }

  const obj = { ...(raw as Record<string, unknown>) };

  // Files written by the old "Export JSON" button used different key names
  // (ivSessions, designer.slots) that restore used to reject. Accept them.
  if (!obj.ivChecker && obj.ivSessions) obj.ivChecker = obj.ivSessions;
  const designer = obj.designer as Record<string, unknown> | unknown[] | undefined;
  if (designer && !Array.isArray(designer) && Array.isArray(designer.slots)) {
    obj.designer = designer.slots;
  }

  const SUPPORTED_VERSIONS = [1, 2];
  if (!SUPPORTED_VERSIONS.includes(obj.version as number)) {
    return {
      ok: false,
      error: `Unsupported backup version: ${String(obj.version)}. Expected version 1 or 2.`,
    };
  }

  const tracker = obj.tracker as Record<string, unknown> | null | undefined;
  if (!isGenRecord(tracker && tracker.caughtByGen)) {
    return { ok: false, error: "Invalid backup: tracker.caughtByGen is malformed." };
  }
  if (!isGenRecord(tracker && tracker.pendingByGen)) {
    return { ok: false, error: "Invalid backup: tracker.pendingByGen is malformed." };
  }
  if (tracker?.shinyByGen !== undefined && !isGenRecord(tracker.shinyByGen)) {
    return { ok: false, error: "Invalid backup: tracker.shinyByGen is malformed." };
  }
  if (tracker?.placedByGen !== undefined && !isGenRecord(tracker.placedByGen)) {
    return { ok: false, error: "Invalid backup: tracker.placedByGen is malformed." };
  }

  const iv = obj.ivChecker as Record<string, unknown> | null | undefined;
  if (!iv || !Array.isArray(iv.savedSessions)) {
    return { ok: false, error: "Invalid backup: ivChecker.savedSessions is missing." };
  }
  if (!iv.savedSessions.every(isIvSession)) {
    return { ok: false, error: "Invalid backup: ivChecker.savedSessions is malformed." };
  }

  // The optional sections are stored as they are, so a wrong shape would be
  // saved to the device and break the screens that read it.
  if (obj.boxSlots !== undefined && !isBoxSlots(obj.boxSlots)) {
    return { ok: false, error: "Invalid backup: boxSlots is malformed." };
  }
  if (obj.designer !== undefined && !(Array.isArray(obj.designer) && obj.designer.every(isDesignerSlot))) {
    return { ok: false, error: "Invalid backup: designer is malformed." };
  }
  if (obj.saveSummaries !== undefined && !isSaveSummaries(obj.saveSummaries)) {
    return { ok: false, error: "Invalid backup: saveSummaries is malformed." };
  }

  for (const name of Object.keys(ENTRY_SECTIONS) as EntrySectionName[]) {
    if (obj[name] === undefined) continue;
    const valid =
      isEntries(obj[name]) &&
      Object.values(obj[name]).every(
        (entry) => entry.removed || ENTRY_SHAPES[name](entry as unknown as Record<string, unknown>),
      );
    if (!valid) return { ok: false, error: `Invalid backup: ${name} is malformed.` };
  }

  return { ok: true, data: obj as unknown as BackupData };
}

/**
 * The server's copy, made safe to merge. Unlike a restore, sync can't refuse a
 * payload and stop — so instead of rejecting it, every section (and every
 * entry of the entry-merged ones) with the wrong shape is dropped, and the
 * rest is kept. A dropped section then merges as "not on the server": the
 * local copy is kept and the next push writes it back over the bad one.
 * An entry that is stamped but shaped unlike anything this version knows is
 * passed through instead (`passThrough`): not applied, but never deleted.
 * `dropped` names what was taken out ("tracker.shinyByGen", "notes[4:94]", …);
 * `data` is null when the payload isn't an object at all.
 */
export interface SanitizedRemote {
  data: BackupData | null;
  /** What was taken out as broken — the next push writes the good copy over it */
  dropped: string[];
  /**
   * Entries with a valid stamp but a shape this version doesn't know — possibly
   * written by a newer version of the app. They aren't applied here, but a push
   * carries them through unchanged (see withPassThrough), so an older device
   * never deletes a newer one's data.
   */
  passThrough: Partial<Record<EntrySectionName, Record<string, { at: number }>>>;
}

export function sanitizeRemote(raw: unknown): SanitizedRemote {
  if (!isPlainObject(raw)) return { data: null, dropped: raw == null ? [] : ["payload"], passThrough: {} };
  const dropped: string[] = [];
  const passThrough: SanitizedRemote["passThrough"] = {};
  const obj: Record<string, unknown> = { ...raw };

  // Tracker: a field's marks and its timestamps go together. Keeping the
  // timestamps of a dropped field would make every local mark look older than
  // an absent remote one, and the merge would un-mark them.
  if (obj.tracker !== undefined) {
    if (!isPlainObject(obj.tracker)) {
      delete obj.tracker;
      dropped.push("tracker");
    } else {
      const tracker: Record<string, unknown> = { ...obj.tracker };
      const updatedAt: Record<string, unknown> = isPlainObject(tracker.updatedAt) ? { ...tracker.updatedAt } : {};
      if (tracker.updatedAt !== undefined && !isPlainObject(tracker.updatedAt)) dropped.push("tracker.updatedAt");
      for (const [field, key] of [
        ["caught", "caughtByGen"],
        ["pending", "pendingByGen"],
        ["shiny", "shinyByGen"],
        ["placed", "placedByGen"],
      ] as const) {
        if (tracker[key] !== undefined && !isGenRecord(tracker[key])) {
          delete tracker[key];
          delete updatedAt[field];
          dropped.push(`tracker.${key}`);
        } else if (updatedAt[field] !== undefined && !isTimestamps(updatedAt[field])) {
          // Marks without times count as time 0: a tie, which keeps every mark
          delete updatedAt[field];
          dropped.push(`tracker.updatedAt.${field}`);
        }
      }
      tracker.updatedAt = updatedAt;
      obj.tracker = tracker;
    }
  }

  const section = (name: string, valid: (value: unknown) => boolean) => {
    if (obj[name] !== undefined && !valid(obj[name])) {
      delete obj[name];
      dropped.push(name);
    }
  };
  // Item by item where a section is a list: a bad Designer slot is reset, a bad
  // IV session, save profile, summary or summary row is left out, and the rest
  // of the section is kept.
  section("ivChecker", (v) => isPlainObject(v) && Array.isArray(v.savedSessions));
  if (isPlainObject(obj.ivChecker)) {
    const sessions = obj.ivChecker.savedSessions as unknown[];
    const good = sessions.filter(isIvSession);
    if (good.length < sessions.length) {
      dropped.push(...sessions.map((s, i) => (isIvSession(s) ? "" : `ivChecker.savedSessions[${i}]`)).filter(Boolean));
      obj.ivChecker = { ...obj.ivChecker, savedSessions: good };
    }
  }
  section("boxSlots", isBoxSlots);
  section("designer", Array.isArray);
  if (Array.isArray(obj.designer)) {
    obj.designer = (obj.designer as unknown[]).map((slot, i) => {
      if (isDesignerSlot(slot)) return slot;
      dropped.push(`designer[${i}]`);
      return { slotIndex: i };
    });
  }
  section(
    "saveSummaries",
    (v) =>
      isPlainObject(v) &&
      Array.isArray(v.profiles) &&
      (v.summaries === undefined || isPlainObject(v.summaries)) &&
      (v.removed === undefined || isNumberRecord(v.removed)),
  );
  if (isPlainObject(obj.saveSummaries)) {
    const saves = obj.saveSummaries as { profiles: unknown[]; summaries?: Record<string, unknown> };
    const profiles = saves.profiles.filter((p) => {
      const ok = isSaveProfile(p) && typeof (p as Record<string, unknown>).importedAt === "number";
      if (!ok) dropped.push(`saveSummaries.profiles[${isPlainObject(p) ? String(p.id) : "?"}]`);
      return ok;
    });
    const summaries: Record<string, unknown> = {};
    for (const [id, summary] of Object.entries(saves.summaries ?? {})) {
      if (!isPlainObject(summary) || !Array.isArray(summary.boxNames) || !Array.isArray(summary.mons)) {
        dropped.push(`saveSummaries.summaries[${id}]`);
        continue;
      }
      const mons = summary.mons.filter(isSummaryTuple);
      if (mons.length < summary.mons.length) dropped.push(`saveSummaries.summaries[${id}].mons`);
      if (!summary.boxNames.every((n) => typeof n === "string"))
        dropped.push(`saveSummaries.summaries[${id}].boxNames`);
      summaries[id] = { ...summary, boxNames: summary.boxNames.map((n) => (typeof n === "string" ? n : "")), mons };
    }
    obj.saveSummaries = { ...saves, profiles, ...(saves.summaries ? { summaries } : {}) };
  }
  section("sectionUpdatedAt", isNumberRecord);

  for (const name of Object.keys(ENTRY_SECTIONS) as EntrySectionName[]) {
    const value = obj[name];
    if (value === undefined) continue;
    if (!isPlainObject(value)) {
      delete obj[name];
      dropped.push(name);
      continue;
    }
    const kept: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      const stamped = isPlainObject(entry) && typeof entry.at === "number";
      if (stamped && (entry.removed === true || ENTRY_SHAPES[name](entry))) kept[key] = entry;
      else if (stamped) (passThrough[name] ??= {})[key] = entry as { at: number };
      else dropped.push(`${name}[${key}]`);
    }
    obj[name] = kept;
  }

  return { data: obj as unknown as BackupData, dropped, passThrough };
}

/**
 * The payload to push: `merged` plus the entries `sanitizeRemote` passed
 * through, wherever this device has no newer entry of its own under that key.
 */
export function withPassThrough(merged: BackupData, passThrough: SanitizedRemote["passThrough"]): BackupData {
  const out: Record<string, unknown> = { ...merged };
  for (const [name, entries] of Object.entries(passThrough) as [EntrySectionName, Record<string, { at: number }>][]) {
    const section: Record<string, { at: number }> = { ...((merged[name] ?? {}) as Record<string, { at: number }>) };
    for (const [key, entry] of Object.entries(entries)) {
      if (!section[key] || entry.at >= section[key].at) section[key] = entry;
    }
    out[name] = section;
  }
  return out as unknown as BackupData;
}

/** gen → id → epoch ms */
function isTimestamps(value: unknown): boolean {
  return isPlainObject(value) && Object.values(value).every(isNumberRecord);
}

function isNumberRecord(value: unknown): boolean {
  return isPlainObject(value) && Object.values(value).every((n) => typeof n === "number");
}

/**
 * The shape each entry-merged section's live entries must have (tombstones only
 * need their stamp). Restore writes entries as they are, so a wrong shape would
 * break the screens that read them.
 */
const ENTRY_SHAPES: Record<EntrySectionName, (entry: Record<string, unknown>) => boolean> = {
  roamers: (e) => typeof e.met === "boolean",
  notes: (e) => typeof e.text === "string",
  shinyHunts: (e) =>
    typeof e.generation === "number" &&
    typeof e.pokemonId === "number" &&
    typeof e.count === "number" &&
    typeof e.method === "string" &&
    typeof e.startedAt === "number" &&
    (e.foundAt === undefined || typeof e.foundAt === "number"),
  workingOn: isWorkItem,
  journal: (e) =>
    typeof e.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(e.date) &&
    typeof e.game === "string" &&
    typeof e.text === "string" &&
    typeof e.createdAt === "number",
  gameProgress: (e) =>
    Array.isArray(e.badges) &&
    e.badges.every((b) => typeof b === "number") &&
    isPlainObject(e.milestones) &&
    Object.values(e.milestones as object).every((m) => isPlainObject(m) && typeof m.done === "boolean"),
  trips: (e) =>
    Array.isArray(e.slugs) &&
    e.slugs.every((x) => typeof x === "string") &&
    typeof e.generation === "number" &&
    Array.isArray(e.games) &&
    typeof e.printedAt === "number",
};

function isWorkItem(e: Record<string, unknown>): boolean {
  if (typeof e.text !== "string" || typeof e.createdAt !== "number" || typeof e.order !== "number") return false;
  if (!WORK_STATUSES.includes(e.status as WorkStatus)) return false;
  if (e.note !== undefined && typeof e.note !== "string") return false;
  if (e.extraLinks !== undefined && !(Array.isArray(e.extraLinks) && e.extraLinks.every(isWorkLink))) return false;
  return e.link === undefined || isWorkLink(e.link);
}

function isWorkLink(link: unknown): boolean {
  if (!isPlainObject(link)) return false;
  switch (link.kind) {
    case "pokemon":
      return typeof link.id === "number" && (link.generation === undefined || typeof link.generation === "number");
    case "route":
      return typeof link.slug === "string" && typeof link.name === "string";
    case "game":
      return typeof link.game === "string";
    default:
      return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** gen → game → boxes → slots of (Pokémon id | null) */
function isBoxSlots(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return Object.values(value).every(
    (games) =>
      isPlainObject(games) &&
      Object.values(games).every(
        (boxes) =>
          Array.isArray(boxes) &&
          boxes.every((box) => Array.isArray(box) && box.every((id) => id === null || typeof id === "number")),
      ),
  );
}

function isSaveSummaries(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const { profiles, summaries } = value;
  if (!Array.isArray(profiles) || !profiles.every(isSaveProfile)) return false;
  if (summaries === undefined) return true;
  return (
    isPlainObject(summaries) &&
    Object.values(summaries).every(
      (s) =>
        isPlainObject(s) &&
        Array.isArray(s.boxNames) &&
        s.boxNames.every((n) => typeof n === "string") &&
        Array.isArray(s.mons) &&
        s.mons.every(isSummaryTuple),
    )
  );
}

const optional = (value: unknown, type: "number" | "string" | "boolean") =>
  value === undefined || typeof value === type;

/** A save profile's metadata (lib/save/types.ts SaveProfile); fields older versions may lack are optional. */
function isSaveProfile(p: unknown): boolean {
  if (!isPlainObject(p)) return false;
  const trainer = p.trainer;
  return (
    typeof p.id === "string" &&
    optional(p.label, "string") &&
    (p.role === undefined || p.role === "living-dex" || p.role === "playthrough") &&
    optional(p.startBox, "number") &&
    optional(p.fileName, "string") &&
    optional(p.importedAt, "number") &&
    optional(p.saveCount, "number") &&
    optional(p.family, "string") &&
    optional(p.ownOnly, "boolean") &&
    optional(p.game, "string") &&
    isPlainObject(trainer) &&
    typeof trainer.name === "string" &&
    optional(trainer.tid, "number") &&
    optional(trainer.sid, "number")
  );
}

/** [box, slot, species, form, shiny, level, isEgg, own?]: seven or eight numbers */
function isSummaryTuple(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    (value.length === 7 || value.length === 8) &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}

/** An old IV checker session (store/useIvStore.ts); nothing writes them any more, but they still sync. */
function isIvSession(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    typeof value.id === "string" &&
    optional(value.name, "string") &&
    optional(value.pokemonId, "number") &&
    optional(value.savedAt, "number") &&
    (value.entries === undefined || Array.isArray(value.entries))
  );
}

/** Returns true if value looks like Record<number, number[]> */
function isGenRecord(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return Object.values(value as object).every(
    (v) => Array.isArray(v) && (v as unknown[]).every((n) => typeof n === "number"),
  );
}
