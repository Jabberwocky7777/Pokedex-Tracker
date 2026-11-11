/**
 * Captures the README screenshots into docs/screenshots/ as WebP.
 *
 *   npm run screenshots        (builds first)
 *   SHOTS=settings,pokedex     only those (names from SHOTS below; "quick-mark" is the README's GIF)
 *   SIZES=834x1194,1194x834    at these viewports instead (named <shot>-<w>x<h>.webp)
 *   OUT_DIR=some/folder        write there instead of docs/screenshots/
 *
 * Serves dist/ with `vite preview`, opens it in Chromium (Playwright, or an
 * installed Chrome/Edge) and seeds made-up demo data into localStorage before
 * the app loads: offline mode, Gen 4, a deterministic set of caught / pending /
 * shiny marks spread over the last few months, and a couple of notes. Nothing
 * comes from a real account or save. Sprites load from raw.githubusercontent.com,
 * so it needs a network connection.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import { chromium, type Browser, type Page } from "playwright";
import sharp from "sharp";
import { sampleStorage } from "../src/lib/sample-data";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : path.join(ROOT, "docs/screenshots");
const PORT = 4181;
const BASE = `http://localhost:${PORT}`;

type Theme = "dark" | "burnished";

interface Shot {
  name: string;
  hash: string;
  settings?: Record<string, unknown>;
  /** Runs after the page has loaded, before the capture */
  then?: (page: Page) => Promise<void>;
  /** Phone width too */
  mobile?: boolean;
  /** Also in the Burnished theme (desktop) */
  burnished?: boolean;
}

const SHOTS: Shot[] = [
  { name: "tracker", hash: "#/tracker", settings: { viewMode: "box" }, mobile: true, burnished: true },
  {
    name: "tracker-detail",
    hash: "#/tracker",
    settings: { viewMode: "box" },
    mobile: true,
    then: async (page) => {
      await page.locator('main [title^="#094 "]').first().click();
    },
  },
  { name: "tracker-list", hash: "#/tracker", settings: { viewMode: "list" } },
  { name: "where-to-go", hash: "#/plan/where" },
  { name: "progress", hash: "#/tracker", settings: { viewMode: "progress" } },
  { name: "pokedex", hash: "#/pokedex/94", mobile: true, burnished: true },
  { name: "routes", hash: "#/routes/eterna-forest-area" },
  {
    name: "settings",
    hash: "#/settings",
    mobile: true,
    then: async (page) => {
      await page
        .getByRole("heading", { name: "Sync", exact: true })
        .evaluate((el) => el.scrollIntoView({ block: "start" }));
    },
  },
];

// ── Demo data ────────────────────────────────────────────────────────────────

function demoStorage(theme: Theme): Record<string, string> {
  // The same made-up collection as "Try it with sample data" (src/lib/sample-data.ts)
  const settings = {
    state: {
      activeTab: "tracker",
      activeGeneration: 4,
      theme,
      quickMark: false,
      gestureHintDismissed: true,
      availabilityMode: "obtainable",
      viewMode: "box",
    },
    version: 0,
  };
  return {
    pokedex_local_mode: "1",
    "pdx-theme": theme,
    "pokedex-settings-v1": JSON.stringify(settings),
    ...sampleStorage(Date.now()),
  };
}

// ── Capture ──────────────────────────────────────────────────────────────────

async function launch(): Promise<Browser> {
  for (const channel of [undefined, "chrome", "msedge"] as const) {
    try {
      return await chromium.launch({ channel });
    } catch {
      /* try the next browser */
    }
  }
  throw new Error("No browser found. Install Chrome or Edge, or run `npx playwright install chromium`.");
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  // Visible sprites finished loading
  await page
    .waitForFunction(
      () =>
        [...document.images]
          .filter((img) => img.getBoundingClientRect().top < window.innerHeight && img.offsetParent !== null)
          .every((img) => img.complete),
      undefined,
      { timeout: 15_000 },
    )
    .catch(() => {});
  await page.waitForTimeout(400);
}

async function capture(
  browser: Browser,
  shot: Shot,
  width: number,
  height: number,
  theme: Theme,
  sized = false,
): Promise<void> {
  const mobile = width < 768;
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
    colorScheme: "dark",
    serviceWorkers: "block",
  });
  const storage = demoStorage(theme);
  const settings = JSON.parse(storage["pokedex-settings-v1"]);
  Object.assign(settings.state, shot.settings);
  storage["pokedex-settings-v1"] = JSON.stringify(settings);
  await context.addInitScript((entries) => {
    // Only on the first load of this context, so the app's own writes aren't undone
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, storage);

  const page = await context.newPage();
  await page.goto(`${BASE}/${shot.hash}`);
  await page.locator("main").first().waitFor({ timeout: 20_000 });
  await settle(page);
  if (shot.then) {
    await shot.then(page);
    await settle(page);
  }

  const file = sized
    ? `${shot.name}-${width}x${height}.webp`
    : `${shot.name}-${mobile ? "mobile" : "desktop"}${theme === "dark" ? "" : `-${theme}`}.webp`;
  const png = await page.screenshot();
  await sharp(png).webp({ quality: 82, effort: 6 }).toFile(path.join(OUT, file));
  console.log(`  ${file}`);
  await context.close();
}

/**
 * docs/screenshots/quick-mark.gif: Quick mark on, a few uncaught Pokémon clicked one after another,
 * each showing its Undo toast. Frames are screenshots, joined into a looping GIF by sharp.
 */
async function captureQuickMarkGif(browser: Browser): Promise<void> {
  const width = 1200;
  const height = 720;
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: "dark",
    serviceWorkers: "block",
  });
  const storage = demoStorage("dark");
  const settings = JSON.parse(storage["pokedex-settings-v1"]);
  Object.assign(settings.state, { viewMode: "box", quickMark: true, gestureHintDismissed: true });
  storage["pokedex-settings-v1"] = JSON.stringify(settings);
  const dex = JSON.parse(storage["pokedex-tracker-v2"]);
  const marked = new Set<number>([...(dex.state.caughtByGen[4] ?? []), ...(dex.state.pendingByGen[4] ?? [])]);
  await context.addInitScript((entries) => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value);
  }, storage);

  const page = await context.newPage();
  await page.goto(`${BASE}/#/tracker`);
  await page.locator("main").first().waitFor({ timeout: 20_000 });
  await settle(page);

  const frames: Buffer[] = [];
  const delays: number[] = [];
  const frame = async (ms: number) => {
    frames.push(
      await sharp(await page.screenshot())
        .resize({ width: 720 })
        .png()
        .toBuffer(),
    );
    delays.push(ms);
  };
  await frame(1200);
  // The first few uncaught Pokémon in view
  const targets = Array.from({ length: 60 }, (_, i) => i + 1)
    .filter((id) => !marked.has(id))
    .slice(0, 4);
  for (const id of targets) {
    const cell = page.locator(`main [title^="#${String(id).padStart(3, "0")} "]`).first();
    if (!(await cell.isVisible())) continue;
    await cell.hover();
    await frame(350);
    await cell.click();
    await page.waitForTimeout(250);
    await frame(900);
  }
  await page.waitForTimeout(300);
  await frame(1600);

  await sharp(frames, { join: { animated: true } })
    .gif({ delay: delays, loop: 0, effort: 7 })
    .toFile(path.join(OUT, "quick-mark.gif"));
  console.log("  quick-mark.gif");
  await context.close();
}

async function run(): Promise<void> {
  if (!fs.existsSync(path.join(ROOT, "dist/index.html")))
    throw new Error("dist/ is missing — run `npm run build` first.");
  fs.mkdirSync(OUT, { recursive: true });
  const server = await preview({ root: ROOT, preview: { port: PORT, strictPort: true }, logLevel: "silent" });
  const browser = await launch();
  try {
    // SHOTS=settings,pokedex re-captures only those
    const only = process.env.SHOTS?.split(",");
    // SIZES=834x1194,1194x834 captures at those viewports only (a tablet, say)
    const sizes = process.env.SIZES?.split(",").map((size) => size.split("x").map(Number));
    if (!sizes && (!only || only.includes("quick-mark"))) await captureQuickMarkGif(browser);
    for (const shot of SHOTS.filter((s) => !only || only.includes(s.name))) {
      if (sizes) {
        for (const [width, height] of sizes) await capture(browser, shot, width, height, "dark", true);
        continue;
      }
      await capture(browser, shot, 1440, 900, "dark");
      if (shot.burnished) await capture(browser, shot, 1440, 900, "burnished");
      if (shot.mobile) await capture(browser, shot, 390, 844, "dark");
    }
  } finally {
    await browser.close();
    server.httpServer.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
