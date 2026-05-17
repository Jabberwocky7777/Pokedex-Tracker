import { useState, useEffect } from "react";
import { Search, Swords, Map } from "lucide-react";
import type { Pokemon, MetaData } from "../../types";
import {
  GEN3_VERSION_GROUPS,
  GEN4_VERSION_GROUPS,
  type VersionGroup,
  slugToDisplayName,
} from "../../lib/move-fetch";
import { fetchMoveList, type MoveSummary } from "../../lib/move-list-fetch";
import { useSettingsStore } from "../../store/useSettingsStore";
import Header from "../layout/Header";
import { AttackdexPanel } from "../pokedex/AttackdexPanel";
import MoveSearchBar from "../pokedex/MoveSearchBar";
import HmPlannerPanel from "../pokedex/HmPlannerPanel";
import MoveComboPanel from "./MoveComboPanel";

type Mode = "single" | "combo" | "hm-planner";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

export default function AttackdexTab({ allPokemon }: Props) {
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const setActiveTab = useSettingsStore((s) => s.setActiveTab);
  const setActivePokedexId = useSettingsStore((s) => s.setActivePokedexId);
  const activeAttackdexSlug = useSettingsStore((s) => s.activeAttackdexSlug);
  const setActiveAttackdexSlug = useSettingsStore((s) => s.setActiveAttackdexSlug);
  const lastAttackdexQuery = useSettingsStore((s) => s.lastAttackdexQuery);
  const lastAttackdexSlug = useSettingsStore((s) => s.lastAttackdexSlug);
  const lastAttackdexMode = useSettingsStore((s) => s.lastAttackdexMode);
  const lastAttackdexVersionGroup = useSettingsStore((s) => s.lastAttackdexVersionGroup);
  const setLastAttackdexState = useSettingsStore((s) => s.setLastAttackdexState);

  const [mode, setMode] = useState<Mode>(lastAttackdexMode);

  const activeVersionGroups = activeGeneration === 4 ? GEN4_VERSION_GROUPS : GEN3_VERSION_GROUPS;
  const defaultVg = activeVersionGroups[0].id;
  const restoredVg = (lastAttackdexVersionGroup && activeVersionGroups.some((g) => g.id === lastAttackdexVersionGroup))
    ? lastAttackdexVersionGroup as VersionGroup
    : defaultVg;
  const [versionGroup, setVersionGroup] = useState<VersionGroup>(restoredVg);

  useEffect(() => {
    const groups = activeGeneration === 4 ? GEN4_VERSION_GROUPS : GEN3_VERSION_GROUPS;
    setVersionGroup(groups[0].id);
  }, [activeGeneration]);

  const [selectedMoveSlug, setSelectedMoveSlug] = useState<string | null>(lastAttackdexSlug);
  const [moveQuery, setMoveQuery] = useState(lastAttackdexQuery);

  // When navigated here from another tab with a pre-selected move, apply it once.
  useEffect(() => {
    if (activeAttackdexSlug) {
      setSelectedMoveSlug(activeAttackdexSlug);
      setMoveQuery(slugToDisplayName(activeAttackdexSlug));
      setActiveAttackdexSlug(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAttackdexSlug]);

  // Sync current state back to store so it survives tab switches.
  useEffect(() => {
    setLastAttackdexState({ query: moveQuery, slug: selectedMoveSlug, mode, versionGroup });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveQuery, selectedMoveSlug, mode, versionGroup]);
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const [moveSuggestions, setMoveSuggestions] = useState<MoveSummary[]>([]);
  const [moveList, setMoveList] = useState<MoveSummary[]>([]);

  useEffect(() => {
    fetchMoveList().then(setMoveList).catch(() => {});
  }, []);

  useEffect(() => {
    const q = moveQuery.trim().toLowerCase();
    if (!q) { setMoveSuggestions([]); return; }
    setMoveSuggestions(
      moveList
        .filter((m) => m.displayName.toLowerCase().includes(q) || m.slug.includes(q))
        .slice(0, 10)
    );
  }, [moveQuery, moveList]);

  function handleSelectPokemon(id: number) {
    setActivePokedexId(id);
    setActiveTab("pokedex");
  }

  return (
    <div className="flex flex-col h-full">
      <Header />

      <main className="flex-1 overflow-y-auto pb-[calc(52px+env(safe-area-inset-bottom,0px))] md:pb-0">
        <div className="max-w-3xl mx-auto w-full px-4 py-8 flex flex-col gap-6">

          {/* Title + mode toggle */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Attackdex</h2>
              <p className="text-sm text-gray-400">
                Look up moves and find Pokémon that can learn them.
              </p>
            </div>
            <div className="bg-gray-800 p-0.5 rounded-xl flex flex-shrink-0 gap-0.5">
              {([
                { id: "single",     label: "Single", Icon: Search },
                { id: "combo",      label: "Combo",  Icon: Swords },
                { id: "hm-planner", label: "HM",     Icon: Map    },
              ] as const).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setMode(id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    mode === id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {mode === "single" && (
            <>
              <div className="bg-gray-900 rounded-xl p-4">
                <MoveSearchBar
                  query={moveQuery}
                  setQuery={setMoveQuery}
                  showDropdown={showMoveDropdown}
                  setShowDropdown={setShowMoveDropdown}
                  suggestions={moveSuggestions}
                  onSelect={(slug) => {
                    setSelectedMoveSlug(slug);
                    setMoveQuery(slugToDisplayName(slug));
                  }}
                  onClear={() => setSelectedMoveSlug(null)}
                />
              </div>

              {selectedMoveSlug ? (
                <AttackdexPanel
                  slug={selectedMoveSlug}
                  allPokemon={allPokemon}
                  activeGeneration={activeGeneration}
                  versionGroup={versionGroup}
                  onVersionGroupChange={setVersionGroup}
                  onSelectPokemon={handleSelectPokemon}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-24 text-gray-600 gap-3">
                  <svg
                    className="w-10 h-10 opacity-30"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <p className="text-sm">Search for a move above to see its details and learners.</p>
                </div>
              )}
            </>
          )}

          {mode === "combo" && (
            <MoveComboPanel
              allPokemon={allPokemon}
              activeGeneration={activeGeneration}
              onSelectPokemon={handleSelectPokemon}
            />
          )}

          {mode === "hm-planner" && (
            <HmPlannerPanel
              allPokemon={allPokemon}
              activeGeneration={activeGeneration}
              onSelectPokemon={handleSelectPokemon}
            />
          )}

        </div>
      </main>
    </div>
  );
}
