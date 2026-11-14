import { unwrapSave } from "./container";
import { GBA_SAVE_SIZE, parseGen3Save } from "./gen3";
import { parseGen4Save, SAVE_SIZE } from "./gen4";
import { SaveParseError, type ParsedSave } from "./types";

/** The games the readers know, for messages about files they don't */
export const TRACKED_GAMES =
  "Diamond, Pearl, Platinum, HeartGold and SoulSilver (DS), and Ruby, Sapphire, Emerald, FireRed and LeafGreen (Game Boy Advance)";

/**
 * Reads any supported save dump or emulator save (.sav, .srm, .dsv: the format
 * is found from the contents, never the name). An emulator's footer or extra
 * bytes are taken off first (container.ts); then the size picks the reader:
 * 512 KB is a DS (Gen IV) save, 128 KB a Game Boy Advance (Gen III) one.
 * Throws SaveParseError with a message fit to show the user.
 */
export function parseSave(input: Uint8Array): ParsedSave {
  const { bytes } = unwrapSave(input);
  if (bytes.length >= SAVE_SIZE) return parseGen4Save(bytes);
  if (bytes.length >= GBA_SAVE_SIZE) return parseGen3Save(bytes);
  // Game Boy and Game Boy Color games (Red to Crystal) have 32 KB saves
  if (bytes.length >= 32 * 1024 && bytes.length <= 33 * 1024) {
    throw new SaveParseError(
      `This looks like a Game Boy save (Red, Blue, Yellow, Gold, Silver or Crystal), which this app doesn't read. It reads ${TRACKED_GAMES}.`,
    );
  }
  throw new SaveParseError(
    "This file is too small to be a save from a game this app tracks. DS saves (Diamond, Pearl, Platinum, HeartGold, " +
      "SoulSilver) are 512 KB and Game Boy Advance saves (Ruby, Sapphire, Emerald, FireRed, LeafGreen) are 128 KB, " +
      "whether dumped from a cartridge or written by an emulator — .nds and .gba files are the games themselves.",
  );
}
