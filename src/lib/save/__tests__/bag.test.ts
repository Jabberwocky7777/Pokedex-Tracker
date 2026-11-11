import { describe, expect, it } from "vitest";
import { readGen4Bag } from "../bag";
import { toSummary } from "../summary";

const slot = (bytes: Uint8Array, at: number, item: number, qty: number) =>
  bytes.set([item & 0xff, item >> 8, qty & 0xff, qty >> 8], at);

describe("the bag", () => {
  it("reads every pocket up to its first empty slot and adds up repeats", () => {
    const bytes = new Uint8Array(0x1000);
    slot(bytes, 0x630, 81, 2); // items: Fire Stone ×2
    slot(bytes, 0x634, 0, 0); // end of the pocket
    slot(bytes, 0x638, 82, 9); // after the end: ignored
    slot(bytes, 0xcec, 1, 1); // balls: Master Ball
    slot(bytes, 0xb4c, 81, 1); // a second Fire Stone, in another pocket
    expect(readGen4Bag(bytes, 0, "platinum")).toEqual([
      [1, 1],
      [81, 3],
    ]);
  });

  it("isn't read where the layout isn't checked (Diamond/Pearl)", () => {
    expect(readGen4Bag(new Uint8Array(0x1000), 0, "dp")).toBeUndefined();
  });

  it("travels in the synced summary", () => {
    expect(toSummary({ boxNames: [], mons: [], bag: [[81, 2]] }).bag).toEqual([[81, 2]]);
  });
});
