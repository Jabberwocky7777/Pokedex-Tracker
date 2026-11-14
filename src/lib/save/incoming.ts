/**
 * A save handed to the Android app by another app ("Open with" / "Share", read by
 * the native SaveFolders plugin): kept here until the Saves view, which may not be
 * loaded yet, takes it and imports it as if it had been picked.
 */
export type ReceivedSave = { file: File } | { name: string; error: "too_big" | "failed" };

const RECEIVED = "pdx-save-received";
let pending: ReceivedSave | null = null;

export function receiveSave(save: ReceivedSave): void {
  pending = save;
  window.dispatchEvent(new Event(RECEIVED));
}

/** The waiting save, once: null when there is none. */
export function takeReceivedSave(): ReceivedSave | null {
  const save = pending;
  pending = null;
  return save;
}

export function onSaveReceived(listener: () => void): () => void {
  window.addEventListener(RECEIVED, listener);
  return () => window.removeEventListener(RECEIVED, listener);
}
