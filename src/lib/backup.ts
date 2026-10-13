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
import { useDesignerStore } from "../store/useDesignerStore";
import type { DesignerSlot } from "../store/useDesignerStore";
import type { Pokemon } from "../types";
import { useSaveStore } from "../store/useSaveStore";
import type { SaveProfile, SaveSummary } from "./save/types";
import { buildPayload } from "./sync";
import { isEntries, restoreEntries, type Entries } from "./entries";
import { useRoamerStore, type RoamerStatus } from "../store/useRoamerStore";

/** The sections that merge entry by entry, each with the store that holds it. */
export const ENTRY_SECTIONS = {
  roamers: useRoamerStore,
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
  /** When each last-write-wins section was last changed on some device (epoch ms). */
  sectionUpdatedAt?: Partial<Record<SectionName, number>>;
}

// ─── Export ────────────────────────────────────────────────────────────────────

function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Give the browser a moment to start the download before the URL goes away
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvText = (value: string) => `"${value.replace(/"/g, '""')}"`;

export function downloadBackup(): void {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  triggerDownload(JSON.stringify(buildPayload(), null, 2), `pokedex-backup-${date}.json`, "application/json");
}

export function exportFullCSV(allPokemon: Pokemon[]): void {
  const { caughtByGen, pendingByGen, shinyByGen, placedByGen } = useDexStore.getState();
  const { slotsByGen } = useBoxSlotStore.getState();

  const pokemonMap = new Map(allPokemon.map((p) => [p.id, p]));

  const gens = new Set([
    ...Object.keys(caughtByGen).map(Number),
    ...Object.keys(pendingByGen).map(Number),
    ...Object.keys(shinyByGen).map(Number),
    ...Object.keys(placedByGen).map(Number),
  ]);

  const rows: string[] = [
    "dexNumber,name,gen,caught,pending,shiny,placed,boxGame,boxNumber,boxSlot",
  ];

  for (const gen of gens) {
    const caught = new Set(caughtByGen[gen] ?? []);
    const pending = new Set(pendingByGen[gen] ?? []);
    const shiny = new Set(shinyByGen[gen] ?? []);
    const placed = new Set(placedByGen[gen] ?? []);
    const allIds = new Set([...caught, ...pending, ...shiny, ...placed]);

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
        ].join(",")
      );
    }
  }

  const date = new Date().toISOString().slice(0, 10);
  triggerDownload(rows.join("\n"), `pokedex-export-${date}.csv`, "text/csv");
}

// ─── Import / Restore ─────────────────────────────────────────────────────────

export type RestoreResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Replaces local data with a parsed backup. Restoring is a deliberate "make it
 * look like this" action, so every mark that changes is stamped now and the
 * restored sections count as freshly edited — the restore then wins in sync
 * rather than being merged away.
 */
export function restoreBackupData(raw: unknown): RestoreResult {
  const validated = validateBackup(raw);
  if (!validated.ok) return validated;
  const data = validated.data;

  // v1 files have no shinyByGen (and older v2 files no placedByGen) — importTracker treats that as "none"
  useDexStore.getState().importTracker(data.tracker);

  useIvStore.setState({ savedSessions: data.ivChecker.savedSessions });

  if (data.boxSlots) {
    useBoxSlotStore.getState().setSlotsByGen(data.boxSlots);
  }

  if (Array.isArray(data.designer)) {
    useDesignerStore.getState().setSlots(
      data.designer as ReturnType<typeof useDesignerStore.getState>["slots"]
    );
  }

  if (data.saveSummaries && Array.isArray(data.saveSummaries.profiles)) {
    // A save removed since the backup was made has a tombstone that outlives its
    // importedAt, and the next sync would remove it again. Restoring it counts
    // as importing it now.
    const removed = useSaveStore.getState().removedProfiles;
    const now = Date.now();
    const profiles = data.saveSummaries.profiles.map((p) => {
      const removedAt = removed[p.id] ?? 0;
      // Strictly after the tombstone, even when both fall in the same millisecond
      return removedAt >= p.importedAt ? { ...p, importedAt: Math.max(now, removedAt + 1) } : p;
    });
    useSaveStore.getState().replaceAll(profiles, data.saveSummaries.summaries ?? {});
  }

  // Entry-merged sections: what the backup has is written as of now, the rest removed as of now
  const now = Date.now();
  for (const name of Object.keys(ENTRY_SECTIONS) as EntrySectionName[]) {
    const store = ENTRY_SECTIONS[name];
    store.getState().replaceAll(restoreEntries(store.getState().entries, data[name], now) as never);
  }

  return { ok: true };
}

export function restoreBackup(file: File): Promise<RestoreResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(restoreBackupData(JSON.parse(e.target?.result as string)));
      } catch {
        resolve({ ok: false, error: "Could not parse backup file — is it valid JSON?" });
      }
    };
    reader.onerror = () => resolve({ ok: false, error: "Could not read the file." });
    reader.readAsText(file);
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateBackup(
  raw: unknown
): { ok: true; data: BackupData } | { ok: false; error: string } {
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
      error: `Unsupported backup version: ${obj.version}. Expected version 1 or 2.`,
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

  // The optional sections are stored as they are, so a wrong shape would be
  // saved to the device and break the screens that read it.
  if (obj.boxSlots !== undefined && !isBoxSlots(obj.boxSlots)) {
    return { ok: false, error: "Invalid backup: boxSlots is malformed." };
  }
  if (obj.designer !== undefined && !(Array.isArray(obj.designer) && obj.designer.every(isPlainObject))) {
    return { ok: false, error: "Invalid backup: designer is malformed." };
  }
  if (obj.saveSummaries !== undefined && !isSaveSummaries(obj.saveSummaries)) {
    return { ok: false, error: "Invalid backup: saveSummaries is malformed." };
  }

  for (const name of Object.keys(ENTRY_SECTIONS)) {
    if (obj[name] !== undefined && !isEntries(obj[name])) return { ok: false, error: `Invalid backup: ${name} is malformed.` };
  }

  return { ok: true, data: obj as unknown as BackupData };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** gen → game → boxes → slots of (Pokémon id | null) */
function isBoxSlots(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return Object.values(value).every((games) =>
    isPlainObject(games) && Object.values(games).every((boxes) =>
      Array.isArray(boxes) && boxes.every((box) =>
        Array.isArray(box) && box.every((id) => id === null || typeof id === "number"))));
}

function isSaveSummaries(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const { profiles, summaries } = value;
  if (!Array.isArray(profiles) || !profiles.every((p) => isPlainObject(p) && typeof p.id === "string" && isPlainObject(p.trainer))) return false;
  if (summaries === undefined) return true;
  return isPlainObject(summaries) && Object.values(summaries).every((s) =>
    isPlainObject(s) && Array.isArray(s.boxNames) && Array.isArray(s.mons) && s.mons.every(Array.isArray));
}

/** Returns true if value looks like Record<number, number[]> */
function isGenRecord(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return Object.values(value as object).every(
    (v) => Array.isArray(v) && (v as unknown[]).every((n) => typeof n === "number")
  );
}
