import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { GameVersion, Pokemon } from "../../types";
import { GAME_LABELS } from "../../types";
import type { WorkLink } from "../../store/useWorkingOnStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { encounterAreas, normalizePlace } from "../../lib/location-links";
import { areaDisplayName } from "../../lib/area-names";
import { generationVersions } from "../../lib/generation";
import SegmentedControl from "../shared/SegmentedControl";
import PokemonPicker from "../shared/PokemonPicker";
import { GameChip } from "../shared/GameChip";

interface Props {
  allPokemon: Pokemon[];
  onPick: (link: WorkLink) => void;
  onClose: () => void;
}

type Kind = WorkLink["kind"];

/** Picks what a "Working on" item points at: a Pokémon, a route or a game. */
export default function LinkPicker({ allPokemon, onPick, onClose }: Props) {
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const [kind, setKind] = useState<Kind>("pokemon");
  const [pickingPokemon, setPickingPokemon] = useState(false);
  const [query, setQuery] = useState("");

  const areas = useMemo(() => encounterAreas(allPokemon), [allPokemon]);
  const matches = useMemo(() => {
    const q = normalizePlace(query);
    if (!q) return [];
    return areas.filter((a) => a.key.includes(q)).slice(0, 8);
  }, [areas, query]);
  const games = [...generationVersions(3), ...generationVersions(4)] as GameVersion[];

  return (
    <div className="flex flex-col gap-3 p-3 rounded-xl bg-gray-900 border border-gray-800">
      <div className="flex items-center justify-between gap-2">
        <SegmentedControl
          ariaLabel="Link to"
          size="sm"
          value={kind}
          onChange={setKind}
          options={[{ value: "pokemon", label: "Pokémon" }, { value: "route", label: "Route" }, { value: "game", label: "Game" }]}
        />
        <button onClick={onClose} aria-label="Close" className="p-2 rounded-md text-gray-400 hover:text-gray-100 hover:bg-gray-800">
          <X size={16} />
        </button>
      </div>

      {kind === "pokemon" && (
        <button
          onClick={() => setPickingPokemon(true)}
          className="self-start px-3 py-2 min-h-[40px] rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200"
        >
          Choose a Pokémon…
        </button>
      )}

      {kind === "route" && (
        <div className="flex flex-col gap-1.5">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search routes and areas…"
            aria-label="Search routes and areas"
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          {matches.map((area) => (
            <button
              key={area.slug}
              onClick={() => onPick({ kind: "route", slug: area.slug, name: areaDisplayName(area.name) })}
              className="text-left px-3 py-2 rounded-lg text-sm text-gray-200 hover:bg-gray-800"
            >
              {areaDisplayName(area.name)}
            </button>
          ))}
        </div>
      )}

      {kind === "game" && (
        <div className="flex flex-wrap gap-1.5">
          {games.map((game) => (
            <GameChip key={game} game={game} size="sm" selected={false} onClick={() => onPick({ kind: "game", game })}>
              {GAME_LABELS[game]}
            </GameChip>
          ))}
        </div>
      )}

      {pickingPokemon && (
        <PokemonPicker
          allPokemon={allPokemon}
          activeGeneration={activeGeneration}
          title="Link a Pokémon"
          onSelect={(id) => { setPickingPokemon(false); onPick({ kind: "pokemon", id, generation: activeGeneration }); }}
          onClose={() => setPickingPokemon(false)}
        />
      )}
    </div>
  );
}
