/**
 * generate-social-preview.mjs
 *
 * Writes docs/social-preview.png (1280×640), the image GitHub shows when the
 * repository is linked (Settings → General → Social preview — uploaded by hand).
 * The ball is resources/icon.svg and the picture of the app is
 * docs/screenshots/tracker-desktop.webp, so run `npm run screenshots` first.
 *
 * Usage: npm run generate:social
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const W = 1280, H = 640;

const background = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bg" cx="20%" cy="40%" r="90%">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="55%" stop-color="#0b1020"/>
      <stop offset="100%" stop-color="#030712"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g font-family="Segoe UI, Helvetica Neue, Arial, sans-serif" fill="#f9fafb">
    <text x="72" y="286" font-size="60" font-weight="700">Pokédex Tracker</text>
    <text x="74" y="342" font-size="27" fill="#c7d2fe">Gen III &amp; IV living dex, on every device</text>
    <text x="74" y="410" font-size="22" fill="#9ca3af">Caught marks · routes · save-file import</text>
    <text x="74" y="446" font-size="22" fill="#9ca3af">Pokédex · moves · catch &amp; damage calcs</text>
    <text x="74" y="482" font-size="22" fill="#9ca3af">Web, iOS and self-hosted sync</text>
  </g>
  <g>
    <rect x="74" y="526" width="72" height="8" rx="4" fill="#dc2626"/>
    <rect x="154" y="526" width="72" height="8" rx="4" fill="#2563eb"/>
    <rect x="234" y="526" width="72" height="8" rx="4" fill="#059669"/>
    <rect x="314" y="526" width="72" height="8" rx="4" fill="#818cf8"/>
    <rect x="394" y="526" width="72" height="8" rx="4" fill="#d97706"/>
  </g>
</svg>`;

const rounded = (w, h, r) => Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`);

const ball = await sharp(readFileSync(join(root, "resources", "icon.svg")))
  .resize(132, 132)
  .composite([{ input: rounded(132, 132, 30), blend: "dest-in" }])
  .png()
  .toBuffer();

// The tracker grid, cut from the README screenshot, as a card running off the right edge
const shotW = 640, shotH = 520;
const shot = await sharp(join(root, "docs", "screenshots", "tracker-desktop.webp"))
  .extract({ left: 0, top: 60, width: 1000, height: 812 })
  .resize(shotW, shotH)
  .composite([{ input: rounded(shotW, shotH, 18), blend: "dest-in" }])
  .png()
  .toBuffer();
const border = Buffer.from(`<svg width="${shotW + 4}" height="${shotH + 4}"><rect x="1" y="1" width="${shotW + 2}" height="${shotH + 2}" rx="19" fill="none" stroke="#4f46e5" stroke-opacity="0.6" stroke-width="2"/></svg>`);

const out = join(root, "docs", "social-preview.png");
await sharp(Buffer.from(background))
  .composite([
    { input: ball, left: 72, top: 92 },
    { input: shot, left: 690, top: 60 },
    { input: border, left: 688, top: 58 },
  ])
  .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 90 })
  .toFile(out);

console.log("✅  Wrote", out);
