import { useMemo, useRef, useState } from "react";
import { Save, Upload } from "lucide-react";
import type { Pokemon } from "../../types";
import { restoreGenLogged } from "../../lib/dex-actions";
import { profileIdOf, useSaveStore, type SavesPanel } from "../../store/useSaveStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useUndoStore } from "../../store/useUndoStore";
import { useProfileMons } from "../../hooks/useSaves";
import { FAMILY_LABELS } from "../../lib/save/gen4";
import { parseSave } from "../../lib/save/parse";
import { allocatePending, analyzeProfile, livingDexStats } from "../../lib/save/living-dex";
import { checkTowards } from "../../lib/save/evolve";
import { betterCopies } from "../../lib/save/best-copy";
import { findFull } from "../../lib/save/todo";
import {
  SaveParseError, genConfigOf,
  type ParsedSave, type SaveProfile, type SlimMon,
} from "../../lib/save/types";
import BoxBrowser from "./BoxBrowser";
import { showInTracker } from "../../lib/navigate";
import ImportReview, { type ReviewRequest } from "./ImportReview";
import MonCard from "./MonCard";
import TodoPanel from "./TodoPanel";
import PlanPanel from "./PlanPanel";
import SearchPanel from "./SearchPanel";
import HistoryPanel from "./HistoryPanel";
import TradeSession from "./TradeSession";
import { daysSince, importedAgo, STALE_AFTER_DAYS } from "./saveDisplay";

interface Props {
  pokemonMap: Map<number, Pokemon>;
}

/** A parsed dump that is older than the stored one — held back until the user confirms. */
interface OlderDump {
  parsed: ParsedSave;
  bytes: Uint8Array;
  fileName: string;
  previous: SaveProfile;
}

const PANELS: { id: SavesPanel; label: string }[] = [
  { id: "boxes", label: "Boxes" },
  { id: "todo", label: "To do" },
  { id: "plan", label: "Plan by game" },
  { id: "trade", label: "Trade" },
  { id: "search", label: "Search" },
  { id: "history", label: "History" },
];

// DS saves are 512 KB; some emulators append a footer or pad to 1 MB
const MAX_SAVE_FILE_BYTES = 2 * 1024 * 1024;

const BUTTON = "px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 font-medium transition-colors";
const formatDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

function Tile({ value, label, tone = "text-white" }: { value: React.ReactNode; label: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-gray-800/50 border border-gray-800 px-3 py-2.5">
      <div className={`text-xl font-bold tabular-nums ${tone}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

export default function SavesView({ pokemonMap }: Props) {
  const profiles = useProfileMons();
  const activeProfileId = useSaveStore((s) => s.activeProfileId);
  const fullSaves = useSaveStore((s) => s.fullSaves);
  const reverts = useSaveStore((s) => s.reverts);
  const panel = useSaveStore((s) => s.panel);
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const storageFailed = useSaveStore((s) => s.storageFailed);
  const setPanel = useSaveStore((s) => s.setPanel);
  const shinyLivingDex = useSettingsStore((s) => s.shinyLivingDex);
  const setShinyLivingDex = useSettingsStore((s) => s.setShinyLivingDex);

  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [olderDump, setOlderDump] = useState<OlderDump | null>(null);
  const [review, setReview] = useState<ReviewRequest | null>(null);
  // Selection is kept as "box:slot" so it survives the Pokémon list being rebuilt
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const setSelected = (mon: SlimMon | null) => setSelectedKey(mon ? `${mon.box}:${mon.slot}` : null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  // Set when a search result is opened, so the box browser starts on that Pokémon's box
  const [openBox, setOpenBox] = useState<number | null>(null);
  // Fixed for the life of the view, so staleness labels don't change mid-render
  const [now] = useState(() => Date.now());

  const active = profiles.find((p) => p.profile.id === activeProfileId) ?? profiles[0] ?? null;
  const analysis = useMemo(() => (active ? analyzeProfile(active, pokemonMap) : null), [active, pokemonMap]);
  const selected = active?.mons.find((m) => `${m.box}:${m.slot}` === selectedKey) ?? null;

  // Pokémon in the open save that the living dex is waiting on and that can evolve right now
  const readyKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!active) return keys;
    const gen = genConfigOf(active.profile.family);
    const together = profiles.filter((p) => genConfigOf(p.profile.family).gen === gen.gen);
    for (const [target, reason] of allocatePending(together, pokemonMap, gen.maxSpecies).pending) {
      if (reason.profileId !== active.profile.id) continue;
      const check = checkTowards(reason.mon, findFull(fullSaves, reason.profileId, reason.mon), target, pokemonMap);
      if (check?.status === "ready") keys.add(`${reason.mon.box}:${reason.mon.slot}`);
    }
    return keys;
  }, [active, profiles, pokemonMap, fullSaves]);

  // Placed species in the open living dex that have a better copy somewhere
  const better = useMemo(() => {
    if (!active || active.profile.role !== "living-dex") return null;
    const gen = genConfigOf(active.profile.family);
    const together = [active, ...profiles.filter((p) => p !== active && p.profile.role !== "living-dex" && genConfigOf(p.profile.family).gen === gen.gen)];
    return betterCopies(together, pokemonMap, { shinyLivingDex, fullSaves, maxSpecies: gen.maxSpecies });
  }, [active, profiles, pokemonMap, fullSaves, shinyLivingDex]);

  const store = useSaveStore.getState;

  function commitImport(parsed: ParsedSave, bytes: Uint8Array, fileName: string, previous: SaveProfile | undefined) {
    const { profile, since } = store().saveImport(parsed, bytes, fileName);
    setSelected(null);
    setReview({
      profileId: profile.id,
      since,
      incomingSaveCount: parsed.saveCount,
      previousSaveCount: previous?.saveCount,
      previousImportedAt: previous?.importedAt,
      warnings: parsed.warnings,
    });
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setNotice(null);
    try {
      // A game ROM picked by mistake can be hundreds of MB — don't read it just to reject it
      if (file.size > MAX_SAVE_FILE_BYTES) {
        setError("That file is too big to be a save. Pick the .sav dumped from your cartridge (512 KB or 128 KB), not the .nds or .gba game file.");
        return;
      }
      // The file is only ever read; nothing is written back to it
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = parseSave(bytes);
      const previous = store().profiles.find((p) => p.id === profileIdOf(parsed));
      if (previous && parsed.saveCount < previous.saveCount) {
        setOlderDump({ parsed, bytes, fileName: file.name, previous });
        return;
      }
      commitImport(parsed, bytes, file.name, previous);
    } catch (err) {
      setError(err instanceof SaveParseError ? err.message : "That file couldn't be read.");
    }
  }

  function revertLastImport(profileId: string) {
    const point = reverts[profileId];
    if (!point) return;
    const undo = restoreGenLogged(point.gen, point.snapshot, "revert", "Reverted the last import");
    store().setRevert(profileId, null);
    useUndoStore.getState().show("Reverted the last import", () => {
      undo();
      store().setRevert(profileId, point);
    });
  }

  async function rereadAll() {
    const { reread, failed } = await store().rereadAll();
    setSelected(null);
    setNotice(
      reread === 0 && failed === 0
        ? "No save files are stored on this device to re-read."
        : `Re-read ${reread} save${reread === 1 ? "" : "s"}${failed ? `; ${failed} couldn't be read` : ""}.`,
    );
  }

  // The card's button leaves the Saves view for the box grid, with the Pokémon selected
  function showSpeciesInTracker(speciesId: number) {
    const settings = useSettingsStore.getState();
    settings.setViewMode("box");
    showInTracker(speciesId, active ? genConfigOf(active.profile.family).gen : settings.activeGeneration);
  }

  // No `accept` attribute: iOS greys out .sav files when one is set
  const input = <input ref={fileInput} type="file" className="hidden" onChange={handleFile} data-testid="save-file-input" />;
  const importButton = (
    <button
      onClick={() => fileInput.current?.click()}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-medium transition-colors"
    >
      <Upload size={16} /> Import a save
    </button>
  );
  const errorBanner = error && (
    <div role="alert" className="px-3 py-2.5 rounded-lg bg-red-900/30 border border-red-800/60 text-sm text-red-200">{error}</div>
  );

  const olderDialog = olderDump && (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60]" onClick={() => setOlderDump(null)} />
      <div
        role="alertdialog"
        aria-label="Older save"
        className="fixed z-[60] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-md rounded-2xl bg-gray-900 border border-amber-500/50 p-4 flex flex-col gap-3 shadow-2xl"
      >
        <h2 className="text-lg font-bold text-amber-200" style={{ fontFamily: "var(--theme-font-display)" }}>
          This dump is older than the one you imported on {formatDate(olderDump.previous.importedAt)}
        </h2>
        <p className="text-sm text-gray-300">
          {olderDump.fileName} was saved earlier in the game than the copy of {olderDump.previous.label} already here
          (save #{olderDump.parsed.saveCount} vs #{olderDump.previous.saveCount}). Using it replaces the newer copy.
          No marks will be removed unless you tick them yourself.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setOlderDump(null)} className={`flex-1 ${BUTTON}`}>Cancel</button>
          <button
            onClick={() => {
              commitImport(olderDump.parsed, olderDump.bytes, olderDump.fileName, olderDump.previous);
              setOlderDump(null);
            }}
            className="flex-1 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-sm text-white font-medium transition-colors"
          >
            Use the older dump
          </button>
        </div>
      </div>
    </>
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!active || !analysis) {
    return (
      <div className="p-4 flex-1 flex flex-col items-center gap-8">
        <div className="max-w-md text-center flex flex-col items-center gap-3 mt-6">
          <Save size={40} className="text-gray-600" />
          <h2 className="text-lg font-bold text-white" style={{ fontFamily: "var(--theme-font-display)" }}>Your game saves</h2>
          <p className="text-sm text-gray-400">
            Import a save file from Diamond, Pearl, Platinum, HeartGold or SoulSilver — or Ruby, Sapphire, Emerald,
            FireRed or LeafGreen — to browse every Pokémon in it and update your tracker from it. Use the{" "}
            <span className="font-mono">.sav</span> dumped from your cartridge (512 KB for DS games, 128 KB for Game Boy
            Advance), not the <span className="font-mono">.nds</span> or <span className="font-mono">.gba</span> game file.
          </p>
          <p className="text-xs text-gray-500">
            The file is read on this device only. It is never uploaded and never changed.
          </p>
          {importButton}
          {errorBanner}
          {input}
        </div>
        {/* A trade can be planned between two games without importing anything */}
        <TradeSession profiles={profiles} pokemonMap={pokemonMap} generation={activeGeneration} />
        {olderDialog}
      </div>
    );
  }

  const { profile } = active;
  const isLivingDex = profile.role === "living-dex";
  const cfg = genConfigOf(profile.family);
  const stats = livingDexStats(analysis, cfg.maxSpecies);
  const full = fullSaves[profile.id];
  const selectedFull = selected
    ? full?.mons.find((m) => m.box === selected.box && m.slot === selected.slot && m.species === selected.species)
    : undefined;
  const selectedPokemon = selected ? pokemonMap.get(selected.species) : undefined;
  const revertPoint = reverts[profile.id];
  const betterFor = selected ? better?.get(selected.species) : undefined;
  const betterNote = betterFor && betterFor.placed.mon === selected ? `${betterFor.where} (${betterFor.description})` : undefined;
  const nonEgg = active.mons.filter((m) => !m.isEgg);
  // Saves of the same generation as the open one work together (living dex + playthroughs)
  const sameGen = profiles.filter((p) => genConfigOf(p.profile.family).gen === genConfigOf(profile.family).gen);

  return (
    <div className="p-4 flex flex-col gap-4">
      {input}

      {/* Profile bar */}
      <div className="flex flex-wrap items-center gap-2">
        {profiles.map(({ profile: p }) => {
          const stale = daysSince(p.importedAt, now) > STALE_AFTER_DAYS;
          const isActive = p.id === profile.id;
          return (
            <button
              key={p.id}
              onClick={() => { store().setActiveProfile(p.id); setSelected(null); setConfirmingRemove(false); }}
              aria-pressed={isActive}
              className={`px-3 py-1.5 rounded-lg border text-left transition-colors ${
                isActive ? "bg-gray-700 border-gray-500" : "bg-gray-800/60 border-gray-700 hover:bg-gray-800"
              }`}
            >
              <div className="text-sm font-medium text-gray-100">{p.role === "living-dex" ? "★ " : ""}{p.label}</div>
              <div className={`text-xs ${stale ? "text-amber-400" : "text-gray-500"}`}>{importedAgo(p.importedAt, now)}</div>
            </button>
          );
        })}
        {importButton}
      </div>

      {errorBanner}
      {storageFailed && (
        <div role="alert" className="px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/40 text-sm text-amber-100">
          This save couldn&apos;t be stored on this device (storage is full or blocked, as in a private window). You can use it
          now, but it will be gone after a reload.
        </div>
      )}
      {notice && <div role="status" className="px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700 text-sm text-gray-300">{notice}</div>}

      {/* Settings */}
      <section className="rounded-xl bg-gray-900 border border-gray-800 p-3 flex flex-col gap-3 max-w-3xl">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 flex-1 min-w-[10rem]">
            <span className="text-xs text-gray-500">Name</span>
            <input
              value={profile.label}
              onChange={(e) => store().updateProfile(profile.id, { label: e.target.value })}
              className="px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">This save is</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-700" role="group" aria-label="Save role">
              {([["living-dex", "★ My living dex"], ["playthrough", "A playthrough"]] as const).map(([role, label]) => (
                <button
                  key={role}
                  onClick={() => { store().updateProfile(profile.id, { role }); setSelected(null); }}
                  aria-pressed={profile.role === role}
                  className={`px-3 py-1.5 text-sm transition-colors ${
                    profile.role === role ? "bg-gray-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {isLivingDex && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Dex starts in</span>
              <select
                value={profile.startBox}
                onChange={(e) => { store().updateProfile(profile.id, { startBox: Number(e.target.value) }); setSelected(null); }}
                className="px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-100"
              >
                {Array.from({ length: cfg.boxCount }, (_, i) => (
                  <option key={i} value={i}>Box {i + 1}{active.boxNames[i] && active.boxNames[i] !== `Box ${i + 1}` ? ` — ${active.boxNames[i]}` : ""}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="text-xs text-gray-500">
          {FAMILY_LABELS[profile.family]} · Trainer {profile.trainer.name} (ID {String(profile.trainer.tid).padStart(5, "0")}) ·
          save #{profile.saveCount} · {profile.fileName}
          {!full && " · imported on another device"}
        </div>

        {isLivingDex && (
          <label className="flex items-start gap-2.5 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={profile.ownOnly ?? false}
              onChange={(e) => store().updateProfile(profile.id, { ownOnly: e.target.checked })}
              className="w-4 h-4 mt-0.5 accent-indigo-500"
            />
            <span>
              Only count my own catches as placed
              <span className="block text-xs text-gray-500">
                A traded Pokémon in the right slot {profile.ownOnly ? "doesn't count" : "counts"} — its original trainer has to be {profile.trainer.name || "you"}.
              </span>
            </span>
          </label>
        )}

        <label className="flex items-start gap-2.5 text-sm text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={shinyLivingDex}
            onChange={(e) => setShinyLivingDex(e.target.checked)}
            className="w-4 h-4 mt-0.5 accent-indigo-500"
          />
          <span>
            Shiny living dex
            <span className="block text-xs text-gray-500">
              {shinyLivingDex
                ? "✦ only counts when the Pokémon sitting in the living-dex slot is shiny."
                : "✦ means you own a shiny of that species somewhere."}
            </span>
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setReview({ profileId: profile.id, warnings: full?.warnings ?? [] })}
            className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm text-white font-medium transition-colors"
          >
            Update tracker from this save…
          </button>
          {revertPoint && (
            <button onClick={() => revertLastImport(profile.id)} className={BUTTON} title={`Puts your marks back to how they were before the import on ${formatDate(revertPoint.at)}`}>
              Revert last import
            </button>
          )}
          <button onClick={rereadAll} className={BUTTON} title="Parse the stored save files again with the current reader">
            Re-read all saves
          </button>
          {!confirmingRemove ? (
            <button
              onClick={() => setConfirmingRemove(true)}
              className="px-3 py-2 rounded-lg bg-red-900/40 hover:bg-red-900/60 border border-red-800/60 text-sm text-red-300 font-medium transition-colors"
            >
              Remove…
            </button>
          ) : (
            <span className="flex items-center gap-2 px-3 py-1 rounded-lg bg-red-900/20 border border-red-800/50" role="alertdialog" aria-label="Confirm removing this save">
              <span className="text-sm text-gray-200">Remove this save? Your tracker marks stay.</span>
              <button
                onClick={() => { store().removeProfile(profile.id); setConfirmingRemove(false); setSelected(null); }}
                className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-sm text-white font-medium"
              >
                Remove
              </button>
              <button onClick={() => setConfirmingRemove(false)} className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200">
                Cancel
              </button>
            </span>
          )}
        </div>
      </section>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-3xl">
        {isLivingDex ? (
          <>
            <Tile value={<>{stats.placed}<span className="text-sm text-gray-500 font-normal">/{cfg.maxSpecies}</span></>} label="★ Placed" tone="text-amber-300" />
            <Tile value={stats.needsEvolving} label="Needs to evolve" tone="text-yellow-300" />
            <Tile value={stats.ownedNotInSlot} label="Owned, not in its slot" />
            <Tile value={stats.missing} label="Missing" tone="text-gray-300" />
          </>
        ) : (
          <>
            <Tile value={nonEgg.length} label="Pokémon" />
            <Tile value={<>{analysis.owned.size}<span className="text-sm text-gray-500 font-normal">/{cfg.maxSpecies}</span></>} label="Species" />
            <Tile value={analysis.shinyOwned.size} label="✦ Shiny species" tone="text-yellow-300" />
            <Tile value={active.mons.length - nonEgg.length} label="Eggs" tone="text-gray-300" />
          </>
        )}
      </div>

      {/* Panel tabs */}
      <div className="flex gap-1.5 border-b border-gray-800 pb-2 overflow-x-auto [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Save sections">
        {PANELS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={panel === tab.id}
            onClick={() => setPanel(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              panel === tab.id ? "bg-gray-700 text-white" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {panel === "todo" && <TodoPanel profiles={sameGen} pokemonMap={pokemonMap} />}
      {panel === "plan" && <PlanPanel profiles={sameGen} pokemonMap={pokemonMap} />}
      {panel === "trade" && <TradeSession profiles={profiles} pokemonMap={pokemonMap} generation={cfg.gen} />}
      {panel === "history" && <HistoryPanel profileId={profile.id} pokemonMap={pokemonMap} />}
      {panel === "search" && (
        <SearchPanel
          profiles={profiles}
          pokemonMap={pokemonMap}
          onPick={(profileId, mon) => {
            store().setActiveProfile(profileId);
            setOpenBox(mon.box);
            setSelected(mon);
            setPanel("boxes");
          }}
        />
      )}

      {/* Box browser + selected Pokémon */}
      {panel === "boxes" && <div className="flex flex-col xl:flex-row gap-4 items-start">
        <BoxBrowser
          key={`${profile.id}:${profile.role}:${profile.startBox}:${openBox}`}
          initialBox={openBox ?? undefined}
          profile={active}
          analysis={analysis}
          pokemonMap={pokemonMap}
          selected={selected}
          readyKeys={readyKeys}
          full={full}
          onSelect={setSelected}
        />
        {selected && selectedPokemon && (
          <div className="w-full max-w-xl xl:max-w-md">
            <MonCard
              mon={selected}
              full={selectedFull}
              pokemon={selectedPokemon}
              pokemonMap={pokemonMap}
              profile={active}
              analysis={analysis}
              betterCopy={betterNote}
              onShowInTracker={showSpeciesInTracker}
              onClose={() => setSelected(null)}
            />
          </div>
        )}
      </div>}

      {olderDialog}
      {review && (
        <ImportReview request={review} profiles={profiles} pokemonMap={pokemonMap} onClose={() => setReview(null)} />
      )}
    </div>
  );
}
