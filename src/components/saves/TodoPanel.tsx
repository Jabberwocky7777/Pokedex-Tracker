import { useMemo, useState } from "react";
import type { Pokemon } from "../../types";
import { useSaveStore } from "../../store/useSaveStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { getGenSprite } from "../../lib/pokemon-display";
import { buildTodo, TODO_SECTIONS, type TodoKind, type TodoStep } from "../../lib/save/todo";
import { genConfigOf, type ProfileMons } from "../../lib/save/types";

interface Props {
  /** Profiles of one generation, including the living-dex one */
  profiles: ProfileMons[];
  pokemonMap: Map<number, Pokemon>;
}

const PAGE = 60;

/**
 * Living-dex to-do list: what to move, swap, evolve, bring over, catch and
 * breed, in that order. Check marks are kept until the next import.
 */
export default function TodoPanel({ profiles, pokemonMap }: Props) {
  const fullSaves = useSaveStore((s) => s.fullSaves);
  const checks = useSaveStore((s) => s.todoChecks);
  const toggleCheck = useSaveStore((s) => s.toggleTodoCheck);
  const shinyLivingDex = useSettingsStore((s) => s.shinyLivingDex);
  const [open, setOpen] = useState<TodoKind | null>(null);
  const [shown, setShown] = useState(PAGE);

  const gen = profiles[0] ? genConfigOf(profiles[0].profile.family) : null;
  const list = useMemo(() => {
    if (!gen) return null;
    return buildTodo(profiles, {
      pokemon: [...pokemonMap.values()].filter((p) => p.id <= gen.maxSpecies),
      genGames: gen.games,
      maxSpecies: gen.maxSpecies,
      fullSaves,
      shinyLivingDex,
    });
  }, [profiles, pokemonMap, fullSaves, gen, shinyLivingDex]);

  if (!list || !gen) return null;

  if (!list.living) {
    return (
      <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 text-sm text-gray-400 max-w-3xl">
        The to-do list is built around your living dex. Mark one of your saves as <span className="text-amber-300">★ My living dex</span> to get one.
      </div>
    );
  }

  if (list.complete) {
    return (
      <div className="rounded-xl bg-amber-400/10 border border-amber-400/40 p-8 text-center max-w-3xl">
        <div className="text-7xl leading-none text-amber-300 drop-shadow">★</div>
        <h3 className="text-2xl font-bold text-amber-200 mt-3" style={{ fontFamily: "var(--theme-font-display)" }}>
          Living dex complete
        </h3>
        <p className="text-sm text-amber-100/80 mt-1">All {list.total} Pokémon are in their slots in {list.living.profile.label}.</p>
      </div>
    );
  }

  const byKind = new Map<TodoKind, TodoStep[]>();
  for (const step of list.steps) byKind.set(step.kind, [...(byKind.get(step.kind) ?? []), step]);
  const sections = TODO_SECTIONS.filter((s) => byKind.has(s.kind));
  const active = open && byKind.has(open) ? open : sections[0]?.kind ?? null;
  const steps = active ? byKind.get(active)! : [];

  const openRoute = (slug: string) => {
    const settings = useSettingsStore.getState();
    settings.setActiveTab("routes");
    settings.setActiveRoute(slug);
  };

  return (
    <div className="flex flex-col gap-3 max-w-3xl">
      <p className="text-sm text-gray-400">
        {list.placed} of {list.total} placed in {list.living.profile.label}. Work through these top to bottom; ticks are
        kept until your next import.
      </p>

      {/* Category chips with counts */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="To-do categories">
        {sections.map((s) => {
          const all = byKind.get(s.kind)!;
          const done = all.filter((step) => checks[step.id]).length;
          return (
            <button
              key={s.kind}
              role="tab"
              aria-selected={active === s.kind}
              onClick={() => { setOpen(s.kind); setShown(PAGE); }}
              title={s.hint}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                active === s.kind
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "bg-gray-800/60 border-gray-700 text-gray-300 hover:text-white"
              }`}
            >
              {s.label} <span className="tabular-nums opacity-80">{done > 0 ? `${done}/` : ""}{all.length}</span>
            </button>
          );
        })}
      </div>

      {active && (
        <p className="text-xs text-gray-500">{TODO_SECTIONS.find((s) => s.kind === active)?.hint}</p>
      )}

      <ul className="flex flex-col gap-1">
        {steps.slice(0, shown).map((step, i) => {
          const heading = i === 0 || steps[i - 1].group !== step.group ? step.group : null;
          const p = pokemonMap.get(step.species);
          const done = !!checks[step.id];
          return (
            <li key={step.id}>
              {heading && <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-3 mb-1">{heading}</div>}
              <div className={`flex items-center gap-3 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 ${done ? "opacity-50" : ""}`}>
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggleCheck(step.id)}
                  aria-label={`Done: ${step.text}`}
                  className="w-5 h-5 accent-indigo-500 flex-shrink-0 cursor-pointer"
                />
                {p && <img src={getGenSprite(p, gen.gen)} alt="" loading="lazy" className="w-9 h-9 object-contain flex-shrink-0" style={{ imageRendering: "pixelated" }} />}
                <div className="min-w-0 flex-1">
                  <div className={`text-sm text-gray-100 ${done ? "line-through" : ""}`}>
                    {step.text}
                    {step.ready && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-gray-900 align-middle">READY</span>
                    )}
                  </div>
                  {step.detail && <div className="text-xs text-gray-500">{step.detail}</div>}
                </div>
                {step.slug && (
                  <button onClick={() => openRoute(step.slug!)} className="text-xs text-indigo-300 hover:text-indigo-200 whitespace-nowrap flex-shrink-0 py-1">
                    Routes →
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {steps.length > shown && (
        <button
          onClick={() => setShown((n) => n + PAGE)}
          className="self-center px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-200 font-medium transition-colors"
        >
          Show more ({steps.length - shown} more)
        </button>
      )}
    </div>
  );
}
