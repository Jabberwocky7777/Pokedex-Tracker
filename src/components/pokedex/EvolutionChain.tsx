import type { Pokemon } from "../../types";
import { getGenSprite } from "../../lib/pokemon-display";

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

/** One stage and, to its right, each thing it evolves into (a column when it branches) */
function EvoNode({ node, current, allPokemonMap, onSelect, activeGeneration, seen }: {
  node: Pokemon;
  current: Pokemon;
  allPokemonMap: Map<number, Pokemon>;
  onSelect: (id: number) => void;
  activeGeneration: number;
  seen: ReadonlySet<number>;
}) {
  const children = node.evolvesTo.flatMap((step) => {
    const child = allPokemonMap.get(step.speciesId);
    return child && !seen.has(child.id) ? [{ pokemon: child, method: step.details }] : [];
  });
  const next = new Set(seen).add(node.id);
  return (
    <div className="flex items-center shrink-0">
      <EvoPokemon
        pokemon={node}
        isCurrent={node.id === current.id}
        onClick={() => onSelect(node.id)}
        activeGeneration={activeGeneration}
      />
      {children.length > 0 && (
        <div className="flex flex-col gap-2">
          {children.map((child) => (
            <div key={child.pokemon.id} className="flex items-center">
              <EvoArrow method={child.method} />
              <EvoNode
                node={child.pokemon}
                current={current}
                allPokemonMap={allPokemonMap}
                onSelect={onSelect}
                activeGeneration={activeGeneration}
                seen={next}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The whole evolution family, from its first stage, with every branch (Oddish shows Vileplume and Bellossom) */
export function EvolutionChain({ pokemon, allPokemonMap, onSelect, activeGeneration }: Props) {
  // Walk up to the first stage
  let root = pokemon;
  const visited = new Set<number>([root.id]);
  while (root.evolvesFrom != null) {
    const parent = allPokemonMap.get(root.evolvesFrom);
    if (!parent || visited.has(parent.id)) break;
    visited.add(parent.id);
    root = parent;
  }

  // No family — don't render
  if (root.id === pokemon.id && pokemon.evolvesTo.every((s) => !allPokemonMap.has(s.speciesId))) return null;

  return (
    <div className="overflow-x-auto pt-1 pb-1">
      <EvoNode
        node={root}
        current={pokemon}
        allPokemonMap={allPokemonMap}
        onSelect={onSelect}
        activeGeneration={activeGeneration}
        seen={new Set()}
      />
    </div>
  );
}
