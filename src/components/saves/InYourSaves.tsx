import { useMemo } from "react";
import type { Pokemon } from "../../types";
import type { SavesOverview } from "../../hooks/useSaves";
import { analyzeProfile } from "../../lib/save/living-dex";
import { slotLabel } from "./saveDisplay";

interface Props {
  pokemon: Pokemon;
  pokemonMap: Map<number, Pokemon>;
  overview: SavesOverview;
}

/**
 * Detail-panel card: where this species is in each imported save, what its
 * living-dex slot holds, and why it is (or isn't) waiting on an evolution.
 * Works from the synced summaries, so it shows on every device.
 */
export default function InYourSaves({ pokemon, pokemonMap, overview }: Props) {
  const { id } = pokemon;
  const nameOf = (species: number) => pokemonMap.get(species)?.displayName ?? `#${species}`;

  const rows = useMemo(
    () =>
      overview.profiles.map((p) => ({
        p,
        copies: p.mons.filter((m) => m.species === id && !m.isEgg),
        slot: p.profile.role === "living-dex" ? analyzeProfile(p, pokemonMap).slots.get(id) ?? null : null,
      })),
    [overview.profiles, pokemonMap, id],
  );

  const pending = overview.allocation.pending.get(id);
  const couldAlso = overview.allocation.couldAlso.get(id);
  const breedFrom = overview.breeding.get(id);
  const owned = overview.allocation.owned.has(id);

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 rounded-lg bg-gray-800/40 border border-gray-700/50">
      <div className="text-xs text-gray-400 font-medium uppercase tracking-wider">In your saves</div>

      {rows.map(({ p, copies, slot }) => (
        <div key={p.profile.id} className="flex flex-col gap-0.5">
          <div className="text-sm text-gray-200 font-medium">{p.profile.role === "living-dex" ? "★ " : ""}{p.profile.label}</div>
          {copies.length === 0 && <div className="text-xs text-gray-500">None in this save</div>}
          {copies.map((m) => (
            <div key={`${m.box}:${m.slot}`} className="text-xs text-gray-400">
              {slotLabel(p.boxNames, m.box, m.slot)} · Lv. {m.level}
              {m.shiny && <span className="text-yellow-300"> · ✦ shiny</span>}
            </div>
          ))}
          {slot && (
            <div className={`text-xs ${slot.state === "placed" ? "text-amber-300" : "text-gray-400"}`}>
              {slot.state === "placed" && `★ In its slot (${slotLabel(p.boxNames, slot.box, slot.slot)})`}
              {slot.state === "empty" && `Its slot (${slotLabel(p.boxNames, slot.box, slot.slot)}) is empty`}
              {(slot.state === "placeholder" || slot.state === "wrong") &&
                `Its slot (${slotLabel(p.boxNames, slot.box, slot.slot)}) holds ${slot.occupant!.isEgg ? "an Egg" : nameOf(slot.occupant!.species)}`}
            </div>
          )}
        </div>
      ))}

      {/* Why it is waiting on an evolution — or what else could fill it */}
      {pending && (
        <div className="text-xs text-yellow-200">
          {pending.kind === "placeholder"
            ? `${nameOf(pending.from)} is holding its slot — evolve it to fill the slot.`
            : `A spare ${nameOf(pending.from)} can evolve into it.`}
          {pending.alternatives.length > 0 && ` That ${nameOf(pending.from)} could also become ${pending.alternatives.map(nameOf).join(", ")}.`}
        </div>
      )}
      {!owned && !pending && couldAlso && (
        <div className="text-xs text-gray-400">
          Your spare {nameOf(couldAlso.from)} could also become this, but it is counted towards {nameOf(couldAlso.assignedTo)}.
        </div>
      )}
      {breedFrom !== undefined && (
        <div className="text-xs text-pink-300">♡ Needs breeding: breed {nameOf(breedFrom)} to get {pokemon.displayName}.</div>
      )}
    </div>
  );
}
