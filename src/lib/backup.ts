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
 *     "updatedAt":    { "caught" | "pending" | "shiny": { "<gen>": { "<id>": epochMs } } }
 *   },
 *   "ivChecker": { "savedSessions": [...] },
 *   "boxSlots":  { "<gen>": { "<game>": [[id | null, …30], …] } },
 *   "designer":  [ …90 slots ],
 *   "sectionUpdatedAt": { "ivChecker": epochMs, "boxSlots": epochMs, "designer": epochMs }
 * }
 *
 * Version 1 files (no shinyByGen, updatedAt or sectionUpdatedAt) still restore:
 * missing shiny marks mean "none" and missing timestamps count as 0.
 */

import { useDexStore } from "../store/useDexStore";
import type { DexTimestamps } from "../store/useDexStore";
import { useIvStore } from "../store/useIvStore";
import { useBoxSlotStore } from "../store/useBoxSlotStore";
import { useDesignerStore } from "../store/useDesignerStore";
import type { DesignerSlot } from "../store/useDesignerStore";
import type { Pokemon } from "../types";
import { buildPayload } from "./sync";

export const BACKUP_VERSION = 2;

export type SectionName = "ivChecker" | "boxSlots" | "designer";

export interface TrackerData {
  caughtByGen: Record<number, number[]>;
  pendingByGen: Record<number, number[]>;
  shinyByGen?: Record<number, number[]>;
  updatedAt?: DexTimestamps;
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
  URL.revokeObjectURL(url);
}

export function downloadBackup(): void {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  triggerDownload(JSON.stringify(buildPayload(), null, 2), `pokedex-backup-${date}.json`, "application/json");
}

export function exportFullCSV(allPokemon: Pokemon[]): void {
  const { caughtByGen, pendingByGen, shinyByGen } = useDexStore.getState();
  const { slotsByGen } = useBoxSlotStore.getState();

  const pokemonMap = new Map(allPokemon.map((p) => [p.id, p]));

  const gens = new Set([
    ...Object.keys(caughtByGen).map(Number),
    ...Object.keys(pendingByGen).map(Number),
    ...Object.keys(shinyByGen).map(Number),
  ]);

  const rows: string[] = [
    "dexNumber,name,gen,caught,pending,shiny,boxGame,boxNumber,boxSlot",
  ];

  for (const gen of gens) {
    const caught = new Set(caughtByGen[gen] ?? []);
    const pending = new Set(pendingByGen[gen] ?? []);
    const shiny = new Set(shinyByGen[gen] ?? []);
    const allIds = new Set([...caught, ...pending, ...shiny]);

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
          `"${name}"`,
          gen,
          caught.has(id) ? 1 : 0,
          pending.has(id) ? 1 : 0,
          shiny.has(id) ? 1 : 0,
          slotInfo ? `"${slotInfo.game}"` : "",
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

  // v1 files have no shinyByGen — importTracker treats that as "no shinies"
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

  const iv = obj.ivChecker as Record<string, unknown> | null | undefined;
  if (!iv || !Array.isArray(iv.savedSessions)) {
    return { ok: false, error: "Invalid backup: ivChecker.savedSessions is missing." };
  }

  return { ok: true, data: obj as unknown as BackupData };
}

/** Returns true if value looks like Record<number, number[]> */
function isGenRecord(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value as object).every(
    (v) => Array.isArray(v) && (v as unknown[]).every((n) => typeof n === "number")
  );
}
