import { useRef, useState } from "react";
import GenerationSelector from "../controls/GenerationSelector";
import ThemeSelector from "../ThemeSelector";
import { downloadBackup, exportFullCSV, restoreBackup } from "../../lib/backup";
import { isLocalMode, getServerUrl } from "../../lib/sync";
import { clearGenerationWithUndo } from "../../lib/dex-actions";
import { useDexStore } from "../../store/useDexStore";
import type { Pokemon, MetaData } from "../../types";
import { useSettingsStore } from "../../store/useSettingsStore";
import ServerSnapshots from "./ServerSnapshots";
import type { LegibilityLevel } from "../../lib/applyLegibility";
import { PageHeader, PageShell } from "../shared/Page";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
  onLogout?: () => void;
  /** Local-mode users: open the login screen without leaving local mode. */
  onSignIn?: () => void;
}

export default function SettingsTab({ allPokemon, meta, onLogout, onSignIn }: Props) {
  const localMode = isLocalMode();
  const legibility = useSettingsStore((s) => s.legibility);
  const setLegibility = useSettingsStore((s) => s.setLegibility);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const genName = meta.generations.find((g) => g.id === activeGeneration)?.name ?? `Generation ${activeGeneration}`;
  const markCount = useDexStore((s) =>
    (s.caughtByGen[activeGeneration]?.length ?? 0) +
    (s.pendingByGen[activeGeneration]?.length ?? 0) +
    (s.shinyByGen[activeGeneration]?.length ?? 0) +
    (s.placedByGen[activeGeneration]?.length ?? 0));
  // Clearing a generation is a two-step action: the button turns into a confirmation
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  const LEGIBILITY_LABELS: LegibilityLevel[] = ["off", "comfortable", "large"];
  const LEGIBILITY_DISPLAY = ["Off", "Comfortable", "Large"];
  const legibilityIndex = LEGIBILITY_LABELS.indexOf(legibility);
  const importInputRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    const result = await restoreBackup(file);
    showToast(result.ok ? "Backup restored!" : `Import failed: ${result.error}`, result.ok);
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
              <p className="text-sm text-gray-400 mt-0.5">High legibility — Larger text, higher contrast, and readable badges. Works with any theme.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="py-3" style={{ minHeight: 44 }}>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={1}
                  value={legibilityIndex}
                  onChange={(e) => setLegibility(LEGIBILITY_LABELS[Number(e.target.value)])}
                  aria-label="High legibility level"
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
              <div className="flex justify-between">
                {LEGIBILITY_DISPLAY.map((label, i) => (
                  <span
                    key={label}
                    className={`text-xs ${i === legibilityIndex ? "text-indigo-300 font-medium" : "text-gray-500"}`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <div className="h-px bg-gray-800" />

          {/* Data */}
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-100">Data</h2>
              <p className="text-sm text-gray-400 mt-0.5">Export or restore your tracker data</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={downloadBackup}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 font-medium transition-colors"
              >
                Export JSON
              </button>
              <button
                onClick={() => exportFullCSV(allPokemon)}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 font-medium transition-colors"
              >
                Export CSV
              </button>
              <button
                onClick={() => importInputRef.current?.click()}
                className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 font-medium transition-colors"
              >
                Import Backup
              </button>
            </div>
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
            />

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
                <div className="flex flex-col gap-2 px-3 py-3 rounded-lg bg-red-900/20 border border-red-800/50" role="alertdialog" aria-label="Confirm clearing marks">
                  <p className="text-sm text-gray-200">
                    Remove all caught, pending, shiny and placed marks for {genName}? Other generations are not affected.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { clearGenerationWithUndo(activeGeneration, genName); setConfirmingClear(false); }}
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
                      Signing in merges what&apos;s on this device with what&apos;s on the server — nothing is overwritten.
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
                  <div className="flex flex-col gap-2 px-3 py-3 rounded-lg bg-red-900/20 border border-red-800/50" role="alertdialog" aria-label="Confirm signing out">
                    <p className="text-sm text-gray-200">
                      Sign out of sync on this device? Changes made here stop syncing until you sign in again.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setConfirmingSignOut(false); onLogout(); }}
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
                {!localMode && <ServerSnapshots onResult={showToast} />}
              </section>
            </>
          )}

      </PageShell>

      {toast && (
        <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full border text-sm font-medium shadow-lg backdrop-blur pointer-events-none ${
          toast.ok ? "bg-gray-800/90 border-gray-700 text-emerald-300" : "bg-red-900/90 border-red-700 text-red-200"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
