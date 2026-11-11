import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { GameVersion, MetaData, Pokemon } from "../../types";
import type { SaveProfile, SaveSummary } from "../../lib/save/types";
import { decodeDex } from "../../lib/save/pokedex";
import { PokemonLink } from "../shared/links";

interface Props {
  game: GameVersion;
  profile: SaveProfile;
  summary: SaveSummary;
  allPokemon: Pokemon[];
  meta: MetaData;
  nameOf: Map<number, string>;
}

/**
 * A Game progress card's line about the save's own Pokédex (Gen IV): how much
 * of the regional dex has been seen — which is what unlocks the National
 * Pokédex in Sinnoh — what is still to see, and species the game says were
 * caught but that are in none of this save's boxes (released or traded away).
 */
export default function SavePokedex({ game, profile, summary, allPokemon, meta, nameOf }: Props) {
  const data = useMemo(() => {
    if (!summary.pokedex) return null;
    const caught = decodeDex(summary.pokedex.caught);
    const seen = new Set(decodeDex(summary.pokedex.seen));
    const regional = meta.regionalDexes.find((d) => d.games.includes(game));
    const regionalIds = regional
      ? allPokemon.filter((p) => p.regionalDexEntries?.some((e) => e.dexId === regional.id)).map((p) => p.id)
      : [];
    const held = new Set(summary.mons.filter((m) => m[6] !== 1).map((m) => m[2]));
    return {
      caught: caught.length,
      seen: seen.size,
      regional,
      regionalSeen: regionalIds.filter((id) => seen.has(id)).length,
      toSee: regionalIds.filter((id) => !seen.has(id)),
      gone: caught.filter((id) => !held.has(id)),
    };
  }, [summary, game, meta, allPokemon]);
  if (!data) return null;

  return (
    <div className="flex flex-col gap-0.5 text-xs text-gray-400" title={`From ${profile.label}`}>
      <p>
        Pokédex in the save: <span className="text-gray-200 tabular-nums">{data.seen}</span> seen,{" "}
        <span className="text-gray-200 tabular-nums">{data.caught}</span> caught
        {data.regional && (
          <>
            {" "}
            · {data.regional.name}:{" "}
            <span className="text-gray-200 tabular-nums">
              {data.regionalSeen}/{data.regional.size}
            </span>{" "}
            seen
          </>
        )}
      </p>
      {data.regional && data.toSee.length > 0 && (
        <Names
          ids={data.toSee}
          nameOf={nameOf}
          label={`Still to see in the ${data.regional.name}: ${data.toSee.length}`}
        />
      )}
      {data.gone.length > 0 && (
        <Names
          ids={data.gone}
          nameOf={nameOf}
          label={`Caught in this game but not in its boxes now: ${data.gone.length}`}
        />
      )}
    </div>
  );
}

function Names({ ids, nameOf, label }: { ids: number[]; nameOf: Map<number, string>; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-1 text-indigo-300 hover:text-indigo-200 text-left min-h-[32px]"
      >
        <ChevronDown
          size={12}
          className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
        {label}
      </button>
      {open && (
        <p className="text-gray-300 leading-relaxed">
          {ids.map((id, i) => (
            <span key={id}>
              {i > 0 && ", "}
              <PokemonLink id={id} to="tracker">
                {nameOf.get(id) ?? `#${id}`}
              </PokemonLink>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
