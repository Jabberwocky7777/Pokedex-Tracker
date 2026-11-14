import { SaveParseError } from "./types";

/**
 * The step in front of parseSave() for saves written by emulators. Every
 * emulator this app meets (melonDS and its dual-screen fork, DraStic, DeSmuME,
 * RetroArch, mGBA, Pizza Boy) writes the game's battery save as raw bytes,
 * sometimes with a few bytes added at the end. This takes those off, and turns
 * a format the readers can't use into a message that says what to change.
 *
 * Games are identified by content (block footers and checksums, in the readers),
 * never by file extension: .sav, .srm, .dsv and .dat are all the same raw bytes.
 */

const KB = 1024;
const GEN4_SIZE = 512 * KB;
const GBA_SIZE = 128 * KB;
/** Some GBA emulators append real-time-clock data (16 bytes in mGBA) or similar */
const GBA_TAIL_MAX = 4 * KB;

/** DeSmuME's .dsv footer: 122 bytes that start with this text */
const DESMUME_MARKER = "|<--Snip above here";
export const DESMUME_FOOTER_SIZE = 122;

/** RetroArch's SaveRAM compression ("rzip"), off by default */
const RZIP_MAGIC = "#RZIPv";

const ascii = (bytes: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...bytes.subarray(at, at + length));

export interface Unwrapped {
  /** The raw save, without any container */
  bytes: Uint8Array;
  /** What was taken off, for a note in the import review; empty for a plain save */
  removed: string[];
}

/** Takes an emulator's additions off a save file. Throws SaveParseError for formats that can't be read. */
export function unwrapSave(input: Uint8Array): Unwrapped {
  if (input.length >= RZIP_MAGIC.length && ascii(input, 0, RZIP_MAGIC.length) === RZIP_MAGIC) {
    throw new SaveParseError(
      "This save was compressed by RetroArch. In RetroArch, turn off Settings → Saving → SaveRAM Compression, " +
        "save again in the game, then import the new file.",
    );
  }

  let bytes = input;
  const removed: string[] = [];

  const footerAt = bytes.length - DESMUME_FOOTER_SIZE;
  if (footerAt >= 0 && ascii(bytes, footerAt, DESMUME_MARKER.length) === DESMUME_MARKER) {
    bytes = bytes.subarray(0, footerAt);
    removed.push("DeSmuME footer");
  }

  // A GBA save with a short tail: keep the 128 KB the game wrote
  if (bytes.length > GBA_SIZE && bytes.length <= GBA_SIZE + GBA_TAIL_MAX) {
    bytes = bytes.subarray(0, GBA_SIZE);
    removed.push("emulator data after the save");
  }
  // The same for a DS save (the readers only use the first 512 KB anyway)
  if (bytes.length > GEN4_SIZE && bytes.length <= GEN4_SIZE + GBA_TAIL_MAX) {
    bytes = bytes.subarray(0, GEN4_SIZE);
    removed.push("emulator data after the save");
  }

  return { bytes, removed };
}
