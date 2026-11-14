import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderOpen, FolderPlus, RefreshCw, Unlink } from "lucide-react";
import { parseSave } from "../../lib/save/parse";
import { SaveParseError, type SaveProfile } from "../../lib/save/types";
import {
  FolderError,
  listFolders,
  pickFolder,
  readFolderFile,
  scanSaveFolder,
  unlinkFolder,
  type FolderFile,
  type SaveFolder,
} from "../../lib/save/folders";
import { chooseCopies, readWithRetry } from "../../lib/save/folder-scan";
import { profileIdOf } from "../../store/useSaveStore";
import { onAppResume } from "../../lib/app-resume";
import { IS_ANDROID } from "../../lib/platform";
import Button from "../shared/Button";

/** What a file in a linked folder turned out to be */
interface Read {
  profileId?: string;
  /** "Platinum · DAWN" */
  label?: string;
  saveCount?: number;
  error?: string;
}

type Status = "new" | "changed" | "current" | "older" | "copy" | "unreadable";

const STATUS_TEXT: Record<Status, string> = {
  new: "Not imported yet",
  changed: "Changed since the last import",
  current: "Up to date",
  older: "Older than the save you imported",
  copy: "Older copy, ignored",
  unreadable: "Not a save this app reads",
};

// Read results by file and version, kept while the app is open so a rescan only reads what changed
const readCache = new Map<string, Read>();
const cacheKey = (f: FolderFile) => `${f.key}|${f.size}|${f.lastModified}`;

async function readCandidate(file: FolderFile): Promise<Read> {
  const cached = readCache.get(cacheKey(file));
  if (cached) return cached;
  let read: Read;
  try {
    const parsed = await readWithRetry(async () => {
      const f = await readFolderFile(file);
      return { bytes: new Uint8Array(await f.arrayBuffer()), lastModified: f.lastModified };
    }, parseSave);
    read = {
      profileId: profileIdOf(parsed),
      label: `${parsed.game} · ${parsed.trainer.name}`,
      saveCount: parsed.saveCount,
    };
  } catch (err) {
    read = {
      error:
        err instanceof SaveParseError
          ? err.message
          : err instanceof FolderError && err.code === "too_big"
            ? "Too big to be a save."
            : "Couldn't be read.",
    };
  }
  readCache.set(cacheKey(file), read);
  return read;
}

interface FolderState {
  folder: SaveFolder;
  files: FolderFile[];
  reads: Map<string, Read>;
  truncated: boolean;
  needsPermission?: boolean;
  scanning: boolean;
  error?: string;
}

interface Props {
  profiles: SaveProfile[];
  /** Imports these files one after another, each through the import review */
  onImport: (files: FolderFile[]) => void;
}

/**
 * The Saves view's linked folders: an emulator's saves folder linked once, then
 * every save in it listed by the game it holds, with what is new or changed since
 * the last import. Desktop Chrome / Edge and the Android app (lib/save/folders.ts).
 * Folders are only ever read.
 */
export default function LinkedFolders({ profiles, onImport }: Props) {
  const [states, setStates] = useState<FolderState[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const scan = useCallback(async (folder: SaveFolder, interactive: boolean): Promise<FolderState> => {
    try {
      const { files, truncated, needsPermission } = await scanSaveFolder(folder.id, interactive);
      const reads = new Map<string, Read>();
      for (const file of files) reads.set(file.key, await readCandidate(file));
      return { folder, files, reads, truncated, needsPermission, scanning: false };
    } catch (err) {
      return {
        folder,
        files: [],
        reads: new Map(),
        truncated: false,
        scanning: false,
        error:
          err instanceof FolderError && err.code === "gone"
            ? "This folder can't be read any more (moved, removed, or access was taken back). Unlink it and link it again."
            : "This folder couldn't be read.",
      };
    }
  }, []);

  const refresh = useCallback(
    async (interactive = false) => {
      const folders = await listFolders();
      setStates((prev) =>
        folders.map(
          (folder) =>
            prev.find((s) => s.folder.id === folder.id) ?? {
              folder,
              files: [],
              reads: new Map(),
              truncated: false,
              scanning: true,
            },
        ),
      );
      const scanned = await Promise.all(folders.map((f) => scan(f, interactive)));
      setStates(scanned);
    },
    [scan],
  );

  // On opening, and whenever the user comes back (a save made in the emulator meanwhile)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the folders is the effect
    void refresh();
    return onAppResume(() => void refresh());
  }, [refresh]);

  async function link() {
    setMessage(null);
    try {
      const folder = await pickFolder();
      if (!folder) return;
      const state = await scan(folder, true);
      setStates((prev) => [...prev.filter((s) => s.folder.id !== folder.id), state]);
      if (!state.error && state.files.length === 0) setMessage(EMPTY_FOLDER);
    } catch {
      setMessage(REFUSED_FOLDER);
    }
  }

  async function rescan(folder: SaveFolder) {
    setStates((prev) => prev.map((s) => (s.folder.id === folder.id ? { ...s, scanning: true } : s)));
    const state = await scan(folder, true);
    setStates((prev) => prev.map((s) => (s.folder.id === folder.id ? state : s)));
  }

  async function unlink(folder: SaveFolder) {
    await unlinkFolder(folder.id);
    setStates((prev) => prev.filter((s) => s.folder.id !== folder.id));
  }

  // Which copy wins per save, across every linked folder, and what each file's state is
  const statusOf = useMemo(() => {
    const all = states.flatMap((s) => s.files.map((f) => ({ file: f, read: s.reads.get(f.key) })));
    const winners = chooseCopies(
      all.flatMap(({ file, read }) =>
        read?.profileId
          ? [
              {
                key: file.key,
                profileId: read.profileId,
                saveCount: read.saveCount ?? 0,
                lastModified: file.lastModified,
              },
            ]
          : [],
      ),
    );
    const byId = new Map(profiles.map((p) => [p.id, p]));
    const status = new Map<string, Status>();
    for (const { file, read } of all) {
      if (!read?.profileId) {
        status.set(file.key, "unreadable");
        continue;
      }
      if (winners.get(read.profileId) !== file.key) {
        status.set(file.key, "copy");
        continue;
      }
      const profile = byId.get(read.profileId);
      const count = read.saveCount ?? 0;
      status.set(
        file.key,
        !profile
          ? "new"
          : count < profile.saveCount
            ? "older"
            : count > profile.saveCount || file.lastModified > profile.importedAt
              ? "changed"
              : "current",
      );
    }
    return status;
  }, [states, profiles]);

  const importable = (s: FolderState) =>
    s.files.filter((f) => statusOf.get(f.key) === "new" || statusOf.get(f.key) === "changed");
  const changed = states.flatMap((s) => s.files.filter((f) => statusOf.get(f.key) === "changed"));

  return (
    <section aria-label="Linked save folders" className="flex flex-col gap-3 w-full">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-200 mr-auto">Linked save folders</h3>
        <Button size="sm" className={SM} variant="secondary" onClick={() => void link()}>
          <FolderPlus size={16} aria-hidden="true" /> Link a save folder
        </Button>
      </div>
      <p className="text-xs text-gray-500">
        Link your emulator&apos;s saves folder once; saves in it are then listed here and re-read in one tap. Folders
        are only ever read, never changed. Save in the game (not just a save state) before updating.
      </p>

      {changed.length > 0 && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/40 text-sm text-amber-100"
        >
          <span className="mr-auto">
            {changed.length === 1 ? "1 save has" : `${changed.length} saves have`} changed since the last import.
          </span>
          <Button size="sm" variant="primary" className={SM} onClick={() => onImport(changed)}>
            Update all
          </Button>
        </div>
      )}

      {message && (
        <p role="status" className="text-sm text-gray-300 px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700">
          {message}
        </p>
      )}

      {states.map((s) => {
        const groups = new Map<string, FolderFile[]>();
        for (const f of s.files) {
          const label = s.reads.get(f.key)?.label ?? "Other files";
          groups.set(label, [...(groups.get(label) ?? []), f]);
        }
        const toImport = importable(s);
        return (
          <div key={s.folder.id} className="rounded-xl border border-gray-800 bg-gray-900/60">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-800">
              <FolderOpen size={16} className="text-gray-400" aria-hidden="true" />
              <span className="text-sm font-medium text-gray-100 mr-auto break-all">{s.folder.name}</span>
              {toImport.length > 1 && (
                <Button size="sm" variant="primary" className={SM} onClick={() => onImport(toImport)}>
                  Import all ({toImport.length})
                </Button>
              )}
              <Button
                size="sm"
                className={SM}
                variant="ghost"
                onClick={() => void rescan(s.folder)}
                disabled={s.scanning}
                aria-label={`Rescan ${s.folder.name}`}
              >
                <RefreshCw size={14} className={s.scanning ? "animate-spin" : ""} aria-hidden="true" />
                {s.needsPermission ? "Allow access" : "Rescan"}
              </Button>
              <Button
                size="sm"
                className={SM}
                variant="ghost"
                onClick={() => void unlink(s.folder)}
                aria-label={`Unlink ${s.folder.name}`}
              >
                <Unlink size={14} aria-hidden="true" /> Unlink
              </Button>
            </div>
            <div className="px-3 py-2 flex flex-col gap-3">
              {s.error && <p className="text-sm text-red-300">{s.error}</p>}
              {s.needsPermission && (
                <p className="text-sm text-gray-400">The browser needs your permission to read this folder again.</p>
              )}
              {!s.error && !s.needsPermission && !s.scanning && s.files.length === 0 && (
                <p className="text-sm text-gray-400">{EMPTY_FOLDER}</p>
              )}
              {[...groups].map(([label, files]) => (
                <div key={label}>
                  <div className="text-xs font-semibold text-gray-400 mb-1">{label}</div>
                  <ul className="flex flex-col gap-1">
                    {files.map((f) => {
                      const status = statusOf.get(f.key) ?? "unreadable";
                      const read = s.reads.get(f.key);
                      return (
                        <li key={f.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                          <span className="min-w-0 flex-1">
                            <span className="text-gray-200 break-all">{f.path}</span>
                            <span className="block text-xs text-gray-500">
                              {new Date(f.lastModified).toLocaleString()} ·{" "}
                              <span
                                className={
                                  status === "changed" ? "text-amber-300" : status === "new" ? "text-indigo-300" : ""
                                }
                                title={status === "unreadable" ? read?.error : undefined}
                              >
                                {status === "unreadable" && read?.error ? read.error : STATUS_TEXT[status]}
                              </span>
                            </span>
                          </span>
                          {(status === "new" || status === "changed" || status === "older") && (
                            <Button size="sm" className={SM} variant="secondary" onClick={() => onImport([f])}>
                              {status === "changed" ? "Update" : "Import"}
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {s.truncated && (
                <p className="text-xs text-gray-500">
                  This folder has too many files to look through them all; link the folder that holds the saves.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** Small buttons with an icon, at least 44 px tall on a touch screen */
const SM = "inline-flex items-center gap-1.5 pointer-coarse:min-h-[44px]";

const EMPTY_FOLDER = IS_ANDROID
  ? 'No saves found here. Link the folder that holds your .sav, .srm or .dsv files. Saves under Android/data can\'t be read by other apps: in melonDS, turn off "Save next to ROM file" and choose a save folder in ordinary storage (Settings → Save files), or move the saves out with the Files app.'
  : "No saves found here. Link the folder that holds your .sav, .srm or .dsv files (your emulator's save folder).";

const REFUSED_FOLDER = IS_ANDROID
  ? "That folder can't be linked. Android doesn't let apps use the top of storage, the Download folder itself, or anything under Android/. Pick the folder that holds the saves — for melonDS, the save folder set in its settings."
  : "That folder couldn't be linked. Pick the folder that holds the saves.";
