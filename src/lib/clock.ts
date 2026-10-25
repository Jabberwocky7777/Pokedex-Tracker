/**
 * The clock sync timestamps are written with.
 *
 * Every mark, entry and section carries the time it was changed, and the merge
 * keeps the newer side — so a device whose clock runs ahead would win every
 * conflict, and its edits could only be overridden once real time caught up.
 * The sync server says its own time with each pull; `noteServerTime()` keeps the
 * difference, and `stampNow()` writes times on the server's clock instead.
 *
 * `stampNow(previous)` is also never earlier than the stamp it replaces: when
 * the correction moves the clock back, a new edit must still beat this
 * device's own earlier edit of the same thing, or the merge would undo it.
 *
 * Kept free of imports: the stores use it, and they load with the app.
 */

const OFFSET_KEY = "pokedex_clock_offset";
// A pull slower than this says too little about when the server read its clock
const MAX_ROUND_TRIP_MS = 10_000;

function readOffset(): number {
  try {
    const value = Number(localStorage.getItem(OFFSET_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

let offset = readOffset();

/** Server time minus device time, in ms (0 until a sync has measured it). */
export function clockOffset(): number {
  return offset;
}

/** Now, on the sync server's clock. At least `previous + 1` when given. */
export function stampNow(previous?: number): number {
  const now = Date.now() + offset;
  return previous !== undefined && previous >= now ? previous + 1 : now;
}

/**
 * Called with the server's time from a pull and when the request left and the
 * answer came back (device clock). The server read its clock somewhere in
 * between; the midpoint is the best guess.
 */
export function noteServerTime(serverTime: unknown, sentAt: number, receivedAt: number): void {
  if (typeof serverTime !== "number" || !Number.isFinite(serverTime)) return;
  if (receivedAt < sentAt || receivedAt - sentAt > MAX_ROUND_TRIP_MS) return;
  offset = Math.round(serverTime - (sentAt + receivedAt) / 2);
  try {
    localStorage.setItem(OFFSET_KEY, String(offset));
  } catch {
    // Storage unavailable: the offset still holds for this session
  }
}

/** For tests: back to the device's own clock. */
export function resetClockOffset(): void {
  offset = 0;
  try { localStorage.removeItem(OFFSET_KEY); } catch { /* ignore */ }
}
