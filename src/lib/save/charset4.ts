/**
 * Gen IV text encoding: 16-bit codes, terminated by 0xFFFF. Only the Latin
 * subset is mapped; everything else decodes to "?" and is counted, so callers
 * can tell a Japanese/Korean name from a real one.
 */

const TERMINATOR = 0xffff;
const UNKNOWN = "?";

const PUNCTUATION: Record<number, string> = {
  0x01ab: "!",
  0x01ac: "?",
  0x01ad: ",",
  0x01ae: ".",
  0x01af: "…",
  0x01b1: "/",
  0x01b3: "’",
  0x01b9: "(",
  0x01ba: ")",
  0x01bb: "♂",
  0x01bc: "♀",
  0x01be: "-",
  0x01de: " ",
};

function decodeChar(code: number): string | null {
  if (code >= 0x0121 && code <= 0x012a) return String.fromCharCode(0x30 + code - 0x0121);
  if (code >= 0x012b && code <= 0x0144) return String.fromCharCode(0x41 + code - 0x012b);
  if (code >= 0x0145 && code <= 0x015e) return String.fromCharCode(0x61 + code - 0x0145);
  return PUNCTUATION[code] ?? null;
}

export interface DecodedText {
  text: string;
  /** More than half the characters had no mapping — show a fallback instead of this text. */
  unsupported: boolean;
}

/** Decodes up to `maxChars` 16-bit little-endian characters starting at `offset`. */
export function decodeText(bytes: Uint8Array, offset: number, maxChars: number): DecodedText {
  let text = "";
  let unknown = 0;
  for (let i = 0; i < maxChars; i++) {
    const at = offset + i * 2;
    if (at + 1 >= bytes.length) break;
    const code = bytes[at] | (bytes[at + 1] << 8);
    if (code === TERMINATOR) break;
    // A zero code only appears in unused, never-written name buffers
    if (code === 0) break;
    const ch = decodeChar(code);
    if (ch === null) unknown++;
    text += ch ?? UNKNOWN;
  }
  return { text, unsupported: text.length > 0 && unknown * 2 > text.length };
}

/** Inverse of decodeText for the mapped subset — used to build synthetic saves in tests. */
export function encodeText(text: string, maxChars: number): Uint8Array {
  const reverse = new Map<string, number>(Object.entries(PUNCTUATION).map(([code, ch]) => [ch, Number(code)]));
  const out = new Uint8Array(maxChars * 2);
  const chars = Array.from(text).slice(0, maxChars - 1);
  const codes = chars.map((ch) => {
    const c = ch.charCodeAt(0);
    if (c >= 0x30 && c <= 0x39) return 0x0121 + c - 0x30;
    if (c >= 0x41 && c <= 0x5a) return 0x012b + c - 0x41;
    if (c >= 0x61 && c <= 0x7a) return 0x0145 + c - 0x61;
    return reverse.get(ch) ?? 0x01ac;
  });
  codes.push(TERMINATOR);
  codes.forEach((code, i) => {
    out[i * 2] = code & 0xff;
    out[i * 2 + 1] = code >> 8;
  });
  return out;
}
