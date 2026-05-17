import { useState, useMemo } from "react";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useBattleCalcStore } from "../../store/useBattleCalcStore";
import type { Pokemon, MetaData } from "../../types";
import type { TrainerCategory, BattleTowerSet, PoolEntry, CalcPokemon } from "../../types/battleTower";
import Header from "../layout/Header";
import towerSets from "../../data/battle-tower-sets.json";
import towerTrainers from "../../data/battle-tower-trainers.json";
import { TRAINER_SPRITE_SLUGS } from "./trainerSprites";
import { TYPE_BG_COLORS } from "../../lib/type-colors";

const sets = towerSets as BattleTowerSet[];
const categories = towerTrainers as TrainerCategory[];

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

// Map a species name to its Pokédex ID for sprites
function getPokedexId(species: string, allPokemon: Pokemon[]): number | null {
  const lower = species.toLowerCase().replace(/[^a-z0-9]/g, "");
  const match = allPokemon.find((p) => {
    const name = p.displayName.toLowerCase().replace(/[^a-z0-9]/g, "");
    return name === lower;
  });
  return match?.id ?? null;
}

function expandPool(pool: PoolEntry[], allSets: BattleTowerSet[]): BattleTowerSet[] {
  const seen = new Set<number>();
  const result: BattleTowerSet[] = [];
  for (const entry of pool) {
    for (const setNum of entry.sets) {
      const found = allSets.find(
        (s) =>
          s.species.toLowerCase() === entry.species.toLowerCase() &&
          s.setNumber === setNum
      );
      if (found && !seen.has(found.id)) {
        seen.add(found.id);
        result.push(found);
      }
    }
  }
  return result;
}

function towerSetToCalcPokemon(set: BattleTowerSet, allPokemon: Pokemon[]): CalcPokemon {
  const pokemon = allPokemon.find(
    (p) => p.displayName.toLowerCase() === set.species.toLowerCase()
  );
  const types = pokemon?.types ?? ["normal"];

  const moves = set.moves.map((name) => ({
    name,
    power: 0,
    type: "normal",
    category: "special" as const,
  }));

  return {
    source: "tower-set",
    species: set.species,
    types: types as [string] | [string, string],
    level: 50,
    nature: set.nature,
    ability: "",
    item: set.item,
    status: "none",
    stats: set.stats,
    moves,
    currentHp: set.stats.hp,
  };
}

export default function TrainerLookupTab({ allPokemon }: Props) {
  const setActiveTab = useSettingsStore((s) => s.setActiveTab);
  const setSlot2 = useBattleCalcStore((s) => s.setSlot2);

  const [game, setGame] = useState<"platinum" | "hgss">("platinum");
  const [round, setRound] = useState<"open" | "super">("open");
  const [hgssTier, setHgssTier] = useState<number>(1);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedTrainerName, setSelectedTrainerName] = useState<string>("");

  // Filter categories by game + round (Platinum) or tier (HGSS)
  const filteredCategories = useMemo(() => {
    return categories.filter((cat) => {
      const gameMatch = cat.game === "both" || cat.game === game;
      if (!gameMatch) return false;
      if (game === "hgss") {
        return !cat.hgssTier || cat.hgssTier.includes(hgssTier);
      }
      return cat.round === "both" || cat.round === round;
    });
  }, [game, round, hgssTier]);

  // Collect all trainers from matching categories, deduplicate by name
  const allTrainers = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ class: string; gender: "M" | "F" | null; name: string; categoryId: string }> = [];
    for (const cat of filteredCategories) {
      for (const t of cat.trainers) {
        const key = `${t.class}|${t.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ ...t, categoryId: cat.id });
        }
      }
    }
    return result.sort((a, b) => a.class.localeCompare(b.class) || a.name.localeCompare(b.name));
  }, [filteredCategories]);

  // Unique trainer classes
  const trainerClasses = useMemo(() => {
    const classes = [...new Set(allTrainers.map((t) => t.class))].sort();
    return classes;
  }, [allTrainers]);

  // Trainers matching selected class
  const trainersForClass = useMemo(() => {
    if (!selectedClass) return [];
    return allTrainers.filter((t) => t.class === selectedClass);
  }, [allTrainers, selectedClass]);

  // Selected trainer info
  const selectedTrainer = useMemo(() => {
    return trainersForClass.find((t) => t.name === selectedTrainerName) ?? null;
  }, [trainersForClass, selectedTrainerName]);

  // Find the category for the selected trainer
  const trainerCategory = useMemo(() => {
    if (!selectedTrainer) return null;
    return filteredCategories.find((cat) =>
      cat.trainers.some((t) => t.class === selectedTrainer.class && t.name === selectedTrainer.name)
    ) ?? null;
  }, [selectedTrainer, filteredCategories]);

  // Expand the pool to BattleTowerSets
  const pokemonPool = useMemo(() => {
    if (!trainerCategory) return [];
    return expandPool(trainerCategory.pokemonPool, sets);
  }, [trainerCategory]);

  function handleLoadIntoCalc(set: BattleTowerSet) {
    const calcPokemon = towerSetToCalcPokemon(set, allPokemon);
    setSlot2(calcPokemon);
    setActiveTab("damage-calc");
  }

  function handleClassChange(cls: string) {
    setSelectedClass(cls);
    setSelectedTrainerName("");
  }

  const hasData = categories.length > 0;

  return (
    <div className="h-screen flex flex-col bg-gray-950 overflow-hidden">
      <Header />

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-screen-xl mx-auto w-full pb-[calc(52px+env(safe-area-inset-bottom,0px))] md:pb-4">
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-3">
            <span className="text-4xl">📊</span>
            <div className="text-center">
              <p className="text-gray-300 font-semibold mb-1">Battle Tower data not loaded yet</p>
              <p className="text-sm text-gray-500 mb-4">
                Download the CSVs from the Google Sheet and run the data script:
              </p>
              <ol className="text-xs text-gray-500 text-left space-y-1 list-decimal list-inside">
                <li>Open the Google Sheet → "Frontier Sets" tab → File › Download › CSV</li>
                <li>Save as <code className="text-gray-400">scripts/data/sets.csv</code></li>
                <li>Repeat for "Battle Frontier Trainers" tab → save as <code className="text-gray-400">scripts/data/trainers.csv</code></li>
                <li>Run <code className="text-gray-400">npm run fetch-battle-tower</code></li>
                <li>Rebuild: <code className="text-gray-400">npm run dev</code></li>
              </ol>
            </div>
          </div>
        ) : (
          <>
            {/* ── Filters ─────────────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-3 mb-5">
              {/* Game toggle */}
              <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                {(["platinum", "hgss"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => { setGame(g); setHgssTier(1); setRound("open"); setSelectedClass(""); setSelectedTrainerName(""); }}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                      game === g ? "bg-white text-gray-900" : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {g === "platinum" ? "Platinum" : "HeartGold / SoulSilver"}
                  </button>
                ))}
              </div>

              {/* Round toggle (Platinum) / Tier picker (HGSS) */}
              {game === "hgss" ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">Tier</span>
                  <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                    {[1,2,3,4,5,6,7,8].map((tier) => (
                      <button
                        key={tier}
                        onClick={() => { setHgssTier(tier); setSelectedClass(""); setSelectedTrainerName(""); }}
                        className={`w-7 h-7 rounded-md text-sm font-medium transition-all ${
                          hgssTier === tier ? "bg-white text-gray-900" : "text-gray-400 hover:text-gray-200"
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
                  {(["open", "super"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => { setRound(r); setSelectedClass(""); setSelectedTrainerName(""); }}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                        round === r ? "bg-white text-gray-900" : "text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {r === "open" ? "Open (1–49)" : "Super (50+)"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Trainer selectors ────────────────────────────────────────── */}
            <div className="flex flex-wrap gap-3 mb-5">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-400 font-medium">Trainer Class</label>
                <select
                  value={selectedClass}
                  onChange={(e) => handleClassChange(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 min-w-[180px] focus:outline-none focus:border-indigo-500"
                >
                  <option value="">— Select class —</option>
                  {trainerClasses.map((cls) => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>

              {selectedClass && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400 font-medium">Trainer Name</label>
                  <select
                    value={selectedTrainerName}
                    onChange={(e) => setSelectedTrainerName(e.target.value)}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 min-w-[160px] focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">— Select trainer —</option>
                    {trainersForClass.map((t) => (
                      <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* ── Trainer info card ────────────────────────────────────────── */}
            {selectedTrainer && trainerCategory && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-5 flex items-center gap-4">
                <TrainerSprite trainerClass={selectedTrainer.class} gender={selectedTrainer.gender} />
                <div>
                  <p className="text-white font-semibold text-lg">
                    {selectedTrainer.class} {selectedTrainer.name}
                  </p>
                  <p className="text-gray-400 text-sm mt-0.5">
                    IVs: all {trainerCategory.ivTier} ·{" "}
                    {pokemonPool.length} possible Pokémon
                  </p>
                  <p className="text-gray-500 text-xs mt-1 leading-relaxed max-w-prose">
                    {trainerCategory.description}
                  </p>
                </div>
              </div>
            )}

            {/* ── Pokémon pool grid ────────────────────────────────────────── */}
            {selectedTrainer && pokemonPool.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Possible Pokémon ({pokemonPool.length})
                </h3>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {pokemonPool.map((set) => (
                    <PokemonSetCard
                      key={set.id}
                      set={set}
                      allPokemon={allPokemon}
                      onLoad={() => handleLoadIntoCalc(set)}
                    />
                  ))}
                </div>
              </div>
            )}

            {selectedTrainer && pokemonPool.length === 0 && (
              <div className="text-gray-500 text-sm py-8 text-center">
                No Pokémon sets found for this trainer's pool.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Trainer Sprite ─────────────────────────────────────────────────────────────

function TrainerSprite({ trainerClass, gender }: { trainerClass: string; gender: "M" | "F" | null }) {
  const key = `${trainerClass}${gender ? ` ${gender}` : ""}`;
  const slug = TRAINER_SPRITE_SLUGS[key] ?? TRAINER_SPRITE_SLUGS[trainerClass];
  const [errored, setErrored] = useState(false);

  if (slug && !errored) {
    return (
      <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
        <img
          src={`https://play.pokemonshowdown.com/sprites/trainers/${slug}.png`}
          alt={trainerClass}
          className="w-16 h-16 object-contain"
          onError={() => setErrored(true)}
        />
      </div>
    );
  }

  return (
    <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center bg-gray-800 rounded-lg">
      <span className="text-2xl">👤</span>
    </div>
  );
}

// ── Pokémon Set Card ───────────────────────────────────────────────────────────

function PokemonSetCard({
  set,
  allPokemon,
  onLoad,
}: {
  set: BattleTowerSet;
  allPokemon: Pokemon[];
  onLoad: () => void;
}) {
  const dexId = getPokedexId(set.species, allPokemon);
  const spriteUrl = dexId
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexId}.png`
    : null;

  const pokemon = allPokemon.find(
    (p) => p.displayName.toLowerCase() === set.species.toLowerCase()
  );
  const types = pokemon?.types ?? [];

  const statKeys = [
    { key: "hp", label: "HP" },
    { key: "atk", label: "Atk" },
    { key: "def", label: "Def" },
    { key: "spa", label: "SpA" },
    { key: "spd", label: "SpD" },
    { key: "spe", label: "Spe" },
  ] as const;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col gap-2 hover:border-gray-700 transition-colors">
      {/* Header row */}
      <div className="flex items-center gap-2">
        {spriteUrl && (
          <img src={spriteUrl} alt={set.species} className="w-10 h-10 object-contain pixelated" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-white font-semibold text-sm">{set.species}</span>
            <span className="text-xs bg-indigo-900/60 text-indigo-300 border border-indigo-800 rounded px-1.5 py-0.5 font-mono">
              Set {set.setNumber}
            </span>
          </div>
          <div className="flex gap-1 mt-0.5">
            {types.map((t) => (
              <span key={t} className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_BG_COLORS[t] ?? "bg-gray-700 text-gray-200"}`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Nature + Item */}
      <div className="text-xs text-gray-400 space-y-0.5">
        <div><span className="text-gray-500">Nature:</span> {set.nature}</div>
        <div><span className="text-gray-500">Item:</span> {set.item}</div>
        <div><span className="text-gray-500">EVs:</span> {set.evSpread}</div>
      </div>

      {/* Moves */}
      <div className="grid grid-cols-2 gap-1">
        {set.moves.map((move, i) => (
          <div key={`${i}-${move}`} className="text-xs bg-gray-800 rounded px-2 py-1 text-gray-300 truncate">
            {move || "—"}
          </div>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-xs font-mono">
        {statKeys.map(({ key, label }) => (
          <div key={key} className="flex justify-between">
            <span className="text-gray-500">{label}</span>
            <span className="text-gray-200">{set.stats[key]}</span>
          </div>
        ))}
      </div>

      {/* Load button */}
      <button
        onClick={onLoad}
        className="mt-1 w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
      >
        Load into Calc →
      </button>
    </div>
  );
}
