/**
 * The Android app's SaveFolders plugin (android/app/src/main/java/com/local/
 * pokedextracker/SaveFoldersPlugin.java): read-only, persisted folder grants
 * through Android's Storage Access Framework. Only ever imported dynamically,
 * from lib/save/folders.ts in the Android app, so the browser and iOS bundles
 * never load it.
 */
import { registerPlugin } from "@capacitor/core";

export interface LinkedFolder {
  treeUri: string;
  name: string;
}

export interface SaveCandidate {
  /** Document URI built under the tree, so the folder grant covers it */
  uri: string;
  /** "Pokemon Platinum.sav" */
  name: string;
  /** Path inside the linked folder, for display */
  path: string;
  size: number;
  /** ms since epoch */
  lastModified: number;
}

/** Stable codes the native side rejects with (`error.code`) */
export type SaveFoldersError = "cancelled" | "gone" | "too_big" | "failed";

export interface SaveFoldersPlugin {
  /** System folder picker; keeps READ access. Rejects with code "cancelled". */
  pickFolder(): Promise<LinkedFolder>;
  /** Folders whose grant is still held (from the OS, not from app storage). */
  listFolders(): Promise<{ folders: LinkedFolder[] }>;
  releaseFolder(options: { treeUri: string }): Promise<void>;
  /** Files that could be saves, by size and name. Never reads contents. */
  scan(options: { treeUri: string; maxDepth?: number }): Promise<{ files: SaveCandidate[]; truncated: boolean }>;
  stat(options: { uri: string }): Promise<{ size: number; lastModified: number }>;
  /** Bytes as base64. Rejects with "too_big" over 2 MB, "gone" if missing or the grant was lost. */
  read(options: { uri: string }): Promise<{ data: string; size: number; lastModified: number }>;
}

export const SaveFolders = registerPlugin<SaveFoldersPlugin>("SaveFolders");

/** The error code of a plugin rejection, or "failed". */
export function errorCode(err: unknown): SaveFoldersError {
  const code = (err as { code?: unknown } | null)?.code;
  return code === "cancelled" || code === "gone" || code === "too_big" ? code : "failed";
}

export function base64ToBytes(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
