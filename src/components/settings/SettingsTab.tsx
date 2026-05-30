import { useRef, useState } from "react";
import Header from "../layout/Header";
import GenerationSelector from "../controls/GenerationSelector";
import ThemeSelector from "../ThemeSelector";
import { exportFullJSON, exportFullCSV, restoreBackup } from "../../lib/backup";
import type { Pokemon, MetaData } from "../../types";
import { useSettingsStore } from "../../store/useSettingsStore";
import type { LegibilityLevel } from "../../lib/applyLegibility";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
  onLogout?: () => void;
}

export default function SettingsTab({ allPokemon, meta, onLogout }: Props) {
  const legibility = useSettingsStore((s) => s.legibility);
  const setLegibility = useSettingsStore((s) => s.setLegibility);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

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
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      <Header onLogout={onLogout} />

      <div className="flex-1 overflow-y-auto pb-[calc(52px+env(safe-area-inset-bottom,0px))] md:pb-0">
        <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-8">

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
                onClick={exportFullJSON}
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
          </section>

          {/* Account */}
          {onLogout && (
            <>
              <div className="h-px bg-gray-800" />
              <section className="flex flex-col gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-100">Account</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Sign out of sync</p>
                </div>
                <button
                  onClick={onLogout}
                  className="self-start px-4 py-2 rounded-lg bg-red-900/40 hover:bg-red-900/60 border border-red-800/60 text-sm text-red-300 font-medium transition-colors"
                >
                  Sign Out
                </button>
              </section>
            </>
          )}

        </div>
      </div>

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
