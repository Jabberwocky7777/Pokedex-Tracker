import { describe, expect, it } from "vitest";
import { localizeSprites } from "../bundled-sprites";
import type { Pokemon } from "../../types";

const REMOTE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/";

function mon(id: number): Pokemon {
  return {
    id,
    spriteUrl: `${REMOTE}pokemon/${id}.png`,
    gen3Sprite: `${REMOTE}pokemon/versions/generation-iii/firered-leafgreen/${id}.png`,
    gen4Sprite: `${REMOTE}pokemon/versions/generation-iv/heartgold-soulsilver/${id}.png`,
  } as Pokemon;
}

describe("localizeSprites", () => {
  it("points every bundled sprite at its copy in the app", () => {
    const bundled = new Set([
      "pokemon/6.png",
      "pokemon/versions/generation-iii/firered-leafgreen/6.png",
      "pokemon/versions/generation-iii/firered-leafgreen/shiny/6.png",
      "pokemon/versions/generation-iv/heartgold-soulsilver/6.png",
      "pokemon/versions/generation-iv/heartgold-soulsilver/shiny/6.png",
    ]);
    const [p] = localizeSprites([mon(6)], bundled);
    expect(p.spriteUrl).toBe("/sprites/pokemon/6.png");
    expect(p.gen3Sprite).toBe("/sprites/pokemon/versions/generation-iii/firered-leafgreen/6.png");
    expect(p.gen4Sprite).toBe("/sprites/pokemon/versions/generation-iv/heartgold-soulsilver/6.png");
  });

  it("leaves a generation sprite on GitHub when its shiny isn't bundled, and anything not bundled", () => {
    const bundled = new Set(["pokemon/versions/generation-iv/heartgold-soulsilver/6.png"]);
    const [p] = localizeSprites([mon(6)], bundled);
    expect(p.spriteUrl).toBe(`${REMOTE}pokemon/6.png`);
    expect(p.gen4Sprite).toBe(`${REMOTE}pokemon/versions/generation-iv/heartgold-soulsilver/6.png`);
  });

  it("keeps a missing generation sprite missing", () => {
    const [p] = localizeSprites([{ ...mon(400), gen3Sprite: null }], new Set());
    expect(p.gen3Sprite).toBeNull();
  });
});
