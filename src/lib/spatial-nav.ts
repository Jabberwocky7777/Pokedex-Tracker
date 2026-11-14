/**
 * Arrow-key movement between the items of a grid or list (tracker cells, list
 * rows, PC box slots) by where they are on screen, so it works whatever the
 * column count and across boxes laid side by side. A D-pad sends plain arrow
 * keys, so this is also how a controller walks the tracker.
 *
 * At an edge nothing is found and the key is left alone: the browser (or the
 * Android web view's own D-pad navigation) then moves on to the next control.
 */

export type Direction = "up" | "down" | "left" | "right";

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const ARROW_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * The index of the box nearest `from` in `dir`, or -1. Left and right stay on the
 * same row when they can (reading order: the end of a row goes on to the next row's
 * start); up and down prefer the box most nearly in line.
 */
export function nextInDirection(boxes: Box[], from: number, dir: Direction): number {
  const a = boxes[from];
  if (!a) return -1;
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  const sameRow = (b: Box) => Math.abs(b.top + b.height / 2 - ay) < Math.max(a.height, b.height) / 2;

  let best = -1;
  let bestScore = Infinity;
  boxes.forEach((b, i) => {
    if (i === from) return;
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    let primary: number;
    let secondary: number;
    if (dir === "left" || dir === "right") {
      if (!sameRow(b)) return;
      primary = dir === "right" ? bx - ax : ax - bx;
      secondary = Math.abs(by - ay);
    } else {
      primary = dir === "down" ? by - ay : ay - by;
      secondary = Math.abs(bx - ax);
      // Must be on another row, not just a few pixels lower
      if (primary < Math.min(a.height, b.height) / 2) return;
    }
    if (primary <= 0) return;
    const score = primary + secondary * 3;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  if (best >= 0 || dir === "up" || dir === "down") return best;

  // Reading order at the end of a row: the next row's first item, or the previous row's last
  const order = boxes.map((_, i) => i).sort((i, j) => boxes[i].top - boxes[j].top || boxes[i].left - boxes[j].left);
  const at = order.indexOf(from);
  return order[dir === "right" ? at + 1 : at - 1] ?? -1;
}

/**
 * Handles a plain arrow key inside `container`: focuses the nearest element matching
 * `selector` in that direction. Returns true when it moved (the caller prevents the default).
 */
export function moveFocus(
  container: HTMLElement,
  event: Pick<KeyboardEvent, "key" | "target" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">,
  selector: string,
): boolean {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  const dir = ARROW_DIRECTIONS[event.key];
  if (!dir) return false;
  const current = (event.target as HTMLElement).closest?.(selector);
  if (!current || !container.contains(current)) return false;
  const items = [...container.querySelectorAll<HTMLElement>(selector)].filter((el) => el.getClientRects().length > 0);
  const from = items.indexOf(current as HTMLElement);
  if (from < 0) return false;
  const to = nextInDirection(
    items.map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    }),
    from,
    dir,
  );
  if (to < 0) return false;
  items[to].focus({ preventScroll: true });
  items[to].scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}
