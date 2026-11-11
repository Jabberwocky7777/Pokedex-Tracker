/**
 * The bag of a Gen IV save: every pocket's items and quantities, merged into
 * one list of [item index, quantity] (Gen IV item indices, lib/save/tables.ts).
 *
 * Each pocket is a run of 4-byte slots (u16 item, u16 quantity) in the general
 * block, kept packed from the start. The offsets were found on and checked
 * against real saves (lib/save/__tests__/real-save.test.ts): on the Platinum
 * and SoulSilver fixtures every pocket starts exactly where the one before it
 * ends (Platinum: items 165 slots, key items 50, TMs/HMs 100, mail 12,
 * medicine 40, berries 64, Poké Balls 15, battle items 30; HG/SS has 24 ball
 * slots for the Apricorn Balls) and holds only real items. Diamond/Pearl are
 * not read: the only real D/P save checked has an empty bag.
 */
import type { Gen4Family } from "./types";

type Pocket = [start: number, slots: number];

const POCKETS: Partial<Record<Gen4Family, Pocket[]>> = {
  platinum: [
    [0x630, 165],
    [0x8c4, 50],
    [0x98c, 100],
    [0xb1c, 12],
    [0xb4c, 40],
    [0xbec, 64],
    [0xcec, 15],
    [0xd28, 30],
  ],
  hgss: [
    [0x644, 165],
    [0x8d8, 50],
    [0x9a0, 101],
    [0xb34, 12],
    [0xb64, 40],
    [0xc04, 64],
    [0xd04, 24],
    [0xd64, 30],
  ],
};

/** The highest Gen IV item index (save-tables' items4) */
const MAX_ITEM = 536;

const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);

/** [item index, quantity] for everything in the bag, or undefined where the layout isn't known. */
export function readGen4Bag(bytes: Uint8Array, general: number, family: Gen4Family): [number, number][] | undefined {
  const pockets = POCKETS[family];
  if (!pockets) return undefined;
  const counts = new Map<number, number>();
  for (const [start, slots] of pockets) {
    for (let i = 0; i < slots; i++) {
      const at = general + start + i * 4;
      if (at + 4 > bytes.length) break;
      const item = u16(bytes, at);
      const qty = u16(bytes, at + 2);
      if (item === 0) break; // pockets are packed: the first empty slot ends it
      if (item > MAX_ITEM || qty === 0 || qty > 999) continue;
      counts.set(item, (counts.get(item) ?? 0) + qty);
    }
  }
  return [...counts].sort((a, b) => a[0] - b[0]);
}
