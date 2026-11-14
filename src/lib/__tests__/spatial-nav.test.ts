import { describe, expect, it } from "vitest";
import { nextInDirection, type Box } from "../spatial-nav";

// Two boxes of 3 × 2 cells side by side, 10 px cells with 2 px gaps, 20 px between boxes
function grid(): Box[] {
  const boxes: Box[] = [];
  for (const boxLeft of [0, 56])
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 3; col++) boxes.push({ left: boxLeft + col * 12, top: row * 12, width: 10, height: 10 });
  return boxes;
}

describe("nextInDirection", () => {
  const g = grid();
  // indices: box A row 0 = 0,1,2; row 1 = 3,4,5; box B row 0 = 6,7,8; row 1 = 9,10,11

  it("moves along a row and between rows", () => {
    expect(nextInDirection(g, 0, "right")).toBe(1);
    expect(nextInDirection(g, 1, "left")).toBe(0);
    expect(nextInDirection(g, 1, "down")).toBe(4);
    expect(nextInDirection(g, 4, "up")).toBe(1);
  });

  it("crosses into the box beside it on the same row", () => {
    expect(nextInDirection(g, 2, "right")).toBe(6);
    expect(nextInDirection(g, 9, "left")).toBe(5);
  });

  it("wraps to the next row at the far right, and stops at the very end", () => {
    expect(nextInDirection(g, 8, "right")).toBe(3);
    expect(nextInDirection(g, 11, "right")).toBe(-1);
    expect(nextInDirection(g, 0, "left")).toBe(-1);
  });

  it("finds nothing past the top and bottom edges, so the key goes on to the next control", () => {
    expect(nextInDirection(g, 1, "up")).toBe(-1);
    expect(nextInDirection(g, 4, "down")).toBe(-1);
  });

  it("goes down to the nearest item in line when the next row is shorter", () => {
    const rows: Box[] = [
      { left: 0, top: 0, width: 10, height: 10 },
      { left: 12, top: 0, width: 10, height: 10 },
      { left: 24, top: 0, width: 10, height: 10 },
      { left: 0, top: 12, width: 10, height: 10 },
    ];
    expect(nextInDirection(rows, 2, "down")).toBe(3);
  });
});
