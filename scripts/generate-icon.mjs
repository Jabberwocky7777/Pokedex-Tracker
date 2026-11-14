/**
 * generate-icon.mjs
 *
 * Converts resources/icon.svg → 1024×1024 PNG and writes it to the iOS
 * asset catalogue slot that Xcode uses for all device sizes, to the web
 * app's home-screen icons in public/ (named in the manifest in vite.config.ts),
 * to the Android launcher icons (adaptive foreground + legacy PNGs per density),
 * and to the artwork for launchers that take their own (docs/android/cocoon/).
 *
 * Usage: node scripts/generate-icon.mjs
 *   or:  npm run generate:icon
 *
 * sharp is a devDependency.
 */

import { mkdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = join(root, "resources", "icon.svg");
const outPath = join(root, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "AppIcon-512@2x.png");

console.log("Generating app icon…");
console.log("  Source:", svgPath);
console.log("  Output:", outPath);

const svgBuffer = readFileSync(svgPath);

await sharp(svgBuffer).resize(1024, 1024).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(outPath);

// ── Web app (installed to a phone's home screen from the browser) ────────────
const publicDir = join(root, "public");
const png = { compressionLevel: 9, adaptiveFiltering: true };
for (const size of [192, 512]) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png(png)
    .toFile(join(publicDir, `pwa-${size}.png`));
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

// ── Android launcher icons ───────────────────────────────────────────────────
// Adaptive icon: the Poké Ball (without the square background) as the foreground,
// inside the centre 66 of 108 dp that every launcher mask keeps, on the solid
// #030712 background (res/values/ic_launcher_background.xml). Legacy PNGs (48 dp)
// for launchers that don't use adaptive icons; the round one cut to a circle.
const androidRes = join(root, "android", "app", "src", "main", "res");
const ballOnly = Buffer.from(
  svgBuffer.toString("utf8").replace(/<rect width="1024" height="1024" fill="url\(#bg\)"\/>/, ""),
);
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [density, scale] of Object.entries(DENSITIES)) {
  const dir = join(androidRes, `mipmap-${density}`);
  mkdirSync(dir, { recursive: true });
  const fg = Math.round(108 * scale);
  // The ball is 780 of the SVG's 1024 px; it should span 64 dp of the 108
  const art = Math.round(((64 / 108) * fg * 1024) / 780);
  const ball = await sharp(ballOnly).resize(art, art).png().toBuffer();
  const pad = Math.round((fg - art) / 2);
  await sharp({ create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: ball, left: pad, top: pad }])
    .png(png)
    .toFile(join(dir, "ic_launcher_foreground.png"));
  const legacy = Math.round(48 * scale);
  await sharp(svgBuffer).resize(legacy, legacy).png(png).toFile(join(dir, "ic_launcher.png"));
  const circle = Buffer.from(
    `<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}"/></svg>`,
  );
  await sharp(svgBuffer)
    .resize(legacy, legacy)
    .composite([{ input: circle, blend: "dest-in" }])
    .png(png)
    .toFile(join(dir, "ic_launcher_round.png"));
}
console.log("  Android icons:", androidRes);

// ── Artwork for launchers that take their own (Cocoon on the AYN Thor) ───────
// A square icon, a 1920 × 1080 hero in the dark theme, and the name on transparent.
const cocoon = join(root, "docs", "android", "cocoon");
mkdirSync(cocoon, { recursive: true });
await sharp(svgBuffer).resize(1024, 1024).png(png).toFile(join(cocoon, "icon-1024.png"));
const wordmark = (fill) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="220"><text x="700" y="160" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="150" font-weight="700" fill="${fill}">Pokédex Tracker</text></svg>`,
  );
await sharp(wordmark("#f3f4f6")).png(png).toFile(join(cocoon, "wordmark.png"));
await sharp({ create: { width: 1920, height: 1080, channels: 4, background: "#030712" } })
  .composite([
    { input: await sharp(ballOnly).resize(560, 560).png().toBuffer(), left: 680, top: 150 },
    { input: await sharp(wordmark("#f3f4f6")).resize(1100).png().toBuffer(), left: 410, top: 760 },
  ])
  .png(png)
  .toFile(join(cocoon, "hero-1920x1080.png"));
console.log("  Launcher artwork:", cocoon);

console.log("✅  Icons written successfully.");
