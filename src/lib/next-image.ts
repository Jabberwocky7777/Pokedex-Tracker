import type { EncounterMethod, GameVersion } from "../types";
import { GAME_ABBR } from "../types";
import { METHOD_LABELS, METHOD_ORDER } from "../hooks/useRouteIndex";
import { whenText, type NextLocation, type NextTarget } from "./what-next";
import { areaDisplayName } from "./area-names";
import { formatDexNumber } from "./pokemon-display";

/**
 * What's next as phone-sized images — the print's alternative where there is
 * no printer (the iOS app) or a picture in the camera roll is handier than
 * paper. Drawn on a canvas in the browser; nothing is uploaded.
 *
 * `imageLines` and `paginate` are pure (tested): the routes become lines of
 * fixed heights, and the lines are cut into pages no taller than a phone
 * screenshot, a route never split unless it alone is taller than a page.
 * `drawPage` draws one page on a 2D context.
 */

export const IMAGE_WIDTH = 1080;
/** About a phone screen's shape (9 : 19.5) */
export const PAGE_HEIGHT = 2340;
const MARGIN = 48;
const HEADER = 170;
const FOOTER = 56;

export type ImageLine =
  | { kind: "route"; text: string; right: string; height: number }
  | { kind: "info"; text: string; height: number }
  | { kind: "method"; text: string; height: number }
  | { kind: "mon"; caught: boolean; unique: boolean; name: string; detail: string; games: string; height: number }
  | { kind: "gap"; height: number };

const HEIGHTS = { route: 64, info: 40, method: 52, mon: 50, gap: 28 } as const;

const abbr = (g: string) => GAME_ABBR[g as GameVersion] ?? g;
const levels = (t: NextTarget) => (t.minLevel === t.maxLevel ? `Lv ${t.minLevel}` : `Lv ${t.minLevel}–${t.maxLevel}`);

/** One route's lines: its name and count, the games, then each method with its Pokémon */
export function routeLines(loc: NextLocation, { showCaught, showGames }: { showCaught: boolean; showGames: boolean }): ImageLine[] {
  const lines: ImageLine[] = [
    { kind: "route", text: areaDisplayName(loc.displayName), right: loc.count === 0 ? "all caught" : `${loc.count} to catch`, height: HEIGHTS.route },
  ];
  const where = Object.keys(loc.perGame);
  const info = [
    `${loc.total - loc.count} of ${loc.total} caught`,
    loc.uniques > 0 ? `★ ${loc.uniques} only here` : "",
    showGames && where.length > 0 ? where.map(abbr).join(" · ") : "",
  ].filter(Boolean).join("  ·  ");
  lines.push({ kind: "info", text: info, height: HEIGHTS.info });
  const methods = [...loc.byMethod].sort((a, b) => METHOD_ORDER.indexOf(a.method) - METHOD_ORDER.indexOf(b.method));
  for (const { method, targets } of methods) {
    const shown = targets.filter((t) => showCaught || !t.caught);
    if (shown.length === 0) continue;
    lines.push({ kind: "method", text: METHOD_LABELS[method as EncounterMethod] ?? method, height: HEIGHTS.method });
    for (const t of shown) {
      lines.push({
        kind: "mon",
        caught: t.caught,
        unique: !!t.unique && !t.caught,
        name: `#${formatDexNumber(t.pokemon.id)} ${t.pokemon.displayName}`,
        detail: [levels(t), whenText(t, { short: true })].filter(Boolean).join(" · "),
        games: showGames ? t.games.map(abbr).join(" ") : "",
        height: HEIGHTS.mon,
      });
    }
  }
  return lines;
}

/**
 * Cuts the routes into pages. A route goes on the next page when it doesn't
 * fit on this one; one taller than a whole page is split between lines, its
 * name repeated as "(continued)" at the top of the next page.
 */
export function paginate(routes: ImageLine[][], pageHeight = PAGE_HEIGHT): ImageLine[][] {
  const room = pageHeight - HEADER - FOOTER;
  const pages: ImageLine[][] = [];
  let page: ImageLine[] = [];
  let used = 0;
  const flush = () => {
    if (page.length > 0) pages.push(page);
    page = [];
    used = 0;
  };
  for (const route of routes) {
    const block = [...route, { kind: "gap", height: HEIGHTS.gap } as ImageLine];
    const height = block.reduce((sum, l) => sum + l.height, 0);
    if (used > 0 && used + height > room) flush();
    if (height <= room) {
      page.push(...block);
      used += height;
      continue;
    }
    // Taller than a page: line by line
    const head = route[0];
    for (const line of block) {
      if (used + line.height > room) {
        flush();
        if (head.kind === "route") {
          page.push({ ...head, text: `${head.text} (continued)` });
          used += head.height;
        }
      }
      page.push(line);
      used += line.height;
    }
  }
  flush();
  return pages;
}

export interface ImageHeader {
  title: string;
  /** Games, methods and clock, as on the printed sheet */
  subtitle: string;
  date: string;
}

/** The page's height: its lines plus the header and footer, at least a short card */
export const pageHeightOf = (lines: ImageLine[]) =>
  Math.max(600, HEADER + lines.reduce((sum, l) => sum + l.height, 0) + FOOTER);

const COLORS = { background: "#030712", panel: "#111827", line: "#1f2937", accent: "#818cf8", done: "#34d399", star: "#fcd34d", text: "#f3f4f6", muted: "#9ca3af", faint: "#6b7280" };
const FONT = "system-ui, -apple-system, sans-serif";

/** Shortens text with an ellipsis until it fits `max` pixels */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s}…`;
}

/** Draws one page. The canvas must already be `IMAGE_WIDTH` × `pageHeightOf(lines)`. */
export function drawPage(ctx: CanvasRenderingContext2D, lines: ImageLine[], header: ImageHeader, pageNo: number, pageCount: number): void {
  const width = IMAGE_WIDTH, height = pageHeightOf(lines);
  const right = width - MARGIN;
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  ctx.fillStyle = COLORS.text;
  ctx.font = `700 46px ${FONT}`;
  ctx.fillText(fit(ctx, header.title, right - MARGIN - 160), MARGIN, 66);
  if (pageCount > 1) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = `500 28px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(`${pageNo} / ${pageCount}`, right, 66);
    ctx.textAlign = "left";
  }
  ctx.fillStyle = COLORS.muted;
  ctx.font = `500 28px ${FONT}`;
  ctx.fillText(fit(ctx, header.subtitle, right - MARGIN), MARGIN, 118);
  ctx.fillStyle = COLORS.line;
  ctx.fillRect(MARGIN, HEADER - 20, right - MARGIN, 2);

  let y = HEADER;
  for (const line of lines) {
    const mid = y + line.height / 2;
    switch (line.kind) {
      case "route": {
        ctx.font = `600 28px ${FONT}`;
        const count = line.right;
        const countWidth = ctx.measureText(count).width;
        ctx.fillStyle = COLORS.accent;
        ctx.textAlign = "right";
        ctx.fillText(count, right, mid);
        ctx.textAlign = "left";
        ctx.fillStyle = COLORS.text;
        ctx.font = `700 38px ${FONT}`;
        ctx.fillText(fit(ctx, line.text, right - MARGIN - countWidth - 24), MARGIN, mid);
        break;
      }
      case "info":
        ctx.fillStyle = COLORS.muted;
        ctx.font = `500 26px ${FONT}`;
        ctx.fillText(fit(ctx, line.text, right - MARGIN), MARGIN, mid);
        break;
      case "method":
        ctx.fillStyle = COLORS.accent;
        ctx.font = `600 26px ${FONT}`;
        ctx.fillText(line.text.toUpperCase(), MARGIN, mid + 4);
        break;
      case "mon": {
        // A tick box: ticked green when caught
        const box = 30, bx = MARGIN, by = mid - box / 2;
        ctx.strokeStyle = line.caught ? COLORS.done : COLORS.faint;
        ctx.lineWidth = 3;
        ctx.strokeRect(bx, by, box, box);
        if (line.caught) {
          ctx.strokeStyle = COLORS.done;
          ctx.beginPath();
          ctx.moveTo(bx + 7, mid + 1);
          ctx.lineTo(bx + 13, mid + 8);
          ctx.lineTo(bx + 24, mid - 8);
          ctx.stroke();
        }
        // Right side first, so the name gets what is left
        ctx.font = `500 26px ${FONT}`;
        const detail = line.games ? `${line.detail}  ${line.games}` : line.detail;
        const detailMax = (right - MARGIN) * 0.55;
        const detailText = fit(ctx, detail, detailMax);
        const detailWidth = ctx.measureText(detailText).width;
        ctx.fillStyle = line.caught ? COLORS.faint : COLORS.muted;
        ctx.textAlign = "right";
        ctx.fillText(detailText, right, mid);
        ctx.textAlign = "left";
        let x = bx + box + 18;
        if (line.unique) {
          ctx.fillStyle = COLORS.star;
          ctx.font = `700 28px ${FONT}`;
          ctx.fillText("★", x, mid);
          x += ctx.measureText("★ ").width;
        }
        ctx.fillStyle = line.caught ? COLORS.faint : COLORS.text;
        ctx.font = `${line.caught ? 400 : 600} 30px ${FONT}`;
        ctx.fillText(fit(ctx, line.name, right - detailWidth - 24 - x), x, mid);
        break;
      }
      case "gap":
        ctx.fillStyle = COLORS.line;
        ctx.fillRect(MARGIN, mid, right - MARGIN, 1);
        break;
    }
    y += line.height;
  }

  ctx.fillStyle = COLORS.faint;
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText(`Pokédex Tracker · ${header.date}`, MARGIN, height - FOOTER / 2);
}
