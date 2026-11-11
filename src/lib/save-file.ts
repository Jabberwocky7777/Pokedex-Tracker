import { Capacitor } from "@capacitor/core";

/** "cancelled" when the share sheet was closed without picking anything */
export type SaveResult = "saved" | "cancelled";

/** True in the iOS app, where saving goes through the share sheet rather than a download */
export const SAVES_BY_SHARING = Capacitor.isNativePlatform();

function base64Of(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((typeof reader.result === "string" ? reader.result : "").replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the file"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Saves files on this device. In a browser each one is a download. The iOS
 * app's web view ignores `<a download>`, so there the files are written to the
 * app's cache and handed to the share sheet (Save to Files, Save Image, AirDrop, …).
 * The plugins are imported only there, so they stay off the browser's load.
 */
export async function saveFiles(files: File[]): Promise<SaveResult> {
  if (SAVES_BY_SHARING) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const uris: string[] = [];
    for (const file of files) {
      const written = await Filesystem.writeFile({
        path: file.name,
        data: await base64Of(file),
        directory: Directory.Cache,
      });
      uris.push(written.uri);
    }
    try {
      await Share.share({ files: uris });
    } catch (err) {
      // The plugin rejects with "Share canceled" when the sheet is closed
      if (/cancel/i.test(err instanceof Error ? err.message : String(err))) return "cancelled";
      throw err;
    }
    return "saved";
  }
  files.forEach((file, i) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    // The first one starts straight from the tap; several at once are spaced out,
    // or browsers drop all but the first. The URL is kept a moment so the download can start
    const start = () => {
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    if (i === 0) start();
    else setTimeout(start, i * 300);
  });
  return "saved";
}

/** One text file (a backup, a CSV, the notes) — see `saveFiles` */
export function saveTextFile(content: string, filename: string, mimeType: string): Promise<SaveResult> {
  return saveFiles([new File([content], filename, { type: mimeType })]);
}
