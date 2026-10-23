import { useMemo, useState, type ReactNode } from "react";
import type { Pokemon } from "../../types";
import { GAME_COLORS, GAME_LABELS } from "../../types";
import { buildTransferPlan } from "../../lib/save/acquire";
import { slotLabel } from "../../lib/save/living-dex";
import { getGenSprite } from "../../lib/pokemon-display";
import { genConfigOf, type ProfileMons } from "../../lib/save/types";
import { openRoute } from "../../lib/navigate";
import { PokemonLink } from "../shared/links";

interface Props {
  profiles: ProfileMons[];
  pokemonMap: Map<number, Pokemon>;
}

function levels(min: number, max: number): string {
  return min === max ? `Lv ${min}` : `Lv ${min}–${max}`;
}

/**
 * Cross-save transfer planner: for everything the living-dex save lacks, a
 * shopping list per game — what you already have there to send over, and
 * what is best caught there.
 */
export default function PlanPanel({ profiles, pokemonMap }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const gen = profiles[0] ? genConfigOf(profiles[0].profile.family) : null;
  const plan = useMemo(() => {
    if (!gen) return null;
    return buildTransferPlan(profiles, {
      pokemon: [...pokemonMap.values()].filter((p) => p.id <= gen.maxSpecies),
      genGames: gen.games,
      maxSpecies: gen.maxSpecies,
    });
  }, [profiles, pokemonMap, gen]);

  if (!plan || !gen) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 text-sm text-gray-400 max-w-3xl">
        The plan is built around your living dex. Mark one of your saves as <span className="text-amber-300">★ My living dex</span> to get one.
      </div>
    );
  }

  const nameOf = (id: number) => pokemonMap.get(id)?.displayName ?? `#${id}`;
  const sprite = (id: number) => {
    const p = pokemonMap.get(id);
    return p ? <img src={getGenSprite(p, gen.gen)} alt="" loading="lazy" className="w-8 h-8 object-contain flex-shrink-0" style={{ imageRendering: "pixelated" }} /> : null;
  };
  // A species' name, opening the tracker's detail panel on it
  const link = (id: number) => <PokemonLink id={id} to="tracker" generation={gen.gen}>{nameOf(id)}</PokemonLink>;
  const toggle = (id: string) => setOpen((cur) => (cur === id ? null : id));
  const row = "flex items-center gap-3 px-3 py-1.5";

  const extras: { id: string; title: string; summary: string; rows: { species: number; text: ReactNode; note?: string }[] }[] = [
    {
      id: "evolve", title: "Evolve",
      summary: `${plan.toEvolve.length} to evolve, ${plan.toEvolve.filter((e) => e.trade).length} by trade`,
      rows: plan.toEvolve.map((e) => ({
        species: e.species,
        text: <>{link(e.species)} from {link(e.from)}</>,
        note: [e.have ? `you have a ${nameOf(e.from)} waiting` : `get a ${nameOf(e.from)} first`, e.trade ? "trade it to evolve" : ""].filter(Boolean).join(" · "),
      })),
    },
    {
      id: "breed", title: "Breed", summary: `${plan.toBreed.length} to hatch`,
      rows: plan.toBreed.map((b) => ({ species: b.species, text: <>{link(b.species)} — breed {link(b.parent)}</> })),
    },
    {
      id: "unavailable", title: "No wild encounter", summary: `${plan.unavailable.length} from events, gifts or in-game trades`,
      rows: plan.unavailable.map((species) => ({ species, text: link(species) })),
    },
  ].filter((section) => section.rows.length > 0);

  return (
    <div className="flex flex-col gap-2 max-w-3xl">
      <p className="text-sm text-gray-400">
        Your living-dex save has no copy of {plan.missing} species. Here is where each one can come from, game by game.
      </p>

      {plan.games.map((g) => {
        const isOpen = open === g.game;
        return (
          <section key={g.game} className="rounded-xl bg-gray-900 border border-gray-800">
            <button onClick={() => toggle(g.game)} aria-expanded={isOpen} className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: GAME_COLORS[g.game] ?? "#6b7280" }} />
              <span className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-gray-100">In {GAME_LABELS[g.game]}</span>
                {!g.yours && <span className="ml-2 text-xs text-gray-500">not imported</span>}
                <span className="block text-xs text-gray-400">
                  {[
                    g.toCatch.length > 0 ? `catch ${g.toCatch.length}` : "",
                    g.toSend.length > 0 ? `already have ${g.toSend.length} to send` : "",
                  ].filter(Boolean).join(", ")}
                </span>
              </span>
              <span className="text-xs text-gray-500">{isOpen ? "▾" : "▸"}</span>
            </button>
            {isOpen && (
              <ul className="border-t border-gray-800 divide-y divide-gray-800/70">
                {g.toSend.map(({ species, source }) => (
                  <li key={`send-${species}`} className={row}>
                    {sprite(species)}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-gray-200">Bring {link(species)} over</span>
                      <span className="block text-xs text-gray-500">{source.label} · {slotLabel(source.boxNames, source.mon.box, source.mon.slot)}</span>
                    </span>
                  </li>
                ))}
                {g.toCatch.map(({ species, spot }) => (
                  <li key={`catch-${species}`} className={row}>
                    {sprite(species)}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-gray-200">
                        Catch {link(species)}
                        {spot.exclusive && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[11px] font-bold bg-blue-900/60 text-blue-200 border border-blue-700/50 align-middle">
                            EXCLUSIVE
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-gray-500">{spot.location}, {levels(spot.minLevel, spot.maxLevel)}</span>
                    </span>
                    <button onClick={() => openRoute(spot.slug)} className="text-xs text-indigo-300 hover:text-indigo-200 whitespace-nowrap py-1">
                      Routes →
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {extras.map((section) => {
        const isOpen = open === section.id;
        return (
          <section key={section.id} className="rounded-xl bg-gray-900 border border-gray-800">
            <button onClick={() => toggle(section.id)} aria-expanded={isOpen} className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
              <span className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-gray-100">{section.title}</span>
                <span className="block text-xs text-gray-400">{section.summary}</span>
              </span>
              <span className="text-xs text-gray-500">{isOpen ? "▾" : "▸"}</span>
            </button>
            {isOpen && (
              <ul className="border-t border-gray-800 divide-y divide-gray-800/70">
                {section.rows.map((r) => (
                  <li key={r.species} className={row}>
                    {sprite(r.species)}
                    <span className="min-w-0">
                      <span className="block text-sm text-gray-200">{r.text}</span>
                      {r.note && <span className="block text-xs text-gray-500">{r.note}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
