/**
 * The game's own Pokédex: which species the player has seen and caught, as the
 * game records them. The tracker's marks come from what is in the boxes; this
 * adds "seen" (what unlocks the National Pokédex in Sinnoh) and species caught
 * once and since released or traded away.
 *
 * Gen IV keeps it in the general block as a struct that starts with the magic
 * 0xBEEFCAFE, then the caught bits (16 u32, species n at bit n-1) and the seen
 * bits (16 u32) — pokeplatinum's Pokedex struct. The offsets below were found
 * and checked on real saves (lib/save/__tests__/real-save.test.ts): on the
 * Platinum fixture the caught bits include every species in its boxes and
 * party (142 caught, 136 held) and every caught species is also seen; the same
 * on the SoulSilver fixture; Diamond/Pearl's offset was found on an empty Pearl
 * save (magic only). If the magic isn't there, nothing is read.
 * Gen III is not read: there is no real Gen III save with Pokémon to check it on.
 */
import type { Gen4Family } from "./types";

const MAGIC = 0xbeefcafe;
/** Offset of the Pokédex struct within the general block */
const GEN4_OFFSET: Record<Gen4Family, number> = { platinum: 0x1328, hgss: 0x12b8, dp: 0x12dc };
const MAX_SPECIES = 493;
const BYTES = 64;

export interface SavePokedex {
  /** National dex numbers, ascending */
  caught: number[];
  seen: number[];
}

const u32 = (b: Uint8Array, at: number) => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;

function bitsToSpecies(bytes: Uint8Array, start: number): number[] {
  const out: number[] = [];
  for (let species = 1; species <= MAX_SPECIES; species++) {
    if (bytes[start + ((species - 1) >> 3)] & (1 << ((species - 1) & 7))) out.push(species);
  }
  return out;
}

/** The Pokédex of a Gen IV save, from the general block at `general`; undefined when it isn't where it should be. */
export function readGen4Pokedex(bytes: Uint8Array, general: number, family: Gen4Family): SavePokedex | undefined {
  const at = general + GEN4_OFFSET[family];
  if (at + 4 + 2 * BYTES > bytes.length || u32(bytes, at) !== MAGIC) return undefined;
  return { caught: bitsToSpecies(bytes, at + 4), seen: bitsToSpecies(bytes, at + 4 + BYTES) };
}

/** Species → a hex bit string (62 bytes for 493 species), for the synced save summary. */
export function encodeDex(species: number[]): string {
  const bytes = new Uint8Array(Math.ceil(MAX_SPECIES / 8));
  for (const s of species) if (s >= 1 && s <= MAX_SPECIES) bytes[(s - 1) >> 3] |= 1 << ((s - 1) & 7);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The reverse of encodeDex; anything that isn't hex reads as nothing. */
export function decodeDex(hex: string): number[] {
  if (!/^(?:[0-9a-f]{2})*$/.test(hex)) return [];
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bitsToSpecies(bytes, 0).filter((s) => (s - 1) >> 3 < bytes.length);
}
