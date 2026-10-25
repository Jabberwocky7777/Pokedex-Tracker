/**
 * generate-icon.mjs
 *
 * Converts resources/icon.svg → 1024×1024 PNG and writes it to the iOS
 * asset catalogue slot that Xcode uses for all device sizes, and to the web
 * app's home-screen icons in public/ (named in the manifest in vite.config.ts).
 *
 * Usage: node scripts/generate-icon.mjs
 *   or:  npm run generate:icon
 *
 * sharp is a devDependency.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root    = join(dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = join(root, "resources", "icon.svg");
const outPath = join(
  root,
  "ios", "App", "App", "Assets.xcassets",
  "AppIcon.appiconset", "AppIcon-512@2x.png",
);

console.log("Generating app icon…");
console.log("  Source:", svgPath);
console.log("  Output:", outPath);

const svgBuffer = readFileSync(svgPath);

await sharp(svgBuffer)
  .resize(1024, 1024)
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(outPath);

// ── Web app (installed to a phone's home screen from the browser) ────────────
const publicDir = join(root, "public");
const png = { compressionLevel: 9, adaptiveFiltering: true };
for (const size of [192, 512]) {
  await sharp(svgBuffer).resize(size, size).png(png).toFile(join(publicDir, `pwa-${size}.png`));
}
// iOS ignores the manifest's icons and uses this one
await sharp(svgBuffer).resize(180, 180).png(png).toFile(join(publicDir, "apple-touch-icon.png"));
// Maskable: Android crops the icon to a circle or squircle, so the artwork is
// shrunk into the middle 80% on the icon's own background colour
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#030712" } })
  .composite([{ input: await sharp(svgBuffer).resize(410, 410).png().toBuffer(), gravity: "centre" }])
  .png(png)
  .toFile(join(publicDir, "pwa-maskable-512.png"));
console.log("  Web icons:", publicDir);

console.log("✅  Icons written successfully.");
