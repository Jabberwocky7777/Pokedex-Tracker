import { useEffect, useMemo, useRef, useState } from "react";
import type { MetaData, Pokemon } from "../../types";
import { useSettingsStore } from "../../store/useSettingsStore";
import { useDexStore } from "../../store/useDexStore";
import { byMonth, catchHistory, caughtCount, caughtSince, cumulativeSeries, milestones, WEEK_MS, type CatchHistory } from "../../lib/progress-history";
import { generationMaxId, generationVersions } from "../../lib/generation";
import { PokemonLink } from "../shared/links";

interface Props {
  allPokemon: Pokemon[];
  meta: MetaData;
}

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/**
 * Progress over time: caught Pokémon against the date each was marked, for the
 * generation or one of its regional dexes, with milestones and a weekly count.
 */
export default function ProgressView({ allPokemon, meta }: Props) {
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  const caughtIds = useDexStore((s) => s.caughtByGen[activeGeneration]);
  const stamps = useDexStore((s) => s.updatedAt.caught[activeGeneration]);
  const [scopeId, setScopeId] = useState("national");
  // "This week" is measured from when the view was opened
  const [now] = useState(() => Date.now());

  const genName = meta.generations.find((g) => g.id === activeGeneration)?.name ?? `Generation ${activeGeneration}`;
  const scopes = useMemo(() => {
    const maxId = generationMaxId(activeGeneration);
    const versions = generationVersions(activeGeneration) as string[];
    const national = { id: "national", name: genName, ids: allPokemon.filter((p) => p.id <= maxId).map((p) => p.id) };
    const regional = meta.regionalDexes
      .filter((dex) => dex.games.every((g) => versions.includes(g)))
      .map((dex) => ({
        id: dex.id, name: dex.name,
        ids: allPokemon.filter((p) => p.id <= maxId && p.regionalDexEntries?.some((e) => e.dexId === dex.id)).map((p) => p.id),
      }));
    return [national, ...regional];
  }, [allPokemon, meta, activeGeneration, genName]);
  const scope = scopes.find((s) => s.id === scopeId) ?? scopes[0];

  const history = useMemo(() => catchHistory(scope.ids, new Set(caughtIds ?? []), stamps), [scope, caughtIds, stamps]);
  const reached = milestones(history, scope.name);
  const months = byMonth(history);
  const nameOf = (id: number) => allPokemon.find((p) => p.id === id)?.displayName ?? `#${id}`;
  const count = caughtCount(history);

  return (
    <div className="p-4 flex flex-col gap-4 max-w-3xl">
      <div>
        <h2 className="text-base font-semibold text-gray-100" style={{ fontFamily: "var(--theme-font-display)" }}>
          Progress over time
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Dates are when each Pokémon was last marked caught. Un-marking one and marking it again keeps only the later
          date, so its earlier catch is lost; marks with no recorded time are counted from the start.
        </p>
      </div>

      {/* Which dex */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dex">
        {scopes.map((s) => (
          <button
            key={s.id}
            onClick={() => setScopeId(s.id)}
            aria-pressed={scope.id === s.id}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              scope.id === s.id ? "bg-indigo-600 border-indigo-500 text-white" : "bg-gray-800/60 border-gray-700 text-gray-300 hover:text-white"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-3 gap-2">
        <Tile value={`${count} / ${history.total}`} label="Caught" />
        <Tile value={String(caughtSince(history, now - WEEK_MS))} label="This week" testId="progress-week" />
        <Tile value={history.total > 0 ? `${Math.floor((count / history.total) * 100)}%` : "—"} label="Complete" />
      </div>

      <section className="rounded-xl bg-gray-900 border border-gray-800 p-3">
        <h3 className="text-sm font-semibold text-gray-100">{scope.name}: caught over time</h3>
        {history.events.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-8 text-center">
            {count === 0 ? "Nothing caught here yet." : "None of these catches has a recorded date yet."}
          </p>
        ) : (
          <CatchChart history={history} nameOf={nameOf} />
        )}
        {history.undated > 0 && (
          <p className="text-xs text-gray-500 mt-1">{history.undated} caught with no recorded date — the line starts from there.</p>
        )}
        {months.length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-200">As a table</summary>
            <table className="mt-1.5 text-xs w-full max-w-xs">
              <thead>
                <tr className="text-gray-500 text-left"><th className="font-medium py-0.5">Month</th><th className="font-medium text-right">Caught</th><th className="font-medium text-right">Total</th></tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month} className="border-t border-gray-800 text-gray-300 tabular-nums">
                    <td className="py-0.5">{m.month}</td><td className="text-right">{m.count}</td><td className="text-right">{m.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>

      <section className="flex flex-col gap-1.5">
        <h3 className="text-xs text-gray-500 font-medium uppercase tracking-wider">Milestones</h3>
        {reached.length === 0 && <p className="text-sm text-gray-400 italic">The first catch is the first milestone.</p>}
        <ul className="flex flex-col gap-1">
          {reached.map((m) => (
            <li key={m.label} className="flex items-baseline gap-3 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-sm">
              <span className="text-amber-300">★</span>
              <span className="text-gray-100 font-medium">{m.label}</span>
              <span className="text-gray-400 min-w-0">
                {m.id !== null && <PokemonLink id={m.id} to="tracker">{nameOf(m.id)}</PokemonLink>}
              </span>
              <span className="ml-auto text-xs text-gray-500 whitespace-nowrap">{m.at !== null ? day(m.at) : "date not recorded"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Tile({ value, label, testId }: { value: string; label: string; testId?: string }) {
  return (
    <div className="rounded-lg bg-gray-900 border border-gray-800 px-3 py-2">
      <div className="text-lg font-bold text-white tabular-nums" data-testid={testId}>{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  );
}

// ── The chart ────────────────────────────────────────────────────────────────
// One series, so no legend: the heading above names it. A stepped line (the
// count only changes at a catch), recessive grid, and a crosshair with a
// tooltip. Text uses the theme's text colours; only the line is indigo.

const HEIGHT = 220;
const PAD = { top: 12, right: 12, bottom: 24, left: 36 };
const DAY_MS = 24 * 60 * 60 * 1000;

function niceStep(max: number): number {
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(Math.max(rough, 1)));
  return [1, 2, 5, 10].map((m) => m * power).find((step) => step >= rough) ?? power * 10;
}

function CatchChart({ history, nameOf }: { history: CatchHistory; nameOf: (id: number) => string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!box.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.floor(entry.contentRect.width))));
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  const series = useMemo(() => cumulativeSeries(history), [history]);
  // A little room either side, and at least a day wide when everything was marked at once
  const first = series[0].at, last = series[series.length - 1].at;
  const span = Math.max(last - first, DAY_MS);
  const x0 = first - span * 0.03, x1 = first + span * 1.03;
  const yMax = Math.max(series[series.length - 1].count, 1);
  const step = niceStep(yMax);
  const yTop = Math.ceil(yMax / step) * step;

  const plotW = width - PAD.left - PAD.right, plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (at: number) => PAD.left + ((at - x0) / (x1 - x0)) * plotW;
  const y = (count: number) => PAD.top + plotH - (count / yTop) * plotH;

  // Stepped: flat until the next catch, then straight up
  let path = `M ${x(x0)} ${y(history.undated)}`;
  for (const point of series) path += ` H ${x(point.at)} V ${y(point.count)}`;
  path += ` H ${x(x1)}`;

  const ticks: number[] = [];
  for (let value = 0; value <= yTop; value += step) ticks.push(value);
  const shown = hover !== null ? series[hover] : null;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const at = x0 + ((e.clientX - rect.left - PAD.left) / plotW) * (x1 - x0);
    // The latest catch at or before the pointer (the value the line shows there)
    let index = 0;
    for (let i = 0; i < series.length; i++) if (series[i].at <= at) index = i;
    setHover(index);
  }

  return (
    <div ref={box} className="relative mt-2">
      <svg
        width={width} height={HEIGHT} role="img"
        aria-label={`Caught over time: ${series[series.length - 1].count} by ${day(last)}`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}
        className="block touch-pan-y"
      >
        {ticks.map((value) => (
          <g key={value}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(value)} y2={y(value)} stroke="var(--color-gray-800)" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(value) + 3} textAnchor="end" fontSize={10} fill="var(--color-gray-500)">{value}</text>
          </g>
        ))}
        <text x={x(first)} y={HEIGHT - 6} textAnchor="start" fontSize={10} fill="var(--color-gray-500)">{day(first)}</text>
        {last - first > DAY_MS && (
          <text x={x(last)} y={HEIGHT - 6} textAnchor="end" fontSize={10} fill="var(--color-gray-500)">{day(last)}</text>
        )}
        <path d={path} fill="none" stroke="var(--color-indigo-400)" strokeWidth={2} strokeLinejoin="round" />
        {shown && (
          <g>
            <line x1={x(shown.at)} x2={x(shown.at)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--color-gray-600)" strokeWidth={1} />
            <circle cx={x(shown.at)} cy={y(shown.count)} r={4} fill="var(--color-indigo-400)" stroke="var(--color-gray-900)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {shown && (
        <div
          className="absolute pointer-events-none px-2 py-1 rounded-md bg-gray-800 border border-gray-700 text-xs text-gray-200 shadow-lg whitespace-nowrap"
          style={{ top: 4, ...(x(shown.at) > width / 2 ? { right: width - x(shown.at) + 8 } : { left: x(shown.at) + 8 }) }}
        >
          <span className="font-semibold tabular-nums">{shown.count}</span> caught · {day(shown.at)}
          <span className="block text-gray-400">{nameOf(shown.id)}</span>
        </div>
      )}
    </div>
  );
}
