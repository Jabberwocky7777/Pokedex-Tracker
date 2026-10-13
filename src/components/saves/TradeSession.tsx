import { useMemo, useState } from "react";
import type { GameVersion, Pokemon } from "../../types";
import { GAME_LABELS } from "../../types";
import { useDexStore } from "../../store/useDexStore";
import { buildTradeSession, type TradeItem, type TradeKind, type TradeSide } from "../../lib/trade-session";
import { profileGames } from "../../lib/save/acquire";
import { genConfigOf, type ProfileMons } from "../../lib/save/types";
import { generationMaxId, generationVersions } from "../../lib/generation";
import { getGenSprite } from "../../lib/pokemon-display";
import { PokemonLink } from "../shared/links";

interface Props {
  /** Every imported save; the ones of `generation` are offered as sides */
  profiles: ProfileMons[];
  pokemonMap: Map<number, Pokemon>;
  generation: number;
}

const KIND_LABEL: Record<TradeKind, string> = {
  exclusive: "Version exclusives",
  spare: "Spares the other side lacks",
  "trade-evolution": "Trade evolutions — send over and back",
};

/**
 * Trade session: pick two sides (imported saves, or plain games) and get one
 * checklist of what to send each way. Ticks are kept while the pair is open.
 */
export default function TradeSession({ profiles, pokemonMap, generation }: Props) {
  const caughtIds = useDexStore((s) => s.caughtByGen[generation]);

  const sides = useMemo<TradeSide[]>(() => {
    const saves = profiles
      .filter((p) => genConfigOf(p.profile.family).gen === generation)
      .map((p) => ({ key: p.profile.id, label: `${p.profile.label} (save)`, games: profileGames(p.profile), mons: p.mons }));
    const games = generationVersions(generation).map((game: GameVersion) => ({ key: `game:${game}`, label: GAME_LABELS[game], games: [game], mons: null }));
    return [...saves, ...games];
  }, [profiles, generation]);

  const [picked, setPicked] = useState<[string, string]>(["", ""]);
  const a = sides.find((s) => s.key === picked[0]) ?? sides[0];
  const b = sides.find((s) => s.key === picked[1] && s.key !== a.key) ?? sides.find((s) => s.key !== a.key)!;

  const items = useMemo(() => {
    const maxSpecies = generationMaxId(generation);
    return buildTradeSession([a, b], { pokemon: [...pokemonMap.values()], maxSpecies, caught: new Set(caughtIds ?? []) });
  }, [a, b, pokemonMap, generation, caughtIds]);

  const picker = (index: 0 | 1, value: TradeSide, other: TradeSide) => (
    <select
      value={value.key}
      onChange={(e) => setPicked(index === 0 ? [e.target.value, b.key] : [a.key, e.target.value])}
      aria-label={index === 0 ? "First side" : "Second side"}
      className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
    >
      {sides.filter((s) => s.key !== other.key).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
    </select>
  );

  return (
    <div className="flex flex-col gap-3 max-w-3xl w-full" data-testid="trade-session">
      <div>
        <h3 className="text-sm font-semibold text-gray-100">Trade session</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Pick the two sides of a trade. A save knows what it holds; a game on its own lists everything it could send.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {picker(0, a, b)}
        <span className="text-gray-500 flex-shrink-0">⇄</span>
        {picker(1, b, a)}
      </div>

      {/* Remounted for each pair, so ticks from another pair don't carry over */}
      <Checklist key={`${a.key}|${b.key}`} items={items} sides={[a, b]} pokemonMap={pokemonMap} generation={generation} />
    </div>
  );
}

function Checklist({ items, sides, pokemonMap, generation }: {
  items: TradeItem[]; sides: [TradeSide, TradeSide]; pokemonMap: Map<number, Pokemon>; generation: number;
}) {
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) => setDone((current) => {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  });
  const link = (id: number) => <PokemonLink id={id} to="tracker" generation={generation}>{pokemonMap.get(id)?.displayName ?? `#${id}`}</PokemonLink>;

  if (items.length === 0) {
    return <p className="text-sm text-gray-400 italic">Nothing to trade between these two: neither has anything the other can&apos;t get.</p>;
  }

  return (
    <>
      <p className="text-xs text-gray-500" data-testid="trade-count">{done.size} of {items.length} done</p>
      {([0, 1] as const).map((from) => {
        const mine = items.filter((item) => item.from === from);
        if (mine.length === 0) return null;
        return (
          <section key={from} className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold text-gray-100">{sides[from].label} → {sides[from === 0 ? 1 : 0].label}</h4>
            {(["exclusive", "spare", "trade-evolution"] as const).map((kind) => {
              const group = mine.filter((item) => item.kind === kind);
              if (group.length === 0) return null;
              return (
                <div key={kind} className="flex flex-col gap-1">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-2">{KIND_LABEL[kind]}</div>
                  <ul className="flex flex-col gap-1">
                    {group.map((item) => {
                      const p = pokemonMap.get(item.species);
                      const checked = done.has(item.id);
                      return (
                        <li key={item.id} className={`flex items-center gap-3 px-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 ${checked ? "opacity-50" : ""}`}>
                          <input
                            type="checkbox" checked={checked} onChange={() => toggle(item.id)}
                            aria-label={`Done: ${p?.displayName ?? item.species}`}
                            className="w-5 h-5 accent-indigo-500 flex-shrink-0 cursor-pointer"
                          />
                          {p && <img src={getGenSprite(p, generation)} alt="" loading="lazy" className="w-8 h-8 object-contain flex-shrink-0" style={{ imageRendering: "pixelated" }} />}
                          <span className={`text-sm text-gray-200 min-w-0 ${checked ? "line-through" : ""}`}>
                            {kind === "trade-evolution" ? (
                              <>
                                Send {link(item.species)} over and back to evolve it into {link(item.evolvesInto!)}
                                {item.heldItem && <span className="text-gray-400"> — holding a {item.heldItem}</span>}
                              </>
                            ) : (
                              <>
                                {kind === "exclusive" && <span className="text-yellow-400 mr-1" title="Version exclusive">★</span>}
                                Send {link(item.species)}
                                {kind === "spare" && <span className="text-gray-400"> — a spare</span>}
                              </>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>
        );
      })}
    </>
  );
}
