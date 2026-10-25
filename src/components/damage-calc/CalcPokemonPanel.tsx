import { MoveLink, PokemonLink } from "../shared/links";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { useBattleCalcStore } from "../../store/useBattleCalcStore";
import { useDesignerStore } from "../../store/useDesignerStore";
import { designerSlotToCalcPokemon } from "../../lib/calc-from-designer";
import { enrichCalcMoves } from "../../lib/move-lookup";
import { getItemEffect } from "../../lib/damage-calc";
import { speciesKey, towerSetToCalcPokemon } from "../../lib/calc-from-tower";
import rawTowerSets from "../../data/battle-tower-sets.json";
import type { Pokemon } from "../../types";
import type { CalcPokemon, DamageResult, StatusCondition, BattleTowerSet } from "../../types/battleTower";
import { TYPE_BG_COLORS } from "../../lib/type-colors";

// The data is in the game's order; the picker lists species alphabetically
const battleTowerSets = (rawTowerSets as BattleTowerSet[])
  .slice()
  .sort((a, b) => a.species.localeCompare(b.species) || a.setNumber - b.setNumber);

interface Props {
  slot: "slot1" | "slot2";
  allPokemon: Pokemon[];
  moveResults: DamageResult[];
  defenderHp: number;
  label: React.ReactNode;
}

const STATUS_OPTIONS: { value: StatusCondition; label: string }[] = [
  { value: "none",      label: "Healthy"   },
  { value: "burn",      label: "Burn"      },
  { value: "paralysis", label: "Paralysis" },
  { value: "poison",    label: "Poison"    },
  { value: "freeze",    label: "Freeze"    },
  { value: "sleep",     label: "Sleep"     },
];

const MOVE_LOOKUP_DELAY_MS = 400;

const STAT_LABELS: Record<string, string> = {
  hp: "HP", atk: "Atk", def: "Def", spa: "SpA", spd: "SpD", spe: "Spe",
};

export default function CalcPokemonPanel({ slot, allPokemon, moveResults, defenderHp, label }: Props) {
  const pokemon = useBattleCalcStore((s) => s[slot as "slot1" | "slot2"]);
  const opponent = useBattleCalcStore((s) => slot === "slot1" ? s.slot2 : s.slot1);
  const setter = useBattleCalcStore((s) => slot === "slot1" ? s.setSlot1 : s.setSlot2);
  const designerSlots = useDesignerStore((s) => s.slots);

  const [customQuery, setCustomQuery]   = useState("");
  const [showCustom, setShowCustom]     = useState(false);
  const [btQuery, setBtQuery]           = useState("");
  const [btOpen, setBtOpen]             = useState(false);
  const btPickerRef = useRef<HTMLDivElement>(null);
  const closeBtPicker = useCallback(() => setBtOpen(false), []);
  useDialogFocus(btPickerRef, btOpen, closeBtPicker);
  // The move names last looked up; until they match the current ones, a lookup is pending
  const [enrichedKey, setEnrichedKey] = useState<string | null>(null);

  // ── Designer options ───────────────────────────────────────────────────────
  const designerOptions = useMemo(
    () => designerSlots.filter((s) => s.pokemonId != null),
    [designerSlots]
  );

  // ── Battle Tower search ────────────────────────────────────────────────────
  const btResults = useMemo(() => {
    if (!btQuery.trim()) return battleTowerSets;
    const q = speciesKey(btQuery.trim());
    return battleTowerSets.filter((s) => speciesKey(s.species).includes(q));
  }, [btQuery]);

  // ── Custom species search ──────────────────────────────────────────────────
  const customResults = useMemo(() => {
    if (customQuery.length < 2) return [];
    const q = customQuery.toLowerCase();
    return allPokemon.filter((p) => p.displayName.toLowerCase().includes(q)).slice(0, 10);
  }, [customQuery, allPokemon]);

  // ── Auto-enrich: fetch move data when a pokemon is loaded with power=0 moves ──
  const moveNamesKey = pokemon?.moves.map((m) => m.name).join("|") ?? "";
  const needsEnrichment = pokemon?.moves.some((m) => m.name.trim() !== "" && m.power === 0) ?? false;
  const enrichingMoves = needsEnrichment && enrichedKey !== moveNamesKey;
  useEffect(() => {
    if (!pokemon || !needsEnrichment) return;

    let cancelled = false;

    // Wait for typing to pause, so half-typed names aren't each looked up
    const timer = setTimeout(() => {
      enrichCalcMoves([...pokemon.moves]).then((enrichedMoves) => {
        if (cancelled) return;
        // Read freshest store state so other edits made during the fetch aren't lost
        const fresh = useBattleCalcStore.getState()[slot as "slot1" | "slot2"];
        if (fresh) setter({ ...fresh, moves: enrichedMoves });
        setEnrichedKey(moveNamesKey);
      }).catch(() => { if (!cancelled) setEnrichedKey(moveNamesKey); });
    }, MOVE_LOOKUP_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveNamesKey]);

  // ── Item effect (for stat display) ────────────────────────────────────────
  const itemEff = useMemo(() => getItemEffect(pokemon?.item ?? "", pokemon?.species), [pokemon?.item, pokemon?.species]);

  // ── Loaders ───────────────────────────────────────────────────────────────
  function loadFromDesigner(slotIndex: number) {
    const ds = designerSlots[slotIndex];
    if (!ds) return;
    const calc = designerSlotToCalcPokemon(ds, allPokemon);
    if (calc) setter(calc);
  }

  function loadFromTowerSet(set: BattleTowerSet) {
    setter(towerSetToCalcPokemon(set, allPokemon));
    setBtOpen(false);
    setBtQuery("");
  }

  function loadCustomPokemon(p: Pokemon) {
    const bs = p.baseStats;
    if (!bs) return;
    const stats = {
      hp:  Math.floor(((2 * bs.hp + 31) * 50) / 100) + 60,
      atk: Math.floor(((2 * bs.atk + 31) * 50) / 100) + 5,
      def: Math.floor(((2 * bs.def + 31) * 50) / 100) + 5,
      spa: Math.floor(((2 * (bs.spAtk ?? 0) + 31) * 50) / 100) + 5,
      spd: Math.floor(((2 * (bs.spDef ?? 0) + 31) * 50) / 100) + 5,
      spe: Math.floor(((2 * bs.spe + 31) * 50) / 100) + 5,
    };
    const calc: CalcPokemon = {
      source: "custom",
      species: p.displayName,
      types: p.types as [string] | [string, string],
      level: 50,
      nature: "Hardy",
      ability: "",
      item: "",
      status: "none",
      stats,
      moves: [
        { name: "", power: 0, type: "normal", category: "physical" },
        { name: "", power: 0, type: "normal", category: "physical" },
        { name: "", power: 0, type: "normal", category: "physical" },
        { name: "", power: 0, type: "normal", category: "physical" },
      ],
      currentHp: stats.hp,
    };
    setter(calc);
    setShowCustom(false);
    setCustomQuery("");
  }

  function updateField(patch: Partial<CalcPokemon>) {
    if (!pokemon) return;
    setter({ ...pokemon, ...patch });
  }

  function updateMove(i: number, patch: Partial<CalcPokemon["moves"][0]>) {
    if (!pokemon) return;
    const moves = [...pokemon.moves];
    moves[i] = { ...moves[i], ...patch };
    setter({ ...pokemon, moves });
  }

  // A calc Pokémon only carries its species name; this finds the data entry behind it
  const speciesEntry = allPokemon.find(
    (p) => p.displayName.toLowerCase() === pokemon?.species.toLowerCase()
  ) ?? null;
  const spriteUrl = speciesEntry?.spriteUrl ?? null;

  // ── KO badge colour ───────────────────────────────────────────────────────
  function koColor(koChance: string) {
    if (koChance.includes("Guaranteed OHKO")) return "bg-red-900/60 text-red-300";
    if (koChance.includes("OHKO"))            return "bg-orange-900/60 text-orange-300";
    if (koChance.includes("Guaranteed 2HKO")) return "bg-amber-900/60 text-amber-300";
    if (koChance.includes("2HKO"))            return "bg-yellow-900/60 text-yellow-300";
    return "bg-gray-800 text-gray-500";
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-2 sm:p-4 space-y-3">
      {/* Section label */}
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</div>

      {/* ── Damage summary strip ── shown at the very top when we have results ─ */}
      {pokemon && opponent && moveResults.some((r) => r && r.max > 0) && (
        <div className="rounded-lg overflow-hidden border border-gray-700">
          <div className="bg-gray-800 px-3 py-1.5 text-xs text-gray-400 font-semibold flex items-center justify-between">
            <span>vs {opponent.species}</span>
            {enrichingMoves && (
              <span className="flex items-center gap-1 text-indigo-400">
                <Loader2 size={10} className="animate-spin" />
                Looking up moves…
              </span>
            )}
          </div>
          {(moveResults[0]?.hazardDamage > 0 || moveResults[0]?.residual > 0) && (
            <div className="px-3 py-1 text-[11px] text-gray-400 border-b border-gray-800/60">
              {[
                moveResults[0].hazardDamage > 0 ? `${opponent.species} loses ${moveResults[0].hazardDamage} HP to entry hazards` : "",
                moveResults[0].residual > 0 ? `${moveResults[0].residual} HP to the weather each turn` : "",
              ].filter(Boolean).join(" · ")}
            </div>
          )}
          <div className="divide-y divide-gray-800/60">
            {pokemon.moves.map((move, i) => {
              const r = moveResults[i];
              if (!r || r.max === 0 || !move.name.trim()) return null;
              return (
                <div key={`move-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-1.5 text-xs">
                  <span className="flex-1 text-gray-200 truncate min-w-0">
                    {move.notFound ? move.name : <MoveLink name={move.name}>{move.name}</MoveLink>}
                  </span>
                  <span className="text-emerald-400 font-mono whitespace-nowrap">
                    {r.minPercent.toFixed(1)}–{r.maxPercent.toFixed(1)}%
                  </span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${koColor(r.koChance)}`}>
                    {r.koChance}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Load controls ─────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex flex-col sm:flex-row gap-1.5">
          {/* Designer slots. Its own row on a phone, where the two panels sit side by side */}
          <select
            aria-label="Load from Designer"
            className="w-full sm:flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 min-h-[36px] text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
            value=""
            onChange={(e) => { if (e.target.value !== "") loadFromDesigner(parseInt(e.target.value)); }}
          >
            <option value="">From Designer…</option>
            {designerOptions.map((s) => {
              const p = allPokemon.find((ap) => ap.id === s.pokemonId);
              const lbl = s.nickname || p?.displayName || `Slot ${s.slotIndex + 1}`;
              return (
                <option key={s.slotIndex} value={s.slotIndex}>
                  {lbl} (slot {s.slotIndex + 1})
                </option>
              );
            })}
          </select>
          <button
            onClick={() => { setShowCustom((v) => !v); setBtOpen(false); }}
            aria-pressed={showCustom}
            className="px-2 py-1.5 min-h-[36px] text-xs bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors"
          >
            Custom
          </button>
        </div>

        {/* Battle Tower search */}
        <div className="relative">
          <button
            onClick={() => { setBtOpen((v) => !v); setShowCustom(false); }}
            className={`w-full text-left px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              btOpen
                ? "bg-indigo-900/30 border-indigo-600 text-indigo-300"
                : "bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
            }`}
          >
            {btOpen ? "▴ Battle Tower Sets" : "▾ Battle Tower Sets"}
          </button>

          {btOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setBtOpen(false)} />
              <div ref={btPickerRef} role="dialog" aria-label="Battle Tower sets" className="absolute top-full left-0 right-0 z-40 mt-0.5 bg-gray-850 border border-gray-700 rounded-lg shadow-2xl overflow-hidden"
                style={{ background: "#111827" }}>
                <input
                  type="text"
                  placeholder="Search species… (e.g. Rampardos)"
                  value={btQuery}
                  onChange={(e) => setBtQuery(e.target.value)}
                  className="w-full bg-gray-800 border-b border-gray-700 px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                  autoFocus
                />
                <div className="max-h-72 overflow-y-auto divide-y divide-gray-800/50">
                  {btResults.slice(0, 60).map((set) => (
                    <button
                      key={set.id}
                      onClick={() => loadFromTowerSet(set)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-700/60 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-gray-100">
                          {set.species}
                          <span className="ml-1.5 text-[11px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full font-normal">
                            #{set.setNumber}
                          </span>
                        </span>
                        <span className="text-[11px] text-gray-400 whitespace-nowrap shrink-0">
                          {set.nature} · {set.item}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                        {set.moves.join(" / ")}
                      </div>
                      <div className="text-[11px] text-gray-600 mt-0.5">
                        HP {set.stats.hp} · Atk {set.stats.atk} · Def {set.stats.def} · SpA {set.stats.spa} · SpD {set.stats.spd} · Spe {set.stats.spe}
                      </div>
                    </button>
                  ))}
                  {btResults.length === 0 && (
                    <div className="px-3 py-4 text-xs text-gray-500 text-center">No sets found</div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Custom species search */}
        {showCustom && (
          <div className="relative">
            <input
              type="text"
              placeholder="Search Pokémon…"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              className="w-full bg-gray-800 border border-indigo-700 rounded-lg px-2 py-1.5 text-xs text-gray-200 focus:outline-none"
              autoFocus
            />
            {customResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-20 mt-0.5 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {customResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => loadCustomPokemon(p)}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700 flex items-center gap-2"
                  >
                    <img src={p.spriteUrl} alt={p.displayName} className="w-6 h-6 object-contain pixelated" />
                    {p.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Pokémon info ───────────────────────────────────────────────────── */}
      {pokemon ? (
        <>
          {/* Species header */}
          <div className="flex items-center gap-3 bg-gray-800/50 rounded-lg p-2">
            {spriteUrl && (
              <img src={spriteUrl} alt={pokemon.species} className="w-12 h-12 object-contain pixelated" />
            )}
            <div>
              <div className="text-white font-semibold">
                {speciesEntry ? <PokemonLink id={speciesEntry.id}>{pokemon.species}</PokemonLink> : pokemon.species}
              </div>
              <div className="flex gap-1 mt-0.5 flex-wrap">
                {pokemon.types.map((t) => (
                  <span
                    key={t}
                    className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_BG_COLORS[t] ?? "bg-gray-700 text-gray-200"}`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Nature / Ability / Item / Status — 2×2 grid */}
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <div>
              <div className="text-gray-500 mb-0.5">Nature</div>
              <input
                type="text"
                value={pokemon.nature}
                onChange={(e) => updateField({ nature: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <div className="text-gray-500 mb-0.5">Ability</div>
              <input
                type="text"
                value={pokemon.ability}
                onChange={(e) => updateField({ ability: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-indigo-500"
                placeholder="(none)"
              />
            </div>
            <div>
              <div className="text-gray-500 mb-0.5">Item</div>
              <input
                type="text"
                value={pokemon.item}
                onChange={(e) => updateField({ item: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-indigo-500"
                placeholder="(none)"
              />
              {itemEff.label && (
                <div className="text-[11px] text-amber-400 mt-0.5">{itemEff.label}</div>
              )}
            </div>
            <div>
              <div className="text-gray-500 mb-0.5">Status</div>
              <select
                value={pokemon.status}
                onChange={(e) => updateField({ status: e.target.value as StatusCondition })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-indigo-500"
              >
                {STATUS_OPTIONS.map(({ value, label: lbl }) => (
                  <option key={value} value={value}>{lbl}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stats table — shows effective stat when item boosts it */}
          <div>
            <div className="text-xs text-gray-500 mb-1">Stats (Lv {pokemon.level})</div>
            <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-xs font-mono">
              {(Object.keys(STAT_LABELS) as Array<keyof typeof pokemon.stats>).map((key) => {
                const base = pokemon.stats[key];
                const isAtk = key === "atk" && !!itemEff.atkStatMult;
                const isSpa = key === "spa" && !!itemEff.spaStatMult;
                const mult = isAtk ? itemEff.atkStatMult! : isSpa ? itemEff.spaStatMult! : null;
                const effective = mult ? Math.floor(base * mult) : null;
                return (
                  <div key={key} className="flex justify-between items-center">
                    <span className="text-gray-500">{STAT_LABELS[key]}</span>
                    <span className="text-gray-200 flex items-center gap-1">
                      {effective ? (
                        <>
                          <span className="line-through text-gray-600">{base}</span>
                          <span className="text-amber-400">{effective}</span>
                        </>
                      ) : (
                        base
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Current HP slider */}
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                <span>Current HP</span>
                <span>{pokemon.currentHp} / {pokemon.stats.hp}</span>
              </div>
              <input
                type="range"
                min={1}
                max={pokemon.stats.hp}
                value={pokemon.currentHp}
                onChange={(e) => updateField({ currentHp: parseInt(e.target.value) })}
                className="w-full accent-indigo-500"
              />
              <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden mt-0.5">
                <div
                  className={`h-full rounded-full transition-all ${
                    pokemon.currentHp / pokemon.stats.hp > 0.5
                      ? "bg-emerald-500"
                      : pokemon.currentHp / pokemon.stats.hp > 0.25
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                  style={{ width: `${(pokemon.currentHp / pokemon.stats.hp) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* ── Moves section ──────────────────────────────────────────────── */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Moves</span>
              {enrichingMoves && (
                <span className="flex items-center gap-1 text-[11px] text-indigo-400">
                  <Loader2 size={9} className="animate-spin" />
                  Looking up move data…
                </span>
              )}
            </div>

            {pokemon.moves.map((move, i) => {
              const result = moveResults[i];
              const hasResult = result && result.max > 0;
              return (
                <div key={`move-${i}`} className="bg-gray-800/50 rounded-lg p-2 space-y-1">
                  {/* Row 1: move name + category */}
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={move.name}
                      onChange={(e) => updateMove(i, { name: e.target.value, power: 0, notFound: false })}
                      placeholder={`Move ${i + 1}`}
                      className="flex-1 min-w-0 bg-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <select
                      value={move.category}
                      onChange={(e) =>
                        updateMove(i, { category: e.target.value as "physical" | "special" | "status" })
                      }
                      className="bg-gray-700 rounded px-1 py-1 text-xs text-gray-200 focus:outline-none"
                    >
                      <option value="physical">Phys</option>
                      <option value="special">Spec</option>
                      <option value="status">Status</option>
                    </select>
                  </div>

                  {/* Row 2: power + type + damage range */}
                  <div className="flex flex-wrap gap-1 items-center">
                    <input
                      type="number"
                      min={0}
                      max={250}
                      value={move.power}
                      onChange={(e) => updateMove(i, { power: parseInt(e.target.value) || 0 })}
                      className="w-14 bg-gray-700 rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none"
                      placeholder="BP"
                    />
                    <input
                      type="text"
                      value={move.type}
                      onChange={(e) => updateMove(i, { type: e.target.value.toLowerCase() })}
                      placeholder="type"
                      className="w-20 bg-gray-700 rounded px-2 py-0.5 text-xs text-gray-200 focus:outline-none"
                    />
                    {defenderHp > 0 && hasResult && (
                      <div className="flex-1 text-right">
                        <span className="text-emerald-400 font-mono text-xs font-semibold">
                          {result.min}–{result.max}
                        </span>
                        <span className="text-gray-500 text-xs ml-1">
                          ({result.minPercent.toFixed(1)}–{result.maxPercent.toFixed(1)}%)
                        </span>
                      </div>
                    )}
                  </div>

                  {move.notFound && move.name.trim() !== "" && !enrichingMoves && (
                    <div className="text-[11px] text-amber-400">
                      Move not found — check the spelling, or enter its power and type yourself.
                    </div>
                  )}

                  {/* Row 3: KO chance */}
                  {defenderHp > 0 && hasResult && (
                    <div className={`text-[11px] px-1.5 py-0.5 rounded inline-block font-medium ${koColor(result.koChance)}`}>
                      {result.koChance}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-gray-600 gap-2">
          <span className="text-4xl">?</span>
          <span className="text-sm">No Pokémon loaded</span>
          <span className="text-xs text-gray-700">
            Load from Designer, Battle Tower, or search Custom
          </span>
        </div>
      )}
    </div>
  );
}
