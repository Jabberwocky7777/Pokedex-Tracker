import type { GameVersion } from "../../types";
import { GAME_LABELS } from "../../types";
import { GAME_PROGRESS } from "../../data/game-progress";
import { badgeCount, milestoneWhen, type GameProgress } from "../../lib/game-progress";
import { PrintBox, PrintButton, PrintSheet } from "../print/Print";

interface Props {
  games: string[];
  progressOf: (game: string) => GameProgress | undefined;
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const dateText = (ms: number) => new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

/** One black-and-white page: every selected game's badges and milestones as tick boxes. */
export default function GameProgressPrint({ games, progressOf }: Props) {
  const label = games.map((g) => GAME_LABELS[g as GameVersion] ?? g).join(", ");
  return (
    <PrintButton
      label="Print"
      summary={<p>Badges and milestones for {label}, as tick boxes — ticked where you have them already.</p>}
      sheet={
        <PrintSheet title="Game progress" games={label}>
          <div className="p-progress-grid">
            {games.map((game) => {
              const def = GAME_PROGRESS[game as GameVersion]!;
              const progress = progressOf(game);
              const { earned, total } = badgeCount(game, progress);
              return (
                <section key={game} className="p-block">
                  <div className="p-route-head">
                    <h2>{GAME_LABELS[game as GameVersion] ?? game}</h2>
                    <span className="p-route-count">{earned}/{total} badges</span>
                  </div>
                  <ul className="p-badges">
                    {def.badges.map((b) => (
                      <li key={b.id} className="p-row p-small">
                        <PrintBox checked={progress?.badges.includes(b.id)} />
                        <span>{b.name}{b.region ? ` (${b.region})` : ""} <span className="p-muted">· {b.leader}</span></span>
                      </li>
                    ))}
                  </ul>
                  <ul>
                    {def.milestones.map((m) => {
                      const state = progress?.milestones[m.id];
                      return (
                        <li key={m.id} className="p-row p-small">
                          <PrintBox checked={state?.done} />
                          <span>
                            <strong>{m.label}</strong>
                            <span className="p-muted"> · {state?.done ? lowerFirst(milestoneWhen(state, dateText)) : m.detail}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </PrintSheet>
      }
    />
  );
}
