/**
 * Re-importing a save in one click. What is kept, in IndexedDB (lib/save/storage.ts)
 * under the save's profile id, is one of:
 *
 * - a File System Access handle (desktop Chrome and Edge): from the file picker, or
 *   from a linked folder's scan (lib/save/folders.ts);
 * - a SafLink (the Android app): the document URI of a file in a linked folder,
 *   readable for as long as the OS keeps the folder's read grant.
 *
 * "Update from file" reads it again without the file picker. Only ever read —
 * never written. Other browsers and the iOS app keep the picker.
 */
import { IS_ANDROID, IS_NATIVE } from "../platform";
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

/** A file in a linked folder in the Android app (Storage Access Framework) */
export interface SafLink {
  kind: "saf";
  uri: string;
  treeUri: string;
  name: string;
}

type StoredLink = ReadHandle | SafLink;

export function isSafLink(value: unknown): value is SafLink {
  const v = value as Partial<SafLink> | null;
  return (
    !!v && v.kind === "saf" && typeof v.uri === "string" && typeof v.treeUri === "string" && typeof v.name === "string"
  );
}

/** Reads a SafLink through the Android plugin; null when the file or the grant is gone. */
export async function readSafLink(link: SafLink): Promise<File | null> {
  if (!IS_ANDROID) return null;
  const { SaveFolders, base64ToBytes } = await import("./android-folders");
  try {
    const { data, lastModified } = await SaveFolders.read({ uri: link.uri });
    const bytes = base64ToBytes(data);
    return new File([bytes.buffer as ArrayBuffer], link.name, { lastModified });
  } catch {
    return null;
  }
}

/** True where a picked file can be remembered and read again later. */
export function canLinkFiles(): boolean {
  return typeof picker() === "function" && !IS_NATIVE;
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

async function linkOf(profileId: string): Promise<StoredLink | null> {
  const stored = await storageGet<StoredLink>(key(profileId)).catch(() => undefined);
  if (isSafLink(stored)) return IS_ANDROID ? stored : null;
  return stored && typeof stored.getFile === "function" ? stored : null;
}

/** The linked file's name, if this save has one. */
export async function linkedFileName(profileId: string): Promise<string | null> {
  return (await linkOf(profileId))?.name ?? null;
}

/**
 * The linked file now. Call from a click: the browser may ask the user to allow
 * reading it again. Null when there is no link or reading wasn't allowed.
 */
export async function readLinkedFile(profileId: string): Promise<File | null> {
  const handle = await linkOf(profileId);
  if (!handle) return null;
  if (isSafLink(handle)) return readSafLink(handle);
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
  const handle = await linkOf(profileId);
  if (!handle) return null;
  if (isSafLink(handle)) {
    const { SaveFolders } = await import("./android-folders");
    return SaveFolders.stat({ uri: handle.uri })
      .then((s) => s.lastModified)
      .catch(() => null);
  }
  try {
    if ((await handle.queryPermission?.({ mode: "read" })) !== "granted") return null;
    return (await handle.getFile()).lastModified;
  } catch {
    return null;
  }
}
