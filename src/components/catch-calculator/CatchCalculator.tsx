import { useState, useMemo } from "react";
import {
  calcCatchRate,
  getDynamicBallBonus,
  BALLS,
  STATUS_CONDITIONS,
  type BallId,
  type DynamicBallId,
  type StatusId,
} from "../../lib/catch-rate";
import type { Pokemon, MetaData } from "../../types";
import Header from "../layout/Header";
import { useSettingsStore } from "../../store/useSettingsStore";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

export default function CatchCalculator({ allPokemon, meta }: Props) {
  const { activeGeneration } = useSettingsStore();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const [level, setLevel] = useState(5);
  const [hpPercent, setHpPercent] = useState(100);
  const [ballId, setBallId] = useState<BallId>("poke");
  const [statusId, setStatusId] = useState<StatusId>("none");
  const [turns, setTurns] = useState(1);
  const [leadLevel, setLeadLevel] = useState(50);

  const selectedPokemon = selectedId ? allPokemon.find((p) => p.id === selectedId) : null;

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allPokemon
      .filter((p) => p.displayName.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, allPokemon]);

  // Compute HP from base stat
  const baseHP = selectedPokemon?.baseStats.hp ?? 45;
  const maxHP = Math.floor((2 * baseHP + 15 + Math.floor(50 / 4)) * level / 100) + level + 10;
  const currentHP = Math.max(1, Math.round(maxHP * (hpPercent / 100)));

  // Ball bonus
  const ball = BALLS.find((b) => b.id === ballId)!;
  const ballBonus =
    ball.bonus !== null
      ? ball.bonus
      : getDynamicBallBonus(ballId as DynamicBallId, {
          turns,
          targetLevel: level,
          leadLevel,
          targetTypes: selectedPokemon?.types,
        });

  const statusMult = STATUS_CONDITIONS.find((s) => s.id === statusId)?.multiplier ?? 1;
  const catchRate = selectedPokemon?.catchRate ?? 45;

  const result = useMemo(() => {
    if (ballId === "master") {
      return { a: 255, b: 65535, guaranteed: true, shakeChance: 1, catchChance: 1 };
    }
    return calcCatchRate({ catchRate, maxHP, currentHP, ballBonus, statusMultiplier: statusMult });
  }, [catchRate, maxHP, currentHP, ballBonus, statusMult, ballId]);

  const pct = (result.catchChance * 100).toFixed(2);
  const pctNum = result.catchChance * 100;

  const pctColor =
    pctNum >= 50 ? "text-green-400" : pctNum >= 20 ? "text-yellow-400" : "text-red-400";

  const needsTurns = ballId === "timer";
  const needsLead = ballId === "level";

  return (
    <div className="flex flex-col h-full">
      <Header meta={meta} caught={0} total={0} percentage={0} />

      <main className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Catch Rate Calculator</h2>
          <p className="text-sm text-gray-400">
            Gen III / IV formula — uses 4 shake checks. Same formula for R/S/E/FR/LG and D/P/Pt/HG/SS.
          </p>
        </div>

        {/* Pokémon selector */}
        <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-3">
          <label className="text-sm font-medium text-gray-300">Pokémon</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by name…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            {showDropdown && suggestions.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
                {suggestions.map((p) => {
                  const sprite = (activeGeneration === 4 ? p.gen4Sprite : p.gen3Sprite) || p.spriteUrl;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedId(p.id);
                        setQuery(p.displayName);
                        setShowDropdown(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700 text-left"
                    >
                      <img src={sprite} alt={p.displayName} className="w-8 h-8 object-contain" style={{ imageRendering: "pixelated" }} />
                      <span className="text-sm text-gray-200 flex-1">{p.displayName}</span>
                      <span className="text-xs text-gray-500">Catch rate: {p.catchRate}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedPokemon && (
            <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
              <img
                src={(activeGeneration === 4 ? selectedPokemon.gen4Sprite : selectedPokemon.gen3Sprite) || selectedPokemon.spriteUrl}
                alt={selectedPokemon.displayName}
                className="w-12 h-12 object-contain"
                style={{ imageRendering: "pixelated" }}
              />
              <div>
                <div className="font-semibold text-white">{selectedPokemon.displayName}</div>
                <div className="text-xs text-gray-400">
                  Catch Rate: <span className="text-gray-200">{selectedPokemon.catchRate}</span>
                  {" · "}Base HP: <span className="text-gray-200">{selectedPokemon.baseStats.hp}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Inputs */}
        <div className="bg-gray-900 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Level */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Target Level</label>
            <input
              type="number"
              min={1}
              max={100}
              value={level}
              onChange={(e) => setLevel(Math.max(1, Math.min(100, Number(e.target.value))))}
              className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* HP % — Gen III battle-screen style */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-gray-300">Current HP</label>

            {/* Battle status box */}
            <div
              className="relative rounded-sm select-none"
              style={{
                background: "#1c1c1c",
                border: "2px solid #505050",
                padding: "8px 12px 6px",
              }}
            >
              {/* Name + Level row */}
              <div className="flex items-baseline justify-between mb-2">
                <span
                  className="text-xs font-bold tracking-widest"
                  style={{ color: "#f0f0f0", fontFamily: "monospace", textTransform: "uppercase" }}
                >
                  {selectedPokemon?.displayName ?? "POKéMON"}
                </span>
                <span className="text-xs font-mono" style={{ color: "#d8d8d8" }}>
                  Lv{level}
                </span>
              </div>

              {/* HP label + bar */}
              <div className="flex items-center gap-2">
                <span
                  className="shrink-0 font-bold"
                  style={{ fontSize: 9, color: "#e8e8e8", fontFamily: "monospace", width: 16 }}
                >
                  HP
                </span>

                {/* Bar — range input overlaid for drag interaction */}
                <div className="relative flex-1" style={{ height: 10 }}>
                  {/* Trough border */}
                  <div
                    className="absolute inset-0"
                    style={{ border: "2px solid #484848", background: "#080808" }}
                  />
                  {/* Coloured fill */}
                  <div
                    className="absolute top-0 left-0 h-full"
                    style={{
                      width: `${hpPercent}%`,
                      background:
                        hpPercent > 50 ? "#50c840"
                        : hpPercent > 20 ? "#f8c820"
                        : "#e02020",
                      transition: "width 60ms linear, background 200ms",
                    }}
                  />
                  {/* Invisible drag handle */}
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={hpPercent}
                    onChange={(e) => setHpPercent(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                    style={{ margin: 0 }}
                  />
                </div>
              </div>

              {/* HP numbers */}
              <div className="flex justify-end mt-1" style={{ fontFamily: "monospace", fontSize: 9, color: "#d0d0d0" }}>
                {String(currentHP).padStart(3, "\u00a0")}/{String(maxHP).padStart(3, "\u00a0")}
              </div>
            </div>

            <div className="text-xs text-gray-500 text-right font-mono">{hpPercent}%</div>
          </div>

          {/* Ball */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Poké Ball</label>
            <select
              value={ballId}
              onChange={(e) => setBallId(e.target.value as BallId)}
              className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
            >
              {BALLS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}{b.note ? ` (${b.note})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-300">Status Condition</label>
            <select
              value={statusId}
              onChange={(e) => setStatusId(e.target.value as StatusId)}
              className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
            >
              {STATUS_CONDITIONS.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.multiplier}×)</option>
              ))}
            </select>
          </div>

          {/* Timer Ball turns */}
          {needsTurns && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-gray-300">
                Turns elapsed: {turns} → bonus {Math.min(4, 1 + turns / 10).toFixed(2)}×
              </label>
              <input
                type="range"
                min={1}
                max={50}
                value={turns}
                onChange={(e) => setTurns(Number(e.target.value))}
                className="accent-indigo-500"
              />
            </div>
          )}

          {/* Level Ball lead level */}
          {needsLead && (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-sm font-medium text-gray-300">Your lead Pokémon's level</label>
              <input
                type="number"
                min={1}
                max={100}
                value={leadLevel}
                onChange={(e) => setLeadLevel(Math.max(1, Math.min(100, Number(e.target.value))))}
                className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Result */}
        <div className="bg-gray-900 rounded-xl p-6 flex flex-col items-center gap-4">
          <div className={`text-6xl font-bold tabular-nums ${pctColor}`}>
            {result.guaranteed ? "100" : pct}%
          </div>
          <div className="text-sm text-gray-400">catch probability</div>

          {result.guaranteed ? (
            <div className="text-sm text-green-400 font-medium">Guaranteed catch ✓</div>
          ) : (
            <div className="w-full">
              <div className="text-xs text-gray-500 mb-2 text-center">Shake check probability (need all 4)</div>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4].map((n) => {
                  const prob = Math.pow(result.shakeChance, n) * 100;
                  const color = prob >= 50 ? "bg-green-600" : prob >= 20 ? "bg-yellow-600" : "bg-red-700";
                  return (
                    <div key={n} className="flex flex-col items-center gap-1">
                      <div className={`w-14 h-14 rounded-full ${color} flex items-center justify-center text-white text-sm font-bold`}>
                        {prob.toFixed(0)}%
                      </div>
                      <span className="text-xs text-gray-500">{n} shake{n > 1 ? "s" : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Debug info */}
          <div className="text-xs text-gray-600 text-center mt-2 font-mono">
            a = {result.a} · b = {result.b} · ball {ballBonus.toFixed(2)}× · status {statusMult}×
          </div>
        </div>

        {/* Formula note */}
        <div className="text-xs text-gray-500 bg-gray-900/50 rounded-lg p-3">
          <span className="font-semibold text-gray-400">Gen III/IV Formula: </span>
          a = ⌊(3M − 2H) × C × B × S / (3M)⌋, then b = ⌊65536 / ⁴√(255/a)⌋.
          Catch succeeds if 4 random integers (0–65535) are each &lt; b.
          HP is estimated from base stat at the given level with 15 IVs and 50 EVs.
        </div>
      </div>
      </main>
    </div>
  );
}
