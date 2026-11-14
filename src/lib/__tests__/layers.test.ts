import { afterEach, describe, expect, it, vi } from "vitest";
import { closeTopLayer, hasOpenLayer, pushLayer, resetLayersForTest } from "../layers";

afterEach(() => resetLayersForTest());

describe("layers", () => {
  it("closes the most recently opened layer first", () => {
    const first = vi.fn();
    const second = vi.fn();
    pushLayer({ close: first });
    pushLayer({ close: second });
    expect(closeTopLayer()).toBe(true);
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
  });

  it("skips a layer that is open but out of sight", () => {
    const visible = vi.fn();
    const hidden = vi.fn();
    pushLayer({ close: visible });
    pushLayer({ close: hidden, isVisible: () => false });
    closeTopLayer();
    expect(visible).toHaveBeenCalledOnce();
    expect(hidden).not.toHaveBeenCalled();
  });

  it("reports nothing to close once every layer is removed", () => {
    const remove = pushLayer({ close: () => {} });
    expect(hasOpenLayer()).toBe(true);
    remove();
    remove(); // twice is harmless
    expect(hasOpenLayer()).toBe(false);
    expect(closeTopLayer()).toBe(false);
  });
});
