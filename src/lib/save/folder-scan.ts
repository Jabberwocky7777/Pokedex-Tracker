/**
 * The rules for linked save folders, kept free of any file API so they are the
 * same on desktop Chrome/Edge (File System Access) and in the Android app
 * (Storage Access Framework, android/…/SaveFoldersPlugin.java mirrors them):
 * which files are worth reading, which copy of a save wins, and the one retry
 * for a file caught while an emulator is writing it.
 */

/** Folders that never hold battery saves (RetroArch's and emulators' own) */
export const SKIP_FOLDERS = new Set([
  "states",
  "cheats",
  "config",
  "cores",
  "shaders",
  "screenshots",
  "thumbnails",
  "system",
  "playlists",
]);
export const SCAN_MAX_DEPTH = 4;
export const SCAN_MAX_CANDIDATES = 500;
export const SCAN_MAX_ENTRIES = 5000;
export const MIN_SAVE_BYTES = 128 * 1024;
export const MAX_SAVE_BYTES = 2 * 1024 * 1024;
const SAVE_EXTENSIONS = new Set(["sav", "srm", "dsv", "dat", "bin"]);

/** A folder to look into, by name (hidden folders and emulator data folders are skipped). */
export function scanFolder(name: string): boolean {
  return !name.startsWith(".") && !SKIP_FOLDERS.has(name.toLowerCase());
}

/** A file that could be a save, by name and size only — the contents decide what it really is. */
export function isSaveCandidate(name: string, size: number): boolean {
  if (name.startsWith(".") || size < MIN_SAVE_BYTES || size > MAX_SAVE_BYTES) return false;
  const dot = name.lastIndexOf(".");
  // No extension at all is allowed (some flash-cart and emulator saves)
  return dot <= 0 || SAVE_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
}

export interface ReadCandidate {
  /** Unique within the scan: the path or the document URI */
  key: string;
  /** The save's profile id (family-tid-sid), once read */
  profileId: string;
  saveCount: number;
  lastModified: number;
}

/**
 * Several files can hold the same game and trainer (an emulator's backups, a copy in
 * two folders, a converted file). Per profile the highest save counter wins, then the
 * newest file; the rest are "older copies". Returns the winning key per profile.
 */
export function chooseCopies(candidates: ReadCandidate[]): Map<string, string> {
  const best = new Map<string, ReadCandidate>();
  for (const c of candidates) {
    const current = best.get(c.profileId);
    if (
      !current ||
      c.saveCount > current.saveCount ||
      (c.saveCount === current.saveCount && c.lastModified > current.lastModified)
    )
      best.set(c.profileId, c);
  }
  return new Map([...best].map(([profileId, c]) => [profileId, c.key]));
}

/** A file changed this recently may be half-written by the emulator */
export const MID_WRITE_MS = 5000;
export const MID_WRITE_RETRY_MS = 1000;

/**
 * Reads and parses a save, retrying once after a second when a file modified in the
 * last five seconds fails (a checksum error is what a half-written save looks like).
 */
export async function readWithRetry<T>(
  read: () => Promise<{ bytes: Uint8Array; lastModified: number }>,
  parse: (bytes: Uint8Array) => T,
  options: { now?: () => number; wait?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const now = options.now ?? Date.now;
  const wait = options.wait ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const first = await read();
  try {
    return parse(first.bytes);
  } catch (err) {
    if (now() - first.lastModified > MID_WRITE_MS) throw err;
    await wait(MID_WRITE_RETRY_MS);
    return parse((await read()).bytes);
  }
}
