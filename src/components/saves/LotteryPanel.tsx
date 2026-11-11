import { useMemo, useState } from "react";
import type { Pokemon } from "../../types";
import type { ParsedSave, ProfileMons } from "../../lib/save/types";
import { PARTY_BOX, genConfigOf } from "../../lib/save/types";
import { lotteryHits } from "../../lib/save/lottery";
import { PokemonLink } from "../shared/links";

interface Props {
  profiles: ProfileMons[];
  fullSaves: Record<string, ParsedSave>;
  pokemonMap: Map<number, Pokemon>;
}

/**
 * F14: type the day's Loto-ID and see which Pokémon, across every Gen IV save
 * imported on this device, match it by trainer ID — and in which save to claim
 * it. Needs the full saves (the synced summaries carry no trainer IDs).
 */
export default function LotteryPanel({ profiles, fullSaves, pokemonMap }: Props) {
  const [text, setText] = useState("");
  const gen4 = profiles.filter((p) => genConfigOf(p.profile.family).gen === 4 && fullSaves[p.profile.id]);
  const loto = /^\d{1,5}$/.test(text) ? Number(text) : null;
  const hits = useMemo(
    () =>
      loto === null
        ? []
        : lotteryHits(
            loto,
            gen4.map((p) => ({ profileId: p.profile.id, mons: fullSaves[p.profile.id].mons })),
          ),
    [loto, gen4, fullSaves],
  );
  const labelOf = new Map(gen4.map((p) => [p.profile.id, p.profile.label]));

  return (
    <section className="flex flex-col gap-3 max-w-2xl" data-testid="lottery-panel">
      <div>
        <h2 className="text-base font-semibold text-gray-100" style={{ fontFamily: "var(--theme-font-display)" }}>
          Lottery check
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          The day&apos;s Loto-ID (Jubilife TV in Diamond, Pearl and Platinum; the Radio Tower in HeartGold and
          SoulSilver) against the trainer ID of every Pokémon in your Gen IV saves on this device. The more digits match
          from the right, the better the prize; claim it in the save that holds the Pokémon.
        </p>
      </div>
      {gen4.length === 0 ? (
        <p className="text-sm text-gray-400">Import a Gen IV save on this device first.</p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm text-gray-300">
            Today&apos;s Loto-ID
            <input
              value={text}
              onChange={(e) => setText(e.target.value.replace(/\D/g, "").slice(0, 5))}
              inputMode="numeric"
              placeholder="12345"
              className="w-28 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 font-mono tabular-nums"
            />
          </label>
          {loto !== null &&
            (hits.length === 0 ? (
              <p className="text-sm text-gray-400">No Pokémon matches even the last digit.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-gray-800 rounded-lg border border-gray-800">
                {hits.slice(0, 30).map((h) => (
                  <li key={`${h.profileId}:${h.mon.box}:${h.mon.slot}`} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-16 flex-shrink-0 text-sm font-semibold text-emerald-300 tabular-nums">
                      {h.digits} digit{h.digits === 1 ? "" : "s"}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-gray-200">
                      <PokemonLink id={h.mon.species} to="tracker">
                        {pokemonMap.get(h.mon.species)?.displayName ?? `#${h.mon.species}`}
                      </PokemonLink>
                      <span className="text-gray-400">
                        {" "}
                        · ID {String(h.mon.otTid).padStart(5, "0")} · {labelOf.get(h.profileId)},{" "}
                        {h.mon.box === PARTY_BOX ? "party" : `box ${h.mon.box + 1}, slot ${h.mon.slot + 1}`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ))}
        </>
      )}
    </section>
  );
}
