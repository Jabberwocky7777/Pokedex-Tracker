/**
 * Linked save folders: an emulator's saves folder, linked once, then scanned for
 * saves and re-read in one tap. Two backends behind one interface:
 *
 * - desktop Chrome and Edge: File System Access directory handles, kept in
 *   IndexedDB (lib/save/storage.ts) — the browser may ask again for permission
 *   after a restart, which needs a click (Rescan is one);
 * - the Android app: the SaveFolders plugin (lib/save/android-folders.ts),
 *   read-only folder grants the OS keeps.
 *
 * Everything is read only — nothing is ever written into a linked folder. The
 * rules of what to read are lib/save/folder-scan.ts.
 */
import { IS_ANDROID, IS_NATIVE } from "../platform";
import {
  isSaveCandidate,
  scanFolder,
  SCAN_MAX_CANDIDATES,
  SCAN_MAX_DEPTH,
  SCAN_MAX_ENTRIES,
  MAX_SAVE_BYTES,
} from "./folder-scan";
import { storageGet, storageSet } from "./storage";
import type { SafLink } from "./file-link";

export interface SaveFolder {
  /** The tree URI (Android) or a generated id (desktop) */
  id: string;
  name: string;
}

export interface FolderFile {
  /** Unique within the folder: the document URI (Android) or the path (desktop) */
  key: string;
  name: string;
  /** Path inside the folder, for display ("saves/nds/Platinum.sav") */
  path: string;
  size: number;
  lastModified: number;
  /** What a profile keeps to read this file again ("Update from file") */
  link: unknown;
}

export interface ScanResult {
  files: FolderFile[];
  truncated: boolean;
  /** Desktop: reading the folder needs the user's permission again (a click) */
  needsPermission?: boolean;
}

export class FolderError extends Error {
  readonly code: "cancelled" | "gone" | "too_big" | "failed";
  constructor(code: FolderError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

// ── Desktop (File System Access) ─────────────────────────────────────────────

interface FileHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
}
interface DirHandle {
  kind: "directory";
  name: string;
  values(): AsyncIterable<FileHandle | DirHandle>;
  queryPermission?(options: { mode: "read" }): Promise<PermissionState>;
  requestPermission?(options: { mode: "read" }): Promise<PermissionState>;
}
type DirectoryPicker = (options?: { mode?: "read"; id?: string }) => Promise<DirHandle>;

const directoryPicker = (): DirectoryPicker | undefined =>
  typeof window !== "undefined"
    ? (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker
    : undefined;

const FOLDERS_KEY = "savefolders";
type StoredFolder = { id: string; handle: DirHandle };

async function storedFolders(): Promise<StoredFolder[]> {
  const list = await storageGet<StoredFolder[]>(FOLDERS_KEY).catch(() => undefined);
  return Array.isArray(list) ? list.filter((f) => f?.handle && typeof f.handle.values === "function") : [];
}

async function desktopScan(dir: DirHandle, interactive: boolean): Promise<ScanResult> {
  const state = (await dir.queryPermission?.({ mode: "read" })) ?? "granted";
  if (state !== "granted") {
    if (!interactive || (await dir.requestPermission?.({ mode: "read" })) !== "granted")
      return { files: [], truncated: false, needsPermission: true };
  }
  const files: FolderFile[] = [];
  let visited = 0;
  let truncated = false;
  async function walk(folder: DirHandle, path: string, depth: number) {
    for await (const entry of folder.values()) {
      if (++visited > SCAN_MAX_ENTRIES || files.length >= SCAN_MAX_CANDIDATES) {
        truncated = true;
        return;
      }
      const at = path ? `${path}/${entry.name}` : entry.name;
      if (entry.kind === "directory") {
        if (depth < SCAN_MAX_DEPTH && scanFolder(entry.name)) await walk(entry, at, depth + 1);
        continue;
      }
      const file = await entry.getFile().catch(() => null);
      if (!file || !isSaveCandidate(entry.name, file.size)) continue;
      files.push({
        key: at,
        name: entry.name,
        path: at,
        size: file.size,
        lastModified: file.lastModified,
        link: entry,
      });
    }
  }
  await walk(dir, "", 1);
  return { files, truncated };
}

// ── Android (SaveFolders plugin) ─────────────────────────────────────────────

const android = () => import("./android-folders");

function folderError(err: unknown, code: FolderError["code"]): FolderError {
  return new FolderError(code, err instanceof Error ? err.message : String(err));
}

// ── The interface ────────────────────────────────────────────────────────────

/** True where folders can be linked: the Android app, and desktop Chrome / Edge. */
export function canLinkFolders(): boolean {
  return IS_ANDROID || (typeof directoryPicker() === "function" && !IS_NATIVE);
}

/** Opens the system folder picker; null when cancelled. */
export async function pickFolder(): Promise<SaveFolder | null> {
  if (IS_ANDROID) {
    const { SaveFolders, errorCode } = await android();
    try {
      const folder = await SaveFolders.pickFolder();
      return { id: folder.treeUri, name: folder.name };
    } catch (err) {
      if (errorCode(err) === "cancelled") return null;
      throw folderError(err, errorCode(err));
    }
  }
  const pick = directoryPicker();
  if (!pick) return null;
  let handle: DirHandle;
  try {
    handle = await pick({ mode: "read", id: "save-folder" });
  } catch {
    return null; // cancelled, or the browser refused (a system folder)
  }
  const list = await storedFolders();
  const id = `folder-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  await storageSet(FOLDERS_KEY, [...list, { id, handle }]);
  return { id, name: handle.name };
}

/** The linked folders. On Android, straight from the OS: a grant revoked in Settings is gone. */
export async function listFolders(): Promise<SaveFolder[]> {
  if (IS_ANDROID) {
    const { SaveFolders } = await android();
    const { folders } = await SaveFolders.listFolders().catch(() => ({ folders: [] }));
    return folders.map((f) => ({ id: f.treeUri, name: f.name }));
  }
  return (await storedFolders()).map((f) => ({ id: f.id, name: f.handle.name }));
}

export async function unlinkFolder(id: string): Promise<void> {
  if (IS_ANDROID) {
    const { SaveFolders } = await android();
    await SaveFolders.releaseFolder({ treeUri: id }).catch(() => {});
    return;
  }
  await storageSet(
    FOLDERS_KEY,
    (await storedFolders()).filter((f) => f.id !== id),
  );
}

/**
 * The files in a folder that could be saves (by name and size; nothing is read).
 * `interactive`: called from a click, so the desktop browser may ask for permission.
 */
export async function scanSaveFolder(id: string, interactive = false): Promise<ScanResult> {
  if (IS_ANDROID) {
    const { SaveFolders, errorCode } = await android();
    try {
      const { files, truncated } = await SaveFolders.scan({ treeUri: id, maxDepth: SCAN_MAX_DEPTH });
      return {
        truncated,
        files: files.map((f) => ({
          key: f.uri,
          name: f.name,
          path: f.path,
          size: f.size,
          lastModified: f.lastModified,
          link: { kind: "saf", uri: f.uri, treeUri: id, name: f.name } satisfies SafLink,
        })),
      };
    } catch (err) {
      throw folderError(err, errorCode(err));
    }
  }
  const folder = (await storedFolders()).find((f) => f.id === id);
  if (!folder) throw new FolderError("gone", "This folder is no longer linked.");
  try {
    return await desktopScan(folder.handle, interactive);
  } catch (err) {
    throw folderError(err, "gone");
  }
}

/** The file's contents now, as a File (name and lastModified included). */
export async function readFolderFile(file: FolderFile): Promise<File> {
  if (IS_ANDROID) {
    const { readSafLink } = await import("./file-link");
    const read = await readSafLink(file.link as SafLink);
    if (!read) throw new FolderError("gone", "The file couldn't be read.");
    return read;
  }
  const handle = file.link as FileHandle;
  const read = await handle.getFile();
  if (read.size > MAX_SAVE_BYTES) throw new FolderError("too_big", "That file is too big to be a save.");
  return read;
}
