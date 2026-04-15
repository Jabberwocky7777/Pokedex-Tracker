import type { Pokemon, EvolutionStep } from "../../types";

interface Props {
  pokemon: Pokemon;
  allPokemon: Map<number, Pokemon>;
}

export default function EvolutionBadge({ pokemon, allPokemon }: Props) {
  // Build the full evolution chain from this pokemon's data
  const chain = buildChain(pokemon, allPokemon);
  if (chain.length <= 1) return null;

  return (
    <div className="bg-gray-800/50 rounded-lg p-3">
      <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">Evolution Chain</div>
      <div className="flex items-center flex-wrap gap-1">
        {chain.map((node, i) => (
          <div key={node.id} className="flex items-center gap-1">
            {i > 0 && (
              <div className="flex flex-col items-center px-1">
                <span className="text-gray-500 text-xs">→</span>
                <span className="text-gray-400 text-xs leading-tight text-center">{node.evolutionDetails}</span>
              </div>
            )}
            <div className={`flex flex-col items-center ${node.id === pokemon.id ? "opacity-100" : "opacity-70"}`}>
              <img
                src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${node.id}.png`}
                alt={node.displayName}
                className="w-10 h-10 object-contain"
                style={{ imageRendering: "pixelated" }}
              />
              <span className={`text-xs text-center leading-tight mt-0.5 ${
                node.id === pokemon.id ? "text-white font-medium" : "text-gray-400"
              }`}>
                {node.displayName}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ChainNode {
  id: number;
  displayName: string;
  evolutionDetails: string; // how it evolved from previous
}

function buildChain(current: Pokemon, allPokemon: Map<number, Pokemon>): ChainNode[] {
  // Walk up to find the root of the chain
  const upVisited = new Set<number>();
  let root = current;

  while (root.evolvesFrom !== null && !upVisited.has(root.id)) {
    upVisited.add(root.id);
    const parent = allPokemon.get(root.evolvesFrom);
    if (!parent) break;
    root = parent;
  }

  // Now walk down from root to build chain (fresh visited set so walk-up IDs don't block walk-down)
  const chain: ChainNode[] = [];
  buildDownChain(root, allPokemon, chain, null, new Set<number>());
  return chain;
}

function buildDownChain(
  pokemon: Pokemon,
  allPokemon: Map<number, Pokemon>,
  chain: ChainNode[],
  evolutionDetails: string | null,
  visited: Set<number>
): void {
  if (visited.has(pokemon.id) && chain.length > 0) return;

  chain.push({
    id: pokemon.id,
    displayName: pokemon.displayName,
    evolutionDetails: evolutionDetails ?? "",
  });

  for (const step of pokemon.evolvesTo as EvolutionStep[]) {
    const child = allPokemon.get(step.speciesId);
    if (child && !visited.has(child.id)) {
      // Only follow the main path, skip branches for now (e.g., Eevee evolutions)
      // We detect branching by checking if this pokemon evolves into multiple things
      if (pokemon.evolvesTo.length > 1) {
        // For branch evolutions, only show the branch that leads to current pokemon
        // or show all if this IS the current pokemon
        chain.push({
          id: step.speciesId,
          displayName: step.displayName,
          evolutionDetails: step.details,
        });
        // Don't recurse into branches
      } else {
        buildDownChain(child, allPokemon, chain, step.details, visited);
      }
    }
  }
}
