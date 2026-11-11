/**
 * Re-importing a save in one click: on desktop Chrome and Edge, the File System
 * Access API hands out a handle to the .sav an emulator keeps writing to. The
 * handle is kept in IndexedDB (lib/save/storage.ts) under the save's profile
 * id, so "Update from file" can read it again without the file picker. Only
 * ever read — never written. Other browsers and the iOS app keep the picker.
 */
import { Capacitor } from "@capacitor/core";
import { storageDelete, storageGet, storageSet } from "./storage";

/** The parts of the File System Access API this uses (not in TypeScript's DOM types yet) */
interface ReadHandle {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  queryPermission?(options: { mode: "read" }): Promise<PermissionState>;
  requestPermission?(options: { mode: "read" }): Promise<PermissionState>;
}
type OpenFilePicker = (options?: { multiple?: boolean; excludeAcceptAllOption?: boolean }) => Promise<ReadHandle[]>;

const picker = (): OpenFilePicker | undefined =>
  typeof window !== "undefined"
    ? (window as unknown as { showOpenFilePicker?: OpenFilePicker }).showOpenFilePicker
    : undefined;

const key = (profileId: string) => `filelink:${profileId}`;

/** True where a picked file can be remembered and read again later. */
export function canLinkFiles(): boolean {
  return typeof picker() === "function" && !Capacitor.isNativePlatform();
}

/** Opens the picker; null when it was cancelled. */
export async function pickSaveFile(): Promise<{ file: File; handle: ReadHandle } | null> {
  const open = picker();
  if (!open) return null;
  try {
    const [handle] = await open({ multiple: false });
    return handle ? { file: await handle.getFile(), handle } : null;
  } catch {
    return null; // cancelled, or the browser refused
  }
}

export async function rememberSaveFile(profileId: string, handle: unknown): Promise<void> {
  try {
    await storageSet(key(profileId), handle);
  } catch {
    // Not storable here (the in-memory fallback, private mode): just no shortcut next time
  }
}

export async function forgetSaveFile(profileId: string): Promise<void> {
  await storageDelete(key(profileId)).catch(() => {});
}

async function handleOf(profileId: string): Promise<ReadHandle | null> {
  const handle = await storageGet<ReadHandle>(key(profileId)).catch(() => undefined);
  return handle && typeof handle.getFile === "function" ? handle : null;
}

/** The linked file's name, if this save has one. */
export async function linkedFileName(profileId: string): Promise<string | null> {
  return (await handleOf(profileId))?.name ?? null;
}

/**
 * The linked file now. Call from a click: the browser may ask the user to allow
 * reading it again. Null when there is no link or reading wasn't allowed.
 */
export async function readLinkedFile(profileId: string): Promise<File | null> {
  const handle = await handleOf(profileId);
  if (!handle) return null;
  try {
    const state = (await handle.queryPermission?.({ mode: "read" })) ?? "granted";
    if (state !== "granted" && (await handle.requestPermission?.({ mode: "read" })) !== "granted") return null;
    return await handle.getFile();
  } catch {
    return null; // moved, deleted, or permission refused
  }
}

/**
 * When the linked file was last changed, without asking for anything: null
 * unless reading it is already allowed (so the Saves view can say "changed
 * since the last import" without a prompt).
 */
export async function linkedFileChangedAt(profileId: string): Promise<number | null> {
  const handle = await handleOf(profileId);
  if (!handle) return null;
  try {
    if ((await handle.queryPermission?.({ mode: "read" })) !== "granted") return null;
    return (await handle.getFile()).lastModified;
  } catch {
    return null;
  }
}
