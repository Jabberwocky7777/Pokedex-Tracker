/**
 * Backup & restore utilities for the Pokédex Tracker.
 *
 * Covers:
 *   - Tracker: caught and pending Pokémon (useDexStore)
 *   - IV Checker: saved PC-box sessions (useIvStore)
 *
 * Backup format (version 1):
 * {
 *   "version": 1,
 *   "exportedAt": "<ISO string>",
 *   "tracker": { "caughtByGen": {...}, "pendingByGen": {...} },
 *   "ivChecker": { "savedSessions": [...] }
 * }
 */

import { useDexStore } from "../store/useDexStore";
import { useIvStore } from "../store/useIvStore";

const BACKUP_VERSION = 1;

export interface BackupData {
  version: number;
  exportedAt: string;
  tracker: {
    caughtByGen: Record<number, number[]>;
    pendingByGen: Record<number, number[]>;
  };
  ivChecker: {
    savedSessions: ReturnType<typeof useIvStore.getState>["savedSessions"];
  };
}

// ─── Export ────────────────────────────────────────────────────────────────────

export function downloadBackup(): void {
  const { caughtByGen, pendingByGen } = useDexStore.getState();
  const { savedSessions } = useIvStore.getState();

  const data: BackupData = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tracker: { caughtByGen, pendingByGen },
    ivChecker: { savedSessions },
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const a = document.createElement("a");
  a.href = url;
  a.download = `pokedex-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Import / Restore ─────────────────────────────────────────────────────────

export type RestoreResult =
  | { ok: true }
  | { ok: false; error: string };

export function restoreBackup(file: File): Promise<RestoreResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string);
        const validated = validateBackup(raw);
        if (!validated.ok) {
          resolve(validated);
          return;
        }

        const data = validated.data;

        // Restore tracker
        useDexStore.setState({
          caughtByGen: data.tracker.caughtByGen,
          pendingByGen: data.tracker.pendingByGen,
        });

        // Restore IV checker
        useIvStore.setState({ savedSessions: data.ivChecker.savedSessions });

        resolve({ ok: true });
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

  const obj = raw as Record<string, unknown>;

  if (obj.version !== BACKUP_VERSION) {
    return {
      ok: false,
      error: `Unsupported backup version: ${obj.version}. Expected version ${BACKUP_VERSION}.`,
    };
  }

  if (!isGenRecord(obj.tracker && (obj.tracker as Record<string, unknown>).caughtByGen)) {
    return { ok: false, error: "Invalid backup: tracker.caughtByGen is malformed." };
  }
  if (!isGenRecord(obj.tracker && (obj.tracker as Record<string, unknown>).pendingByGen)) {
    return { ok: false, error: "Invalid backup: tracker.pendingByGen is malformed." };
  }

  const iv = obj.ivChecker as Record<string, unknown> | null | undefined;
  if (!iv || !Array.isArray(iv.savedSessions)) {
    return { ok: false, error: "Invalid backup: ivChecker.savedSessions is missing." };
  }

  return { ok: true, data: raw as BackupData };
}

/** Returns true if value looks like Record<number, number[]> */
function isGenRecord(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value as object).every(
    (v) => Array.isArray(v) && (v as unknown[]).every((n) => typeof n === "number")
  );
}
