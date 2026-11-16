/**
 * Puts the sprites the app shows into dist/sprites/, for the iOS and Android apps:
 * a browser keeps sprites in its service worker, but the apps have none, and
 * GitHub lets a sprite be kept for only 5 minutes, so the apps downloaded the
 * same hundreds of images again and again (docs/android.md, "Sprites").
 *
 *   npm run build && npm run fetch-sprites && npx cap sync android
 *
 * Every Pokémon's default, Gen 3 (FR/LG) and Gen 4 (HG/SS) sprite and the two shiny
 * sets, from PokéAPI's sprites repository at POKEAPI_SPRITES_COMMIT. Downloads are
 * kept in node_modules/.cache/sprites (CI caches that folder), so a second run is
 * a copy. dist/sprites/manifest.json lists what is there: src/lib/bundled-sprites.ts
 * points a sprite at its bundled copy only when the manifest has it. The images
 * are never committed.
 */
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { POKEAPI_SPRITES_COMMIT } from "./constants";

/** How sprite URLs in pokemon.json start; the rest is the path kept under dist/sprites/ */
const REMOTE_PREFIX = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/";
const SOURCE = `https://raw.githubusercontent.com/PokeAPI/sprites/${POKEAPI_SPRITES_COMMIT}/sprites/`;
const CACHE = path.join("node_modules", ".cache", "sprites", POKEAPI_SPRITES_COMMIT);
const OUT = path.join("dist", "sprites");
const CONCURRENCY = 12;
/** A few missing files are tolerated (they stay on GitHub); more means something is wrong */
const MAX_MISSING = 20;

interface SpriteFields {
  spriteUrl: string;
  gen3Sprite: string | null;
  gen4Sprite: string | null;
}

/** The shiny sprite beside a generation sprite, as lib/pokemon-display.ts derives it */
const shinyOf = (url: string) => url.replace(/\/(\d+\.png)$/, "/shiny/$1");

function wanted(pokemon: SpriteFields[]): string[] {
  const urls = new Set<string>();
  for (const p of pokemon) {
    urls.add(p.spriteUrl);
    for (const url of [p.gen3Sprite, p.gen4Sprite]) {
      if (!url) continue;
      urls.add(url);
      urls.add(shinyOf(url));
    }
  }
  return [...urls]
    .filter((url) => url.startsWith(REMOTE_PREFIX))
    .map((url) => url.slice(REMOTE_PREFIX.length))
    .sort();
}

const PNG = [0x89, 0x50, 0x4e, 0x47];

async function exists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).size > 0;
  } catch {
    return false;
  }
}

/** Downloads one sprite into the cache; false if GitHub hasn't got it */
async function download(rel: string): Promise<boolean> {
  const target = path.join(CACHE, rel);
  if (await exists(target)) return true;
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(SOURCE + rel);
      if (res.status === 404) return false;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (!PNG.every((b, i) => bytes[i] === b)) throw new Error("not a PNG");
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
      return true;
    } catch (error) {
      if (attempt >= 4) throw new Error(`${rel}: ${(error as Error).message}`, { cause: error });
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function main() {
  if (!(await exists(path.join("dist", "index.html")))) throw new Error("Run npm run build first: dist/ is missing.");
  const pokemon = JSON.parse(await readFile(path.join("public", "data", "pokemon.json"), "utf8")) as SpriteFields[];
  const files = wanted(pokemon);

  const missing: string[] = [];
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < files.length) {
      const rel = files[next++];
      if (!(await download(rel))) missing.push(rel);
      if (++done % 250 === 0) console.log(`  ${done} / ${files.length}`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (missing.length > MAX_MISSING) {
    throw new Error(
      `${missing.length} sprites are missing at ${POKEAPI_SPRITES_COMMIT}, e.g. ${missing.slice(0, 5).join(", ")}`,
    );
  }

  const present = files.filter((rel) => !missing.includes(rel));
  for (const rel of present) {
    const target = path.join(OUT, rel);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(CACHE, rel), target);
  }
  await writeFile(path.join(OUT, "manifest.json"), JSON.stringify({ commit: POKEAPI_SPRITES_COMMIT, files: present }));
  console.log(
    `Bundled ${present.length} sprites in dist/sprites` + (missing.length ? ` (${missing.length} not on GitHub)` : ""),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
