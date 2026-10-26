import { useMemo } from "react";
import type { GameVersion, Pokemon } from "../../types";
import { GAME_LABELS } from "../../types";
import { useGameProgressStore } from "../../store/useGameProgressStore";
import { genConfigOf, type ProfileMons } from "../../lib/save/types";
import { palParkOpen, palParkPlan, whereIn } from "../../lib/save/pal-park";
import { getGenSprite } from "../../lib/pokemon-display";
import { PokemonLink } from "../shared/links";

interface Props {
  /** Every imported save, both generations */
  profiles: ProfileMons[];
  pokemonMap: Map<number, Pokemon>;
}

/** The games a profile can be: its game when the save says, else every game of its family */
function gamesOf(p: ProfileMons): string[] {
  if (p.profile.game) return [p.profile.game];
  return { dp: ["diamond", "pearl"], platinum: ["platinum"], hgss: ["heartgold", "soulsilver"] }[p.profile.family as "dp" | "platinum" | "hgss"] ?? [];
}

/**
 * Pal Park: what the Gen III saves have that the Gen IV living dex is missing,
 * grouped by the save to bring it from, with where each copy sits.
 */
export default function PalParkPanel({ profiles, pokemonMap }: Props) {
  const entries = useGameProgressStore((s) => s.entries);
  const livingDex = profiles.find((p) => p.profile.role === "living-dex" && genConfigOf(p.profile.family).gen === 4) ?? null;
  const gen3 = useMemo(() => profiles.filter((p) => genConfigOf(p.profile.family).gen === 3), [profiles]);
  const plan = useMemo(() => (livingDex ? palParkPlan(livingDex, gen3) : []), [livingDex, gen3]);

  if (!livingDex) return <p className="text-sm text-gray-400 py-6 text-center">Import a Gen IV save and set it as your living dex to plan Pal Park.</p>;
  if (gen3.length === 0) return <p className="text-sm text-gray-400 py-6 text-center">Import a Ruby, Sapphire, Emerald, FireRed or LeafGreen save to see what it can send over.</p>;

  const games = gamesOf(livingDex);
  const open = palParkOpen(games, (g) => {
    const e = entries[g];
    return e && !e.removed ? e : undefined;
  });
  // By the save to bring each species from: its best copy's
  const bySave = new Map<string, typeof plan>();
  for (const item of plan) {
    const id = item.sources[0].profileId;
    bySave.set(id, [...(bySave.get(id) ?? []), item]);
  }
  const sinnoh = games.some((g) => ["diamond", "pearl", "platinum"].includes(g));

  return (
    <div className="flex flex-col gap-3" data-testid="pal-park">
      <p className="text-sm text-gray-300">
        {plan.length === 0
          ? `Your living dex already has every species your Gen III saves hold.`
          : `${plan.length} species in your Gen III saves aren't in ${livingDex.profile.label} yet.`}
        {sinnoh && plan.length > 0 && " Pal Park takes six from a Gen III save every 24 hours."}
      </p>
      {!open && (
        <div role="note" className="px-3 py-2.5 rounded-lg border bg-amber-500/10 border-amber-500/40 text-sm text-amber-100">
          Pal Park opens with the National Pokédex in {games.map((g) => GAME_LABELS[g as GameVersion] ?? g).join(" / ")}.
          Tick it in Game progress once you have it.
        </div>
      )}
      {[...bySave].map(([profileId, items]) => (
        <section key={profileId} className="rounded-lg border border-gray-800 bg-gray-800/30">
          <h3 className="px-3 py-2 text-sm font-medium text-gray-100 border-b border-gray-800">
            From {items[0].sources[0].label} <span className="text-gray-500 font-normal">· {items.length}</span>
          </h3>
          <ul className="divide-y divide-gray-800/70">
            {items.map(({ species, sources }) => {
              const p = pokemonMap.get(species);
              const best = sources[0];
              return (
                <li key={species} className="flex items-center gap-3 px-3 py-1.5">
                  {p && <img src={getGenSprite(p, 3)} alt="" loading="lazy" className="w-8 h-8 object-contain" style={{ imageRendering: "pixelated" }} />}
                  <span className="min-w-0">
                    <span className="block text-sm text-gray-200">
                      <PokemonLink id={species} to="tracker" generation={4}>{p?.displayName ?? `#${species}`}</PokemonLink>
                      {best.mon.shiny && <span className="text-amber-300 ml-1" title="Shiny">✦</span>}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {whereIn(best.mon)} · Lv. {best.mon.level}
                      {sources.length > 1 ? ` · ${sources.length} copies` : ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
