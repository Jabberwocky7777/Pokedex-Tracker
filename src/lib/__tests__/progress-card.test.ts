import { describe, expect, it } from "vitest";
import { CARD_WIDTH, cardLayout, drawCard, percent, type CardData } from "../progress-card";

describe("progress card layout", () => {
  it("lays the sprites out in rows inside the card", () => {
    const layout = cardLayout(4, 120);
    expect(layout.width).toBe(CARD_WIDTH);
    expect(layout.sprites).toHaveLength(120);
    expect(layout.columns).toBe(14);
    // First row, then the next row starts back at the left
    expect(layout.sprites[0].y).toBe(layout.sprites[13].y);
    expect(layout.sprites[14]).toEqual({ x: layout.sprites[0].x, y: layout.sprites[0].y + 68 });
    for (const { x, y } of layout.sprites) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + 64).toBeLessThanOrEqual(CARD_WIDTH);
      expect(y + 64).toBeLessThan(layout.height);
    }
    // The grid is centred
    const last = layout.sprites[13];
    expect(layout.sprites[0].x).toBe(CARD_WIDTH - (last.x + 64));
  });

  it("grows with what there is to show, and stands with nothing caught", () => {
    expect(cardLayout(4, 493).height).toBeGreaterThan(cardLayout(4, 120).height);
    expect(cardLayout(6, 10).gridTop).toBeGreaterThan(cardLayout(4, 10).gridTop);
    const empty = cardLayout(1, 0);
    expect(empty.sprites).toEqual([]);
    expect(empty.height).toBeGreaterThan(empty.gridTop);
  });

  it("rounds a percentage down, so 100% means all of them", () => {
    expect(percent({ name: "", caught: 492, total: 493 })).toBe(99);
    expect(percent({ name: "", caught: 493, total: 493 })).toBe(100);
    expect(percent({ name: "", caught: 0, total: 0 })).toBe(0);
  });
});

describe("drawCard", () => {
  it("draws the title, the numbers, a bar per dex and every sprite that loaded", () => {
    const calls: { text: string[]; images: number; rects: number } = { text: [], images: 0, rects: 0 };
    const ctx = {
      fillRect: () => { calls.rects++; },
      fillText: (text: string) => { calls.text.push(text); },
      measureText: () => ({ width: 200 }),
      drawImage: () => { calls.images++; },
    } as unknown as CanvasRenderingContext2D;
    const data: CardData = {
      title: "Generation IV", date: "12 Oct 2026",
      dexes: [{ name: "Generation IV", caught: 120, total: 493 }, { name: "DP Pokédex", caught: 151, total: 151 }],
      sprites: ["a", "b", "c"],
    };
    drawCard(ctx, data, cardLayout(2, 3), [{} as CanvasImageSource, null, {} as CanvasImageSource]);
    expect(calls.text).toEqual(expect.arrayContaining(["Generation IV", "24%", "120 / 493 caught", "DP Pokédex", "151/151 · 100%", "Pokédex Tracker · 12 Oct 2026"]));
    // Two of three sprites loaded; the third keeps its empty tile
    expect(calls.images).toBe(2);
    expect(calls.rects).toBeGreaterThanOrEqual(1 + 2 * 2 + 3);
  });
});
