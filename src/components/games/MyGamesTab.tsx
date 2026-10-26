import { lazy, Suspense, useMemo } from "react";
import { Save, Trophy } from "lucide-react";
import type { GamesSection, MetaData, Pokemon } from "../../types";
import { useSettingsStore } from "../../store/useSettingsStore";
import { PageHeader, PageShell } from "../shared/Page";
import SegmentedControl, { type SegmentOption } from "../shared/SegmentedControl";

const GameProgressView = lazy(() => import("../tracker/GameProgressView"));
const SavesView = lazy(() => import("../saves/SavesView"));

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

const SECTIONS: SegmentOption<GamesSection>[] = [
  { value: "progress", label: "Progress", icon: <Trophy size={14} aria-hidden="true" /> },
  { value: "saves",    label: "Saves",    icon: <Save size={14} aria-hidden="true" /> },
];

/**
 * My games: how far you are in each game (badges and story milestones) and
 * your imported save files — the two belong together, since importing a save
 * moves your progress on.
 */
export default function MyGamesTab({ allPokemon, meta }: Props) {
  const section = useSettingsStore((s) => s.gamesSection);
  const setSection = useSettingsStore((s) => s.setGamesSection);
  const pokemonMap = useMemo(() => new Map(allPokemon.map((p) => [p.id, p])), [allPokemon]);

  return (
    <div className="flex flex-col h-full">
      <PageShell width="full" className="!gap-4">
        <PageHeader
          title="My games"
          subtitle={section === "progress"
            ? "Badges and story milestones in each game, what they open, and what to play next."
            : "Your imported save files: boxes, living dex, to-do list, transfers and trades."}
          actions={<SegmentedControl ariaLabel="My games section" size="sm" value={section} onChange={setSection} options={SECTIONS} />}
        />
        <Suspense fallback={null}>
          {section === "progress" && <GameProgressView allPokemon={allPokemon} meta={meta} />}
          {section === "saves" && <SavesView pokemonMap={pokemonMap} />}
        </Suspense>
      </PageShell>
    </div>
  );
}
