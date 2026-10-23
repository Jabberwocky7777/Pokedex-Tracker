/**
 * generate-og-image.mjs
 *
 * Writes public/og-image.png (1200×630), the picture iMessage, Discord, Slack and
 * the like show for a shared link (og:image in index.html). The ball is
 * resources/icon.svg; the text is drawn here.
 *
 * Usage: npm run generate:og
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const W = 1200, H = 630;

const background = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="bg" cx="30%" cy="45%" r="80%">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="55%" stop-color="#0b1020"/>
      <stop offset="100%" stop-color="#030712"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g font-family="Segoe UI, Helvetica Neue, Arial, sans-serif" fill="#f9fafb">
    <text x="560" y="250" font-size="76" font-weight="700">Pokédex Tracker</text>
    <text x="562" y="318" font-size="32" fill="#c7d2fe">Gen III &amp; IV living dex, in your browser</text>
    <text x="562" y="392" font-size="26" fill="#9ca3af">Caught marks · routes · save import</text>
    <text x="562" y="434" font-size="26" fill="#9ca3af">Pokédex · moves · catch &amp; damage calcs</text>
  </g>
  <g>
    <rect x="562" y="478" width="96" height="10" rx="5" fill="#dc2626"/>
    <rect x="666" y="478" width="96" height="10" rx="5" fill="#2563eb"/>
    <rect x="770" y="478" width="96" height="10" rx="5" fill="#059669"/>
    <rect x="874" y="478" width="96" height="10" rx="5" fill="#818cf8"/>
    <rect x="978" y="478" width="96" height="10" rx="5" fill="#d97706"/>
  </g>
</svg>`;

// The icon is a square tile; round its corners like an app icon
const corners = Buffer.from('<svg width="440" height="440"><rect width="440" height="440" rx="96" fill="#fff"/></svg>');
const ball = await sharp(readFileSync(join(root, "resources", "icon.svg")))
  .resize(440, 440)
  .composite([{ input: corners, blend: "dest-in" }])
  .png()
  .toBuffer();
const out = join(root, "public", "og-image.png");

await sharp(Buffer.from(background))
  .composite([{ input: ball, left: 80, top: 95 }])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(out);

console.log("✅  Wrote", out);
