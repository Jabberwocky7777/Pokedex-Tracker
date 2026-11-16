/**
 * The iOS and Android apps can carry the sprites inside the app (dist/sprites/,
 * written by scripts/fetch-sprites.ts when the app is built). Then each Pokémon's
 * sprite URLs are pointed at those copies when pokemon.json loads, so every view
 * shows them at once and offline without changing. A browser keeps loading them
 * from GitHub (its service worker keeps them), and so does an app built without them.
 */
import type { Pokemon } from "../types";
import { IS_NATIVE } from "./platform";

/** How sprite URLs in pokemon.json start; the rest is the path under /sprites/ */
const REMOTE_PREFIX = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/";
const LOCAL_PREFIX = "/sprites/";

/** The shiny sprite beside a generation sprite, as getGenShinySprite derives it */
const shinyOf = (url: string) => url.replace(/\/(\d+\.png)$/, "/shiny/$1");

/**
 * Points each sprite URL that has a bundled copy at it. A Gen 3 or Gen 4 sprite moves
 * only with its shiny, which is derived from it, so a missing shiny never breaks.
 */
export function localizeSprites(pokemon: Pokemon[], bundled: ReadonlySet<string>): Pokemon[] {
  const rel = (url: string) => (url.startsWith(REMOTE_PREFIX) ? url.slice(REMOTE_PREFIX.length) : null);
  const local = (url: string) => {
    const path = rel(url);
    return path !== null && bundled.has(path) ? LOCAL_PREFIX + path : url;
  };
  const withShiny = (url: string | null) => {
    if (!url) return url;
    const path = rel(url);
    const shiny = rel(shinyOf(url));
    return path !== null && shiny !== null && bundled.has(path) && bundled.has(shiny) ? LOCAL_PREFIX + path : url;
  };
  return pokemon.map((p) => ({
    ...p,
    spriteUrl: local(p.spriteUrl),
    gen3Sprite: withShiny(p.gen3Sprite),
    gen4Sprite: withShiny(p.gen4Sprite),
  }));
}

/** In the apps, the loaded Pokémon with their bundled sprites; unchanged anywhere else */
export async function withBundledSprites(pokemon: Pokemon[]): Promise<Pokemon[]> {
  if (!IS_NATIVE) return pokemon;
  try {
    const res = await fetch(`${LOCAL_PREFIX}manifest.json`);
    if (!res.ok) return pokemon;
    const manifest = (await res.json()) as { files?: unknown };
    if (!Array.isArray(manifest.files)) return pokemon;
    return localizeSprites(pokemon, new Set(manifest.files.filter((f): f is string => typeof f === "string")));
  } catch {
    return pokemon;
  }
}
