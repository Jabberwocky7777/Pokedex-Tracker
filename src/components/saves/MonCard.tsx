import type { Pokemon } from "../../types";
import TypeBadge from "../shared/TypeBadge";
import { useState } from "react";
import { calcHPStat, calcStat, calculateHiddenPower, getNatureMultiplier, NATURES, STAT_KEYS, STAT_LABELS } from "../../lib/iv-calc";
import { monToDesignerPatch } from "../../lib/save/battle";
import { designerSlotToCalcPokemon } from "../../lib/calc-from-designer";
import { useDesignerStore } from "../../store/useDesignerStore";
import { useBattleCalcStore } from "../../store/useBattleCalcStore";
import { formatDexNumber } from "../../lib/pokemon-display";
import { formName } from "../../lib/save/forms";
import { speciesForSlot, type SaveAnalysis } from "../../lib/save/living-dex";
import { evolutionChecks, type EvolveStatus } from "../../lib/save/evolve";
import { ORIGIN_BADGES, originBadges } from "../../lib/save/origin";
import { abilityName, ballName, heldItemName, metLocationName, moveName, originGameName } from "../../lib/save/tables";
import { PARTY_BOX, genConfigOf, type ProfileMons, type SaveMon, type SlimMon } from "../../lib/save/types";
import { monSprite, slotLabel } from "./saveDisplay";
import { openPokedex, openTab } from "../../lib/navigate";
import { MoveLink, PokemonLink } from "../shared/links";

interface Props {
  /** Always available — comes from the synced summary */
  mon: SlimMon;
  /** Only on the device that imported the save */
  full?: SaveMon;
  pokemon: Pokemon;
  pokemonMap: Map<number, Pokemon>;
  profile: ProfileMons;
  analysis: SaveAnalysis;
  /** Set on a placed Pokémon when another copy outranks it: "BOX 18 · slot 3 (shiny, 142 IV total)" */
  betterCopy?: string;
  onShowInTracker: (speciesId: number) => void;
  onClose: () => void;
}

const SHEDINJA = 292;
const EV_TOTAL_MAX = 510;
const GENDER_SYMBOL = { male: "♂", female: "♀", genderless: "" } as const;

const EVOLVE_BADGE: Record<EvolveStatus, { label: string; className: string }> = {
  ready: { label: "READY", className: "bg-emerald-500 text-gray-900" },
  waiting: { label: "NOT YET", className: "bg-gray-700 text-gray-300" },
  manual: { label: "CHECK", className: "bg-gray-700 text-gray-300" },
};

/** What this Pokémon's position means for the living dex, in one sentence. */
function slotNote(mon: SlimMon, profile: ProfileMons, analysis: SaveAnalysis, pokemonMap: Map<number, Pokemon>): string | null {
  if (profile.profile.role !== "living-dex" || mon.isEgg) return null;
  const nameOf = (id: number) => pokemonMap.get(id)?.displayName ?? `#${id}`;
  const slotSpecies = mon.box === PARTY_BOX ? null : speciesForSlot(mon.box, mon.slot, profile.profile.startBox, genConfigOf(profile.profile.family).maxSpecies);
  if (slotSpecies === mon.species) {
    return analysis.slots.get(mon.species)?.state === "foreign"
      ? "In its slot, but traded — with \"Only count my own catches\" on it doesn't count as placed."
      : "★ Placed — it's in its own living-dex slot.";
  }
  if (slotSpecies !== null && analysis.placeholders.get(slotSpecies) === mon) {
    return `Holding ${nameOf(slotSpecies)}'s slot — evolve it to fill the slot.`;
  }
  const home = analysis.slots.get(mon.species);
  const where = home ? slotLabel(profile.boxNames, home.box, home.slot) : null;
  if (slotSpecies !== null) {
    return `This slot belongs to ${nameOf(slotSpecies)}.${where && home?.state !== "placed" ? ` ${nameOf(mon.species)} goes in ${where}.` : ""}`;
  }
  if (home?.state === "placed") return `A spare — another ${nameOf(mon.species)} is already in its slot.`;
  return where ? `Not in its slot yet — it goes in ${where}.` : null;
}

function pokerusLabel(byte: number): string | null {
  if (byte === 0) return null;
  return (byte & 0x0f) > 0 ? "Infected" : "Cured";
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 text-right">{children}</span>
    </div>
  );
}

export default function MonCard({ mon, full, pokemon, pokemonMap, profile, analysis, betterCopy, onShowInTracker, onClose }: Props) {
  const form = formName(mon.species, mon.form);
  const note = slotNote(mon, profile, analysis, pokemonMap);
  const nature = full ? NATURES[full.nature] : null;
  const showNickname = full && full.isNicknamed && !full.nameUnsupported && full.nickname;
  const title = mon.isEgg ? "Egg" : showNickname ? full.nickname : pokemon.displayName;

  const stats = full && nature
    ? STAT_KEYS.map((key) => {
        const base = pokemon.baseStats[key];
        const value = key === "hp"
          ? (mon.species === SHEDINJA ? 1 : calcHPStat(base, full.ivs.hp, full.evs.hp, mon.level))
          : calcStat(base, full.ivs[key], full.evs[key], mon.level, getNatureMultiplier(nature, key));
        return { key, base, iv: full.ivs[key], ev: full.evs[key], value };
      })
    : [];
  const ivTotal = stats.reduce((sum, s) => sum + s.iv, 0);
  const hiddenPower = full && !mon.isEgg ? calculateHiddenPower(full.ivs) : null;
  const [battleNote, setBattleNote] = useState<string | null>(null);

  // Fills the first free Designer slot with this Pokémon's real nature, IVs, EVs and moves
  function sendToDesigner() {
    if (!full) return;
    const designer = useDesignerStore.getState();
    const index = designer.slots.findIndex((s) => s.pokemonId == null);
    if (index < 0) {
      setBattleNote("The Designer is full — clear a slot there first.");
      return;
    }
    designer.updateSlot(index, monToDesignerPatch(full, profile.profile.family));
    designer.setActiveBox(Math.floor(index / 30) as 0 | 1 | 2);
    designer.setActiveSlot(index);
    openTab("designer");
  }

  // Same conversion the Designer uses, without taking up a Designer slot
  function loadIntoDamageCalc() {
    if (!full) return;
    const template = useDesignerStore.getState().slots[0];
    const slot = { ...template, knockOutLog: [], routePresets: [], ...monToDesignerPatch(full, profile.profile.family) };
    const calc = designerSlotToCalcPokemon(slot, [...pokemonMap.values()]);
    if (!calc) return;
    useBattleCalcStore.getState().setSlot1(calc);
    openTab("damage-calc");
  }

  const evolutions = evolutionChecks(mon, full, pokemonMap, genConfigOf(profile.profile.family).maxSpecies);
  const evTotal = stats.reduce((sum, s) => sum + s.ev, 0);

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <img src={monSprite(mon, pokemon, genConfigOf(profile.profile.family).gen)} alt="" className="w-20 h-20 object-contain" style={{ imageRendering: "pixelated" }} />
          {mon.shiny && !mon.isEgg && (
            <span className="absolute top-0 left-0 text-sm text-yellow-300 drop-shadow" title="Shiny">✦</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: "var(--theme-font-display)" }}>{title}</h3>
            {full && !mon.isEgg && <span className="text-sm text-gray-400">{GENDER_SYMBOL[full.gender]}</span>}
            {!mon.isEgg && <span className="text-sm text-gray-400">Lv. {mon.level}</span>}
          </div>
          <div className="text-xs text-gray-500">
            {mon.isEgg ? "It hasn't hatched yet" : (
              <>
                #{formatDexNumber(mon.species)} {showNickname ? pokemon.displayName : ""}
                {form ? ` · ${form} form` : ""}
              </>
            )}
          </div>
          {!mon.isEgg && (
            <div className="flex gap-1.5 mt-1.5">
              {pokemon.types.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
            </div>
          )}
          {full && !mon.isEgg && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {originBadges(full, profile.profile.trainer, profile.profile.family).map((badge) => (
                <span
                  key={badge}
                  title={ORIGIN_BADGES[badge].hint}
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${ORIGIN_BADGES[badge].className}`}
                >
                  {ORIGIN_BADGES[badge].label}
                </span>
              ))}
            </div>
          )}
          <div className="text-xs text-gray-500 mt-1.5">{slotLabel(profile.boxNames, mon.box, mon.slot)}</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="p-1.5 -m-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
        >
          ✕
        </button>
      </div>

      {note && (
        <div className="px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/30 text-sm text-amber-100">{note}</div>
      )}

      {betterCopy && (
        <div className="px-3 py-2 rounded-lg bg-indigo-900/30 border border-indigo-700/50 text-sm text-indigo-100">
          Better copy available: {betterCopy}
        </div>
      )}

      {/* Evolutions, checked against its real level, friendship, item and moves */}
      {evolutions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider">Evolves into</div>
          {evolutions.map((evo) => (
            <div key={evo.target} className="flex items-start gap-2 text-sm">
              <span className={`mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${EVOLVE_BADGE[evo.status].className}`}>
                {EVOLVE_BADGE[evo.status].label}
              </span>
              <span className="min-w-0">
                <PokemonLink id={evo.target} to="tracker" generation={genConfigOf(profile.profile.family).gen} className="text-gray-200">
                  {pokemonMap.get(evo.target)?.displayName ?? `#${evo.target}`}
                </PokemonLink>
                <span className="text-gray-500"> · {evo.method}</span>
                <span className="block text-xs text-gray-400">{evo.text}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {full?.nameUnsupported && (
        <div className="text-xs text-gray-500">Its name is in an unsupported script, so the species name is shown instead.</div>
      )}

      {!full && (
        <div className="px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700 text-sm text-gray-400">
          Full details are on the device that imported this save.
        </div>
      )}

      {full && nature && !mon.isEgg && (
        <>
          {/* Facts */}
          <div className="flex flex-col gap-1">
            <Fact label="Nature">
              {nature.name}
              {nature.plus && nature.minus && (
                <span className="text-xs ml-1.5">
                  <span className="text-emerald-400">+{STAT_LABELS[nature.plus]}</span>{" "}
                  <span className="text-rose-400">−{STAT_LABELS[nature.minus]}</span>
                </span>
              )}
            </Fact>
            <Fact label="Ability">{abilityName(full.ability)}</Fact>
            <Fact label="Held item">{full.heldItem ? heldItemName(full) : "None"}</Fact>
            <Fact label="Friendship">{full.friendship}</Fact>
            {hiddenPower && (
              <Fact label="Hidden Power">
                <span className="capitalize">{hiddenPower.type}</span> · {hiddenPower.power}
              </Fact>
            )}
          </div>

          {/* Stats */}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left font-medium py-1">Stat</th>
                <th className="text-right font-medium">Base</th>
                <th className="text-right font-medium">IV</th>
                <th className="text-right font-medium">EV</th>
                <th className="text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.key} className="border-t border-gray-800">
                  <td className={`py-1 ${nature.plus === s.key && nature.minus !== s.key ? "text-emerald-400" : nature.minus === s.key && nature.plus !== s.key ? "text-rose-400" : "text-gray-300"}`}>
                    {STAT_LABELS[s.key]}
                  </td>
                  <td className="text-right text-gray-500 tabular-nums">{s.base}</td>
                  <td className={`text-right tabular-nums ${s.iv === 31 ? "text-emerald-400" : "text-gray-300"}`}>{s.iv}</td>
                  <td className="text-right text-gray-300 tabular-nums">{s.ev}</td>
                  <td className="text-right text-white font-medium tabular-nums">{s.value}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-700 text-xs text-gray-500">
                <td className="py-1">Total</td>
                <td />
                <td className="text-right tabular-nums">{ivTotal}/186</td>
                <td className="text-right tabular-nums">{evTotal}/{EV_TOTAL_MAX}</td>
                <td />
              </tr>
            </tbody>
          </table>

          {/* Moves */}
          <div>
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1.5">Moves</div>
            <div className="grid grid-cols-2 gap-1.5">
              {full.moves.map((move, i) => move > 0 && (
                <div key={i} className="px-2.5 py-1.5 rounded-lg bg-gray-800/70 border border-gray-700/60 flex justify-between gap-2 text-sm">
                  <MoveLink name={moveName(move)} className="text-gray-200 truncate">{moveName(move)}</MoveLink>
                  <span className="text-gray-500 text-xs self-center whitespace-nowrap">
                    PP {full.pp[i]}{full.ppUps[i] > 0 ? ` (+${full.ppUps[i]})` : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Origin */}
          <div className="flex flex-col gap-1">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-0.5">Origin</div>
            <Fact label="Original trainer">
              {full.nameUnsupported ? "(unsupported script)" : full.otName} · ID {String(full.otTid).padStart(5, "0")}
            </Fact>
            <Fact label="Game">{originGameName(full.originGame)}</Fact>
            <Fact label="Met">
              {metLocationName(full)}
              {full.metLevel > 0 ? ` at Lv. ${full.metLevel}` : " (hatched)"}
            </Fact>
            {full.metDate && (
              <Fact label="Date">
                {full.metDate[0]}-{String(full.metDate[1]).padStart(2, "0")}-{String(full.metDate[2]).padStart(2, "0")}
              </Fact>
            )}
            <Fact label="Ball">{ballName(full.ball)}</Fact>
            {pokerusLabel(full.pokerus) && <Fact label="Pokérus">{pokerusLabel(full.pokerus)}</Fact>}
            {full.fateful && <Fact label="Encounter">Fateful encounter</Fact>}
          </div>
        </>
      )}

      {full && !mon.isEgg && (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={sendToDesigner}
              className="py-2 rounded-lg font-medium text-sm transition-colors bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700"
            >
              Send to Designer
            </button>
            <button
              onClick={loadIntoDamageCalc}
              className="py-2 rounded-lg font-medium text-sm transition-colors bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700"
            >
              Use in damage calc
            </button>
          </div>
          {battleNote && <div role="status" className="text-xs text-amber-300">{battleNote}</div>}
        </div>
      )}

      {!mon.isEgg && (
        <div className="flex gap-2">
          <button
            onClick={() => onShowInTracker(mon.species)}
            className="flex-1 py-2 rounded-lg font-medium text-sm transition-colors bg-indigo-900/60 hover:bg-indigo-800/80 text-indigo-300 border border-indigo-700/50"
          >
            Show {pokemon.displayName} in the tracker
          </button>
          <button
            onClick={() => openPokedex(mon.species)}
            className="px-4 py-2 rounded-lg font-medium text-sm transition-colors bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700"
          >
            Pokédex
          </button>
        </div>
      )}
    </div>
  );
}
