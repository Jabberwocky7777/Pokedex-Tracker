import type { Pokemon } from "../../types";
import { getGenSprite } from "../../lib/pokemon-display";

interface PreNode {
  pokemon: Pokemon;
  methodTo: string;
}

interface PostNode {
  pokemon: Pokemon;
  method: string;
}

interface Props {
  pokemon: Pokemon;
  allPokemonMap: Map<number, Pokemon>;
  onSelect: (id: number) => void;
  activeGeneration: number;
}

function EvoPokemon({
  pokemon,
  isCurrent,
  onClick,
  activeGeneration,
}: {
  pokemon: Pokemon;
  isCurrent: boolean;
  onClick?: () => void;
  activeGeneration: number;
}) {
  const sprite = getGenSprite(pokemon, activeGeneration);
  const sizeClass = isCurrent ? "w-16 h-16" : "w-12 h-12";

  if (isCurrent) {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="p-1.5 rounded-xl ring-2 ring-indigo-500/60 bg-indigo-950/30">
          <img
            src={sprite}
            alt={pokemon.displayName}
            className={`${sizeClass} object-contain`}
            style={{ imageRendering: "pixelated" }}
          />
        </div>
        <span className="text-xs font-semibold text-gray-100 text-center leading-tight max-w-[72px]">
          {pokemon.displayName}
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 opacity-50 hover:opacity-90 transition-opacity cursor-pointer group"
    >
      <div className="p-1.5 rounded-xl group-hover:bg-gray-800 transition-colors">
        <img
          src={sprite}
          alt={pokemon.displayName}
          className={`${sizeClass} object-contain`}
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      <span className="text-xs text-gray-300 text-center leading-tight max-w-[64px] group-hover:text-indigo-400 transition-colors">
        {pokemon.displayName}
      </span>
    </button>
  );
}

function EvoArrow({ method }: { method: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5 px-1 shrink-0">
      <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
      <span className="text-[11px] text-gray-500 text-center leading-tight max-w-[64px] whitespace-pre-wrap">
        {method}
      </span>
    </div>
  );
}

export function EvolutionChain({ pokemon, allPokemonMap, onSelect, activeGeneration }: Props) {
  // Build pre-evolution chain (walk evolvesFrom upward)
  const preChain: PreNode[] = [];
  let cursor = pokemon;
  while (cursor.evolvesFrom != null) {
    const parent = allPokemonMap.get(cursor.evolvesFrom);
    if (!parent) break;
    const step = parent.evolvesTo.find((s) => s.speciesId === cursor.id);
    preChain.unshift({ pokemon: parent, methodTo: step?.details ?? "" });
    cursor = parent;
  }

  // Build post-evolutions (direct children)
  const postEvos: PostNode[] = pokemon.evolvesTo.flatMap((step) => {
    const child = allPokemonMap.get(step.speciesId);
    return child ? [{ pokemon: child, method: step.details }] : [];
  });

  // No family — don't render
  if (preChain.length === 0 && postEvos.length === 0) return null;

  return (
    <div className="flex items-center flex-wrap gap-y-3 pt-1">
      {/* Pre-evolution chain */}
      {preChain.map((node, i) => (
        <div key={node.pokemon.id} className="flex items-center">
          <EvoPokemon
            pokemon={node.pokemon}
            isCurrent={false}
            onClick={() => onSelect(node.pokemon.id)}
            activeGeneration={activeGeneration}
          />
          {/* Arrow from this pre-evo to the next stage */}
          <EvoArrow method={preChain[i + 1] ? preChain[i + 1].methodTo : node.methodTo} />
        </div>
      ))}

      {/* Current Pokémon */}
      <EvoPokemon pokemon={pokemon} isCurrent activeGeneration={activeGeneration} />

      {/* Post-evolutions */}
      {postEvos.length > 0 && (
        <div className="flex flex-col gap-2">
          {postEvos.map((node) => (
            <div key={node.pokemon.id} className="flex items-center">
              <EvoArrow method={node.method} />
              <EvoPokemon
                pokemon={node.pokemon}
                isCurrent={false}
                onClick={() => onSelect(node.pokemon.id)}
                activeGeneration={activeGeneration}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
