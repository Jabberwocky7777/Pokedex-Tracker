import { openPokedex } from "../../lib/navigate";
import { useState, useEffect, useMemo, useRef } from "react";
import type { Pokemon, MetaData } from "../../types";
import { versionGroupsFor, type VersionGroup } from "../../lib/move-fetch";
import { fetchMoveList, type MoveSummary } from "../../lib/move-list-fetch";
import { useSettingsStore } from "../../store/useSettingsStore";
import { AttackdexPanel } from "../pokedex/AttackdexPanel";
import MoveSearchBar from "../pokedex/MoveSearchBar";
import HmPlannerPanel from "../pokedex/HmPlannerPanel";
import MoveComboPanel from "./MoveComboPanel";
import MoveBrowser from "./MoveBrowser";
import { PageHeader, PageShell } from "../shared/Page";

type Mode = "single" | "combo" | "hm-planner";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
  /** Which move tool: one move, the move-combo search or the HM planner (the Pokédex's section) */
  mode: Mode;
}

const HEADINGS: Record<Mode, { title: string; subtitle: string }> = {
  single: { title: "Moves", subtitle: "Look up a move: what it does in each game and which Pokémon learn it." },
  combo: { title: "Who learns a combo", subtitle: "Pokémon that can learn every move you pick." },
  "hm-planner": { title: "HM planner", subtitle: "Pokémon that can learn every HM you pick." },
};

/** The move tools of the Pokédex tab (once the Attackdex tab): one move, move combos and the HM planner. */
export default function MovesView({ allPokemon, mode }: Props) {
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const activeAttackdexSlug = useSettingsStore((s) => s.activeAttackdexSlug);
  const setActiveAttackdexSlug = useSettingsStore((s) => s.setActiveAttackdexSlug);
  const lastAttackdexSlug = useSettingsStore((s) => s.lastAttackdexSlug);
  const lastAttackdexVersionGroup = useSettingsStore((s) => s.lastAttackdexVersionGroup);
  const setLastAttackdexState = useSettingsStore((s) => s.setLastAttackdexState);

  const activeVersionGroups = versionGroupsFor(activeGeneration);
  const defaultVg = activeVersionGroups[0].id;
  const restoredVg =
    lastAttackdexVersionGroup && activeVersionGroups.some((g) => g.id === lastAttackdexVersionGroup)
      ? (lastAttackdexVersionGroup as VersionGroup)
      : defaultVg;
  const [versionGroup, setVersionGroup] = useState<VersionGroup>(restoredVg);

  // Back to the first game when the generation changes — but not on mount,
  // where it would throw away the version group restored above
  const previousGeneration = useRef(activeGeneration);
  useEffect(() => {
    if (previousGeneration.current === activeGeneration) return;
    previousGeneration.current = activeGeneration;
    setVersionGroup(versionGroupsFor(activeGeneration)[0].id);
  }, [activeGeneration]);

  const [selectedMoveSlug, setSelectedMoveSlug] = useState<string | null>(lastAttackdexSlug);
  const lastAttackdexQuery = useSettingsStore((s) => s.lastAttackdexQuery);
  const [moveQuery, setMoveQuery] = useState(lastAttackdexQuery);

  const [showMoveDropdown, setShowMoveDropdown] = useState(false);

  // When navigated here from another tab with a pre-selected move, apply it once.
  // (openMove also switches the Pokédex to the Moves section.)
  // "" is an address with no move (Back to Moves with nothing open): it clears the selection.
  const [appliedLink, setAppliedLink] = useState<string | null>(null);
  if (activeAttackdexSlug !== appliedLink) {
    setAppliedLink(activeAttackdexSlug);
    if (activeAttackdexSlug) {
      setSelectedMoveSlug(activeAttackdexSlug);
      setMoveQuery("");
      setShowMoveDropdown(false);
    } else if (activeAttackdexSlug === "") {
      setSelectedMoveSlug(null);
    }
  }
  useEffect(() => {
    if (activeAttackdexSlug !== null) setActiveAttackdexSlug(null);
  }, [activeAttackdexSlug, setActiveAttackdexSlug]);

  // Sync current state back to store so it survives tab switches.
  useEffect(() => {
    setLastAttackdexState({ query: moveQuery, slug: selectedMoveSlug, mode, versionGroup });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveQuery, selectedMoveSlug, mode, versionGroup]);
  const [moveList, setMoveList] = useState<MoveSummary[]>([]);

  useEffect(() => {
    fetchMoveList()
      .then(setMoveList)
      .catch(() => {});
  }, []);

  const moveSuggestions = useMemo(() => {
    const q = moveQuery.trim().toLowerCase();
    if (!q) return [];
    return moveList.filter((m) => m.displayName.toLowerCase().includes(q) || m.slug.includes(q)).slice(0, 10);
  }, [moveQuery, moveList]);

  // A newly opened move starts at the top, wherever the last one was scrolled to
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [selectedMoveSlug]);

  return (
    <div className="flex flex-col h-full">
      <PageShell ref={mainRef} width="reading">
        <PageHeader title={HEADINGS[mode].title} subtitle={HEADINGS[mode].subtitle} />

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
                  setMoveQuery("");
                  setShowMoveDropdown(false);
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
                onSelectPokemon={openPokedex}
              />
            ) : (
              <MoveBrowser
                versionGroup={versionGroup}
                onSelect={(slug) => {
                  setSelectedMoveSlug(slug);
                  setMoveQuery("");
                  setShowMoveDropdown(false);
                }}
              />
            )}
          </>
        )}

        {mode === "combo" && (
          <MoveComboPanel allPokemon={allPokemon} activeGeneration={activeGeneration} onSelectPokemon={openPokedex} />
        )}

        {mode === "hm-planner" && (
          <HmPlannerPanel allPokemon={allPokemon} activeGeneration={activeGeneration} onSelectPokemon={openPokedex} />
        )}
      </PageShell>
    </div>
  );
}
