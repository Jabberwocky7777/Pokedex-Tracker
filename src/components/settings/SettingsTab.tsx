import { useCallback, useEffect, useRef, useState } from "react";
import GenerationSelector from "../controls/GenerationSelector";
import ThemeSelector from "../ThemeSelector";
import {
  applyRestore,
  downloadBackup,
  downloadNotes,
  exportFullCSV,
  forgetRestoreUndo,
  notesExportText,
  readBackupFile,
  restoreUndoPoint,
  undoRestore,
  type BackupData,
  type RestoreUndoPoint,
} from "../../lib/backup";
import { isLocalMode, getServerUrl } from "../../lib/sync";
import { clearGenerationWithUndo } from "../../lib/dex-actions";
import { useDexStore } from "../../store/useDexStore";
import type { Pokemon, MetaData } from "../../types";
import { useSettingsStore } from "../../store/useSettingsStore";
import ServerSnapshots from "./ServerSnapshots";
import RestoreConfirm from "./RestoreConfirm";
import DeviceSessions from "./DeviceSessions";
import SegmentedControl from "../shared/SegmentedControl";
import Button from "../shared/Button";
import type { LegibilityLevel } from "../../lib/applyLegibility";
import { PageHeader, PageShell } from "../shared/Page";
import { copyText } from "../../lib/clipboard";
import { Capacitor } from "@capacitor/core";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
  /** `removeData`: also remove everything this app keeps in this browser */
  onLogout?: (removeData: boolean) => void;
  /** Local-mode users: open the login screen without leaving local mode. */
  onSignIn?: () => void;
}

export default function SettingsTab({ allPokemon, meta, onLogout, onSignIn }: Props) {
  const localMode = isLocalMode();
  const isNative = Capacitor.isNativePlatform();
  const legibility = useSettingsStore((s) => s.legibility);
  const setLegibility = useSettingsStore((s) => s.setLegibility);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const genName = meta.generations.find((g) => g.id === activeGeneration)?.name ?? `Generation ${activeGeneration}`;
  const markCount = useDexStore(
    (s) =>
      (s.caughtByGen[activeGeneration]?.length ?? 0) +
      (s.pendingByGen[activeGeneration]?.length ?? 0) +
      (s.shinyByGen[activeGeneration]?.length ?? 0) +
      (s.placedByGen[activeGeneration]?.length ?? 0),
  );
  // Clearing a generation is a two-step action: the button turns into a confirmation
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  const [removeDataOnSignOut, setRemoveDataOnSignOut] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  // A backup file that passed validation, waiting for the confirmation
  const [pendingRestore, setPendingRestore] = useState<{ fileName: string; data: BackupData } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [undoPoint, setUndoPoint] = useState<RestoreUndoPoint | null>(null);

  const refreshUndo = useCallback(() => {
    void restoreUndoPoint().then(setUndoPoint);
  }, []);
  useEffect(refreshUndo, [refreshUndo]);

  // One toast at a time: a new one replaces the last and gets the full 4 s
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string, ok: boolean) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, ok });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  /** Runs an export; only a failure is worth a toast (a closed share sheet is not one) */
  async function runExport(save: () => Promise<unknown>) {
    try {
      await save();
    } catch (err) {
      showToast(`Export failed: ${err instanceof Error ? err.message : String(err)}`, false);
    }
  }

  // Picking a file only checks it; nothing changes until the confirmation
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const prepared = await readBackupFile(file);
    if (!prepared.ok) {
      showToast(`Import failed: ${prepared.error}`, false);
      return;
    }
    setPendingRestore({ fileName: file.name, data: prepared.data });
  }

  async function confirmRestore() {
    if (!pendingRestore) return;
    setRestoring(true);
    try {
      const { undoKept } = await applyRestore(pendingRestore.data, backupLabel(pendingRestore));
      showToast(
        undoKept ? "Backup restored." : "Backup restored, but this device couldn't keep a copy to undo it.",
        true,
      );
      setPendingRestore(null);
      refreshUndo();
    } finally {
      setRestoring(false);
    }
  }

  async function handleUndoRestore() {
    const result = await undoRestore();
    showToast(result.ok ? "Restore undone." : `Couldn't undo: ${result.error}`, result.ok);
    refreshUndo();
  }

  return (
    <div className="h-full flex flex-col bg-gray-950 overflow-hidden">
      <PageShell width="reading" className="!gap-8">
        <PageHeader title="Settings" subtitle="Generation, appearance, your data, and sync." />

        {/* Generation */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-100">Generation</h2>
            <p className="text-sm text-gray-400 mt-0.5">Controls which Pokédex you&apos;re tracking</p>
          </div>
          <GenerationSelector meta={meta} />
        </section>

        <div className="h-px bg-gray-800" />

        {/* Appearance */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-100">Appearance</h2>
            <p className="text-sm text-gray-400 mt-0.5">App color theme</p>
          </div>
          <ThemeSelector />
        </section>

        <div className="h-px bg-gray-800" />

        {/* Accessibility */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-100">Accessibility</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              High legibility — Larger text, higher contrast, and readable badges. Works with any theme.
            </p>
          </div>
          <SegmentedControl<LegibilityLevel>
            ariaLabel="High legibility level"
            value={legibility}
            onChange={setLegibility}
            className="self-start"
            options={[
              { value: "off", label: "Off" },
              { value: "comfortable", label: "Comfortable" },
              { value: "large", label: "Large" },
            ]}
          />
        </section>

        <div className="h-px bg-gray-800" />

        {/* Data */}
        <section className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-100">Data</h2>
            <p className="text-sm text-gray-400 mt-0.5">Export or restore your tracker data</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => runExport(downloadBackup)}>Export backup (JSON)</Button>
            <Button onClick={() => runExport(() => exportFullCSV(allPokemon))}>Export CSV</Button>
            <Button
              onClick={() => runExport(() => downloadNotes(allPokemon))}
              title="The Working on list, every Pokémon note and the journal, as one Markdown file"
            >
              Export notes
            </Button>
            <Button
              onClick={async () => {
                const copied = await copyText(notesExportText(allPokemon));
                showToast(copied ? "Notes copied as Markdown" : "Couldn't copy the notes", copied);
              }}
              title="Copy the same Markdown to the clipboard"
            >
              Copy notes
            </Button>
            <Button onClick={() => importInputRef.current?.click()} disabled={restoring}>
              Import backup…
            </Button>
          </div>
          <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          {pendingRestore && (
            <RestoreConfirm
              source={backupLabel(pendingRestore)}
              data={pendingRestore.data}
              busy={restoring}
              onConfirm={confirmRestore}
              onCancel={() => setPendingRestore(null)}
            />
          )}
          {undoPoint && !pendingRestore && (
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-300">
              <span>
                Restored {undoPoint.label} on {formatDate(undoPoint.at)}.
              </span>
              <Button size="sm" onClick={handleUndoRestore}>
                Undo restore
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void forgetRestoreUndo().then(refreshUndo);
                }}
              >
                Keep it
              </Button>
            </div>
          )}
          {isNative && (
            <p className="text-xs text-gray-400">
              In the iOS app the export buttons open the share sheet — choose Save to Files to keep the file.
            </p>
          )}

          {/* Clear all marks for the active generation — confirm first, undo after */}
          <div className="mt-2 flex flex-col gap-2">
            {!confirmingClear ? (
              <button
                onClick={() => setConfirmingClear(true)}
                disabled={markCount === 0}
                className="self-start px-4 py-2 rounded-lg bg-red-900/40 hover:bg-red-900/60 border border-red-800/60 text-sm text-red-300 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Clear {genName} marks…
              </button>
            ) : (
              <div
                className="flex flex-col gap-2 px-3 py-3 rounded-lg bg-red-900/20 border border-red-800/50"
                role="alertdialog"
                aria-label="Confirm clearing marks"
              >
                <p className="text-sm text-gray-200">
                  Remove all caught, pending, shiny and placed marks for {genName}? Other generations are not affected.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      clearGenerationWithUndo(activeGeneration, genName);
                      setConfirmingClear(false);
                    }}
                    className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-sm text-white font-medium transition-colors"
                  >
                    Clear marks
                  </button>
                  <button
                    onClick={() => setConfirmingClear(false)}
                    className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Account */}
        {onLogout && (
          <>
            <div className="h-px bg-gray-800" />
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-100">Sync</h2>
                <p className="text-sm text-gray-400 mt-0.5">
                  {localMode
                    ? "Using offline — sign in to sync. Until then your data is saved on this device only."
                    : `Signed in — syncing with ${getServerUrl() || "this server"}.`}
                </p>
              </div>
              {localMode && onSignIn ? (
                <>
                  <button
                    onClick={onSignIn}
                    className="self-start px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-medium transition-colors"
                  >
                    Sign in to sync
                  </button>
                  <p className="text-xs text-gray-500">
                    Signing in merges what&apos;s on this device with what&apos;s on the server — nothing is
                    overwritten.
                  </p>
                </>
              ) : !confirmingSignOut ? (
                <button
                  onClick={() => setConfirmingSignOut(true)}
                  className="self-start px-4 py-2 rounded-lg bg-red-900/40 hover:bg-red-900/60 border border-red-800/60 text-sm text-red-300 font-medium transition-colors"
                >
                  Sign out…
                </button>
              ) : (
                <div
                  className="flex flex-col gap-2 px-3 py-3 rounded-lg bg-red-900/20 border border-red-800/50"
                  role="alertdialog"
                  aria-label="Confirm signing out"
                >
                  <p className="text-sm text-gray-200">
                    Sign out of sync on this device? Changes made here stop syncing until you sign in again. Your marks,
                    notes and saves stay in this browser unless you remove them.
                  </p>
                  <label className="flex items-start gap-2 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={removeDataOnSignOut}
                      onChange={(e) => setRemoveDataOnSignOut(e.target.checked)}
                      className="mt-0.5 accent-red-500"
                    />
                    <span>
                      Also remove my data from this browser
                      <span className="block text-xs text-gray-400">
                        For a shared computer. The copy on the server is kept.
                      </span>
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setConfirmingSignOut(false);
                        onLogout(removeDataOnSignOut);
                      }}
                      className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-sm text-white font-medium transition-colors"
                    >
                      Sign out
                    </button>
                    <button
                      onClick={() => setConfirmingSignOut(false)}
                      className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {!localMode && <DeviceSessions onResult={showToast} />}
              {!localMode && <ServerSnapshots onResult={showToast} onRestored={refreshUndo} />}
            </section>
          </>
        )}
        <div className="h-px bg-gray-800" />
        <footer className="text-xs text-gray-500 pb-4">
          Pokédex Tracker {displayVersion(__APP_VERSION__)} ·{" "}
          <a
            href="https://github.com/Jabberwocky7777/Pokedex-Tracker/blob/main/CHANGELOG.md"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted hover:text-gray-300"
          >
            What&apos;s new
          </a>
        </footer>
      </PageShell>

      {/* Always in the page, so screen readers announce each new message */}
      <div role="status" aria-live="polite" className="contents">
        {toast && (
          <div
            className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full border text-sm font-medium shadow-lg backdrop-blur pointer-events-none ${
              toast.ok ? "bg-gray-800/90 border-gray-700 text-emerald-300" : "bg-red-900/90 border-red-700 text-red-200"
            }`}
          >
            {toast.msg}
          </div>
        )}
      </div>
    </div>
  );
}

/** "1.8.0" becomes "1.8", as releases are named (scripts/release.mjs) */
function displayVersion(version: string): string {
  return version.replace(/\.0$/, "");
}

const formatDate = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function backupLabel({ fileName, data }: { fileName: string; data: BackupData }): string {
  const exported = Date.parse(data.exportedAt);
  return Number.isFinite(exported) ? `the backup from ${formatDate(exported)}` : `the backup ${fileName}`;
}
