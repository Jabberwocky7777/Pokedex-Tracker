import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

/** The IndexedDB database with imported saves (lib/save/storage.ts) and the restore undo point. */
const SAVES_DB = "pokedex-saves";

/**
 * Removes everything this app keeps on this device: every persisted store,
 * the sign-in, and the imported saves. For signing out on a shared computer,
 * so the next person can't open "Use offline" and see it all. The caller
 * reloads the page afterwards, so no store writes its in-memory copy back.
 * Data on the sync server is not touched.
 */
export async function removeLocalData(): Promise<void> {
  try {
    localStorage.clear();
  } catch {
    // Storage unavailable: nothing was kept there
  }
  try {
    sessionStorage.clear();
  } catch {
    // ditto
  }
  if (Capacitor.isNativePlatform()) {
    await Preferences.clear().catch(() => {});
  }
  await new Promise<void>((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve();
      const request = indexedDB.deleteDatabase(SAVES_DB);
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Leaves "Try it with sample data": removes it (and everything else here) and starts again at the login screen. */
export async function leaveSampleData(): Promise<void> {
  await removeLocalData();
  window.location.reload();
}
