import { lazy, Suspense, useState } from "react";
import { BookOpen, Map, Swords, Combine } from "lucide-react";
import type { MetaData, Pokemon, PokedexSection } from "../../types";
import { useSettingsStore } from "../../store/useSettingsStore";
import SectionLayout, { type SectionGroup } from "../layout/SectionLayout";
import PokemonView from "./PokemonView";

// The move tools load moves.json and learnsets.json, so they stay out of the way until opened
const MovesView = lazy(() => import("../attackdex/MovesView"));

const GROUPS: SectionGroup<PokedexSection>[] = [
  {
    label: "Pokémon",
    items: [
      {
        id: "pokemon",
        label: "Pokémon",
        Icon: BookOpen,
        description: "Stats, moves, evolutions and where to find each one",
      },
    ],
  },
  {
    label: "Moves",
    items: [
      { id: "moves", label: "Moves", Icon: Swords, description: "One move: what it does and who learns it" },
      {
        id: "combo",
        label: "Who learns a combo",
        Icon: Combine,
        description: "Pokémon that can learn every move you pick",
      },
      { id: "hm", label: "HM planner", Icon: Map, description: "Pokémon that can learn every HM you pick" },
    ],
  },
];

const MODE = { moves: "single", combo: "combo", hm: "hm-planner" } as const;

/** The Pokédex tab: each Pokémon, and the move tools (once the Attackdex tab). */
export default function PokedexTab({ allPokemon, meta }: { allPokemon: Pokemon[]; meta: MetaData }) {
  const section = useSettingsStore((s) => s.pokedexSection);
  const setSection = useSettingsStore((s) => s.setPokedexSection);

  // Keep each part mounted once it has been opened, so its search and scroll survive switching
  const onMoves = section !== "pokemon";
  const [movesOpened, setMovesOpened] = useState(onMoves);
  if (onMoves && !movesOpened) setMovesOpened(true);
  // While Pokémon is showing, the hidden move tool stays on the last one used
  const [moveSection, setMoveSection] = useState<Exclude<PokedexSection, "pokemon">>(onMoves ? section : "moves");
  if (onMoves && section !== moveSection) setMoveSection(section);

  return (
    <SectionLayout ariaLabel="Pokédex sections" groups={GROUPS} active={section} onSelect={setSection}>
      <div className={onMoves ? "hidden" : "flex flex-col flex-1 min-h-0"}>
        <PokemonView allPokemon={allPokemon} meta={meta} />
      </div>
      {movesOpened && (
        <div className={onMoves ? "flex flex-col flex-1 min-h-0" : "hidden"}>
          <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading…</div>}>
            <MovesView allPokemon={allPokemon} meta={meta} mode={MODE[moveSection]} />
          </Suspense>
        </div>
      )}
    </SectionLayout>
  );
}
