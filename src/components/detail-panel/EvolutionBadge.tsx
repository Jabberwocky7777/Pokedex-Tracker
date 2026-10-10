import type { Pokemon } from "../../types";

interface Props {
  pokemon: Pokemon;
  allPokemon: Map<number, Pokemon>;
  /** Highest National Dex number in the active generation — later species are left out */
  maxId: number;
}

export default function EvolutionBadge({ pokemon, allPokemon, maxId }: Props) {
  const chain = buildChain(pokemon, allPokemon, maxId);
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
                src={node.spriteUrl}
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
  spriteUrl: string;
  evolutionDetails: string; // how it evolved from previous
}

const MAX_STAGES = 8;

/**
 * The line that leads to this Pokémon, then what it evolves into: every branch
 * when there are several (Eevee), and on down the line when there is one.
 */
function buildChain(current: Pokemon, allPokemon: Map<number, Pokemon>, maxId: number): ChainNode[] {
  const lineage = [current];
  while (lineage[0].evolvesFrom !== null && lineage.length < MAX_STAGES) {
    const parent = allPokemon.get(lineage[0].evolvesFrom);
    if (!parent || parent.id > maxId) break;
    lineage.unshift(parent);
  }

  const chain: ChainNode[] = lineage.map((p, i) => ({
    id: p.id,
    displayName: p.displayName,
    spriteUrl: p.spriteUrl,
    evolutionDetails: i === 0 ? "" : lineage[i - 1].evolvesTo.find((s) => s.speciesId === p.id)?.details ?? "",
  }));

  let stage = current;
  for (let guard = 0; guard < MAX_STAGES; guard++) {
    const next = stage.evolvesTo.flatMap((step) => {
      const child = allPokemon.get(step.speciesId);
      return child && child.id <= maxId ? [{ child, details: step.details }] : [];
    });
    for (const { child, details } of next) {
      chain.push({ id: child.id, displayName: child.displayName, spriteUrl: child.spriteUrl, evolutionDetails: details });
    }
    if (next.length !== 1) break;
    stage = next[0].child;
  }
  return chain;
}
