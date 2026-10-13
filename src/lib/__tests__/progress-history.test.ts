import { describe, expect, it } from "vitest";
import { byMonth, catchHistory, caughtCount, caughtSince, cumulativeSeries, milestones, WEEK_MS } from "../progress-history";

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date(2026, 8, 1, 12).getTime(); // 1 Sep 2026, local
const scope = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("catchHistory", () => {
  it("orders dated catches, counts undated ones, and ignores what isn't caught or in scope", () => {
    const history = catchHistory(scope(10), new Set([1, 2, 3, 4, 99]), { 1: T0 + 2 * DAY, 2: T0, 3: 0, 5: T0, 99: T0 });
    expect(history.events).toEqual([{ id: 2, at: T0 }, { id: 1, at: T0 + 2 * DAY }]);
    expect(history.undated).toBe(2); // #3 (time 0) and #4 (no entry)
    expect(caughtCount(history)).toBe(4);
    expect(history.total).toBe(10);
  });

  it("starts the running total after the undated catches", () => {
    const history = catchHistory(scope(10), new Set([1, 2, 3]), { 1: T0, 2: T0 + DAY });
    expect(cumulativeSeries(history)).toEqual([{ at: T0, count: 2, id: 1 }, { at: T0 + DAY, count: 3, id: 2 }]);
  });

  it("works with no timestamps at all", () => {
    const history = catchHistory(scope(5), new Set([1, 2]), undefined);
    expect([history.events.length, history.undated]).toEqual([0, 2]);
    expect(cumulativeSeries(history)).toEqual([]);
  });
});

describe("this week", () => {
  it("counts catches in the seven days before a fixed clock", () => {
    const now = T0 + 30 * DAY;
    const history = catchHistory(scope(10), new Set([1, 2, 3, 4]), { 1: now - 8 * DAY, 2: now - WEEK_MS, 3: now - DAY, 4: 0 });
    expect(caughtSince(history, now - WEEK_MS)).toBe(2);
  });
});

describe("milestones", () => {
  const stampAll = (n: number) => Object.fromEntries(scope(n).map((id) => [id, T0 + id * DAY]));

  it("lists the steps reached so far, newest first", () => {
    const history = catchHistory(scope(493), new Set(scope(120)), stampAll(120));
    expect(milestones(history, "Generation IV").map((m) => m.label)).toEqual(["100th catch", "50th catch", "25th catch", "10th catch", "1st catch"]);
    const hundredth = milestones(history, "Generation IV")[0];
    expect([hundredth.id, hundredth.at]).toEqual([100, T0 + 100 * DAY]);
  });

  it("adds completion, dated by the last catch", () => {
    const history = catchHistory(scope(151), new Set(scope(151)), stampAll(151));
    const list = milestones(history, "DP Pokédex");
    expect(list[0]).toEqual({ label: "DP Pokédex complete", at: T0 + 151 * DAY, id: 151 });
    expect(list.map((m) => m.label)).toContain("150th catch");
    expect(list.map((m) => m.label)).not.toContain("151st catch");
  });

  it("has no date for a milestone that falls among the undated catches", () => {
    // 30 undated, then 5 dated: the 25th is undated, the 31st.. are dated
    const caught = new Set(scope(35));
    const stamps = Object.fromEntries([31, 32, 33, 34, 35].map((id) => [id, T0 + id * DAY]));
    const list = milestones(catchHistory(scope(100), caught, stamps), "Dex");
    expect(list.map((m) => [m.label, m.at])).toEqual([["25th catch", null], ["10th catch", null], ["1st catch", null]]);
  });

  it("is empty before the first catch", () => {
    expect(milestones(catchHistory(scope(10), new Set(), {}), "Dex")).toEqual([]);
  });
});

describe("byMonth", () => {
  it("groups by calendar month with a running total", () => {
    const history = catchHistory(scope(10), new Set([1, 2, 3, 4]), { 1: T0, 2: T0 + DAY, 3: T0 + 40 * DAY });
    expect(byMonth(history)).toEqual([{ month: "2026-09", count: 2, total: 3 }, { month: "2026-10", count: 1, total: 4 }]);
  });
});
