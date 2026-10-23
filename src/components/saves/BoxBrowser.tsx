import { useMemo, useState } from "react";
import type { Pokemon } from "../../types";
import { getGenSprite } from "../../lib/pokemon-display";
import { speciesForSlot, type SaveAnalysis } from "../../lib/save/living-dex";
import { BOX_SIZE, PARTY_BOX, genConfigOf, type ParsedSave, type ProfileMons, type SlimMon } from "../../lib/save/types";
import { ORIGIN_BADGES, originBadges } from "../../lib/save/origin";
import { monSprite } from "./saveDisplay";

interface Props {
  profile: ProfileMons;
  analysis: SaveAnalysis;
  pokemonMap: Map<number, Pokemon>;
  selected: SlimMon | null;
  /** "box:slot" of Pokémon the living dex wants evolved that can evolve right now */
  readyKeys?: ReadonlySet<string>;
  /** The fully parsed save, when this device has it — adds origin markers */
  full?: ParsedSave;
  /** Box to open on (defaults to the first dex box, or the party) */
  initialBox?: number;
  onSelect: (mon: SlimMon | null) => void;
}

type Overlay = "placed" | "placeholder" | "wrong" | "none";

const OVERLAY_CLASS: Record<Overlay, string> = {
  placed: "border-2 border-amber-400 bg-amber-400/10",
  placeholder: "border-2 border-dashed border-yellow-400 bg-yellow-400/5",
  wrong: "border-2 border-dashed border-rose-400 bg-rose-400/5",
  none: "border-2 border-transparent bg-gray-800/60",
};

export default function BoxBrowser({ profile, analysis, pokemonMap, selected, readyKeys, full, initialBox, onSelect }: Props) {
  const isLivingDex = profile.profile.role === "living-dex";
  const { startBox } = profile.profile;
  const { gen, boxCount, maxSpecies } = genConfigOf(profile.profile.family);

  // Open on the first dex box of a living dex, otherwise on the party
  const [box, setBox] = useState(initialBox ?? (isLivingDex ? startBox : PARTY_BOX));

  const bySlot = useMemo(() => {
    const map = new Map<string, SlimMon>();
    for (const m of profile.mons) map.set(`${m.box}:${m.slot}`, m);
    return map;
  }, [profile.mons]);

  // "T" traded · "P" Pal Park · "E" event — only the origins worth a second look get a marker
  const markers = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of full?.mons ?? []) {
      if (m.isEgg) continue;
      const text = originBadges(m, profile.profile.trainer, profile.profile.family).map((b) => ORIGIN_BADGES[b].marker).join("");
      if (text) map.set(`${m.box}:${m.slot}`, text);
    }
    return map;
  }, [full, profile.profile.trainer, profile.profile.family]);

  const tabs = [{ id: PARTY_BOX, label: "Party" }].concat(
    Array.from({ length: boxCount }, (_, i) => ({ id: i, label: profile.boxNames[i] || `Box ${i + 1}` })),
  );
  const slotCount = box === PARTY_BOX ? 6 : BOX_SIZE;

  return (
    <div className="flex flex-col gap-3 max-w-xl w-full">
      {/* Box tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Boxes">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={box === tab.id}
            onClick={() => { setBox(tab.id); onSelect(null); }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap border transition-colors ${
              box === tab.id
                ? "bg-indigo-600 border-indigo-500 text-white"
                : "bg-gray-800/60 border-gray-700 text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 6 × 5 grid */}
      <div className="grid grid-cols-6 gap-1.5 bg-gray-800/30 rounded-xl p-3">
        {Array.from({ length: slotCount }, (_, slot) => {
          const mon = bySlot.get(`${box}:${slot}`) ?? null;
          const slotSpecies = isLivingDex && box !== PARTY_BOX ? speciesForSlot(box, slot, startBox, maxSpecies) : null;

          if (!mon) {
            // An empty dex slot shows a ghost of the species that belongs there
            const ghost = slotSpecies !== null ? pokemonMap.get(slotSpecies) : undefined;
            return (
              <div
                key={slot}
                title={ghost ? `Empty — ${ghost.displayName} goes here` : "Empty"}
                className="aspect-square rounded-lg bg-gray-800/20 border border-gray-700/20 flex items-center justify-center"
              >
                {ghost && (
                  <img
                    src={getGenSprite(ghost, gen)}
                    alt=""
                    loading="lazy"
                    className="w-full h-full object-contain p-1 opacity-20 grayscale"
                    style={{ imageRendering: "pixelated" }}
                  />
                )}
              </div>
            );
          }

          const pokemon = pokemonMap.get(mon.species);
          let overlay: Overlay = "none";
          const state = slotSpecies !== null ? analysis.slots.get(slotSpecies)?.state : undefined;
          if (state === "placed" || state === "placeholder") overlay = state;
          else if (state) overlay = "wrong";
          const marker = markers.get(`${box}:${slot}`);
          const isSelected = selected === mon;
          const isReady = readyKeys?.has(`${box}:${slot}`) ?? false;
          const name = mon.isEgg ? "Egg" : pokemon?.displayName ?? `#${mon.species}`;
          const overlayHint = overlay === "placeholder"
            ? ` — holding ${pokemonMap.get(slotSpecies!)?.displayName}'s slot`
            : state === "foreign" ? " — traded, so it doesn't count as placed"
            : overlay === "wrong" ? ` — this slot belongs to ${pokemonMap.get(slotSpecies!)?.displayName}` : "";

          return (
            <button
              key={slot}
              onClick={() => onSelect(isSelected ? null : mon)}
              title={`${name} Lv. ${mon.level}${overlayHint}${isReady ? " — ready to evolve" : ""}`}
              aria-pressed={isSelected}
              className={`relative aspect-square rounded-lg overflow-hidden transition-all cursor-pointer ${OVERLAY_CLASS[overlay]} ${
                isSelected ? "ring-2 ring-indigo-400 ring-offset-1 ring-offset-gray-950" : "hover:brightness-125"
              }`}
              style={{ touchAction: "manipulation" }}
            >
              <img
                src={monSprite(mon, pokemon, gen)}
                alt={name}
                loading="lazy"
                draggable={false}
                className="w-full h-full object-contain p-0.5 pointer-events-none"
                style={{ imageRendering: "pixelated" }}
              />
              {overlay === "placed" && (
                <span className="absolute bottom-0 right-0.5 text-[11px] leading-none text-amber-300 drop-shadow">★</span>
              )}
              {isReady ? (
                <span className="absolute bottom-0 inset-x-0 text-[8px] leading-tight font-bold text-center bg-emerald-500 text-gray-900" title="Ready to evolve" aria-label="Ready to evolve">READY</span>
              ) : overlay === "placeholder" && (
                <span className="absolute bottom-0 inset-x-0 text-[8px] leading-tight font-bold text-center bg-yellow-400 text-gray-900" title="An earlier stage holding the slot" aria-label="An earlier stage holding the slot">EVO</span>
              )}
              {mon.shiny && !mon.isEgg && (
                <span className="absolute top-0 left-0.5 text-[11px] leading-none text-yellow-300 drop-shadow">✦</span>
              )}
              {marker && (
                <span className="absolute top-0 right-0.5 text-[8px] leading-tight font-bold text-sky-300 drop-shadow" title={[...marker].map((c) => Object.values(ORIGIN_BADGES).find((b) => b.marker === c)?.label ?? c).join(", ")}>{marker}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      {isLivingDex && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded border-2 border-amber-400 bg-amber-400/10" /> ★ In its slot
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded border-2 border-dashed border-yellow-400" /> EVO — earlier stage holding the slot
          </span>
          <span className="flex items-center gap-1.5">
            <span className="px-1 rounded text-[11px] font-bold bg-emerald-500 text-gray-900">READY</span> can evolve now
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded border-2 border-dashed border-rose-400" /> Different species
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded border border-gray-700 bg-gray-800/40" /> Faded — still missing
          </span>
        </div>
      )}
      {markers.size > 0 && (
        <div className="text-xs text-gray-500">
          <span className="font-bold text-sky-300">T</span> traded · <span className="font-bold text-sky-300">P</span> Pal Park ·{" "}
          <span className="font-bold text-sky-300">E</span> event
        </div>
      )}
    </div>
  );
}
