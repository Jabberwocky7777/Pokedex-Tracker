/**
 * When this device last saved a backup, and (desktop Chrome and Edge) a folder
 * to save one to every week by itself. Offline users have no server snapshots,
 * so a backup file is their only copy elsewhere. Per device, never synced.
 */
import { Capacitor } from "@capacitor/core";
import { buildPayload } from "./sync";
import { safeSetItem } from "./safe-storage";
import { storageDelete, storageGet, storageSet } from "./save/storage";

const LAST_KEY = "pokedex_last_backup";
const FOLDER_KEY = "backup-folder";
export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function lastBackupAt(): number | null {
  try {
    const value = Number(localStorage.getItem(LAST_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function noteBackupMade(at = Date.now()): void {
  safeSetItem(LAST_KEY, String(at));
}

/** "today", "yesterday", "43 days ago" */
export function backupAgeText(at: number, now = Date.now()): string {
  const days = Math.floor((now - at) / (24 * 60 * 60 * 1000));
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

// ── A folder for weekly backups (File System Access API) ─────────────────────

interface WritableFile {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
interface DirectoryHandle {
  kind: "directory";
  name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{ createWritable(): Promise<WritableFile> }>;
  queryPermission?(options: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission?(options: { mode: "readwrite" }): Promise<PermissionState>;
}
type DirectoryPicker = (options?: { mode?: "readwrite"; id?: string }) => Promise<DirectoryHandle>;

const directoryPicker = (): DirectoryPicker | undefined =>
  typeof window !== "undefined"
    ? (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker
    : undefined;

export function canBackUpToFolder(): boolean {
  return typeof directoryPicker() === "function" && !Capacitor.isNativePlatform();
}

export async function backupFolderName(): Promise<string | null> {
  const folder = await storageGet<DirectoryHandle>(FOLDER_KEY).catch(() => undefined);
  return folder?.name ?? null;
}

/** Asks for a folder (from a click) and saves the first backup into it. */
export async function chooseBackupFolder(): Promise<string | null> {
  const pick = directoryPicker();
  if (!pick) return null;
  try {
    const folder = await pick({ mode: "readwrite", id: "pokedex-backups" });
    await storageSet(FOLDER_KEY, folder);
    await writeBackup(folder);
    return folder.name;
  } catch {
    return null; // cancelled or refused
  }
}

export async function forgetBackupFolder(): Promise<void> {
  await storageDelete(FOLDER_KEY).catch(() => {});
}

async function writeBackup(folder: DirectoryHandle): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const file = await folder.getFileHandle(`pokedex-backup-${date}.json`, { create: true });
  const out = await file.createWritable();
  await out.write(JSON.stringify(buildPayload(), null, 2));
  await out.close();
  noteBackupMade();
}

/**
 * Saves a backup into the chosen folder if the last one is a week old or more
 * and writing there is still allowed without asking. Called once at start-up;
 * true when it wrote one.
 */
export async function weeklyFolderBackup(now = Date.now()): Promise<boolean> {
  const last = lastBackupAt();
  if (last !== null && now - last < WEEK_MS) return false;
  const folder = await storageGet<DirectoryHandle>(FOLDER_KEY).catch(() => undefined);
  if (!folder || typeof folder.getFileHandle !== "function") return false;
  try {
    if ((await folder.queryPermission?.({ mode: "readwrite" })) !== "granted") return false;
    await writeBackup(folder);
    return true;
  } catch {
    return false;
  }
}
