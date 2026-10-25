/**
 * Captures the README screenshots into docs/screenshots/ as WebP.
 *
 *   npm run screenshots        (builds first)
 *   SHOTS=settings,pokedex     only those (names from SHOTS below)
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

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs/screenshots");
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
    name: "tracker-detail", hash: "#/tracker", settings: { viewMode: "box" }, mobile: true,
    then: async (page) => { await page.locator('main [title^="#094 "]').first().click(); },
  },
  { name: "tracker-list", hash: "#/tracker", settings: { viewMode: "list" } },
  { name: "whats-next", hash: "#/tracker", settings: { viewMode: "next" } },
  { name: "progress", hash: "#/tracker", settings: { viewMode: "progress" } },
  { name: "pokedex", hash: "#/pokedex/94", mobile: true, burnished: true },
  { name: "routes", hash: "#/routes/eterna-forest-area" },
  {
    name: "settings", hash: "#/settings", mobile: true,
    then: async (page) => {
      await page.getByRole("heading", { name: "Sync", exact: true }).evaluate((el) => el.scrollIntoView({ block: "start" }));
    },
  },
];

// ── Demo data ────────────────────────────────────────────────────────────────

/** Small deterministic PRNG, so every run seeds the same marks */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function demoStorage(theme: Theme): Record<string, string> {
  const random = mulberry32(493);
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const caught: number[] = [];
  const pending: number[] = [];
  const caughtAt: Record<number, number> = {};
  for (let id = 1; id <= 493; id++) {
    // More of the early dex caught than the late one, like a real run
    const chance = 0.85 - (id / 493) * 0.45;
    const roll = random();
    if (roll < chance) {
      caught.push(id);
      // Spread over the last 120 days, older for lower numbers
      caughtAt[id] = now - Math.round((1 - id / 493) * 110 * day + random() * 10 * day);
    } else if (roll < chance + 0.05) {
      pending.push(id);
    }
  }
  const shiny = [25, 94, 133, 197, 448].filter((id) => caught.includes(id));
  const at = (ids: number[]) => Object.fromEntries(ids.map((id) => [id, caughtAt[id] ?? now - 3 * day]));

  const settings = {
    state: {
      activeTab: "tracker", activeGeneration: 4, theme, quickMark: false,
      gestureHintDismissed: true, availabilityMode: "obtainable", viewMode: "box",
    },
    version: 0,
  };
  const dex = {
    state: {
      caughtByGen: { 4: caught }, pendingByGen: { 4: pending }, shinyByGen: { 4: shiny }, placedByGen: {},
      updatedAt: { caught: { 4: at(caught) }, pending: { 4: at(pending) }, shiny: { 4: at(shiny) }, placed: {} },
    },
    version: 0,
  };
  const notes = {
    state: {
      entries: {
        "4:94": { text: "Haunter traded over and back — keep this one for the living dex.", at: now - 2 * day },
        "4:448": { text: "Riolu egg from the Iron Island guy. Lucario at friendship 220, daytime.", at: now - day },
      },
    },
    version: 0,
  };
  return {
    pokedex_local_mode: "1",
    "pdx-theme": theme,
    "pokedex-settings-v1": JSON.stringify(settings),
    "pokedex-tracker-v2": JSON.stringify(dex),
    "pokedex-notes-v1": JSON.stringify(notes),
  };
}

// ── Capture ──────────────────────────────────────────────────────────────────

async function launch(): Promise<Browser> {
  for (const channel of [undefined, "chrome", "msedge"] as const) {
    try { return await chromium.launch({ channel }); } catch { /* try the next browser */ }
  }
  throw new Error("No browser found. Install Chrome or Edge, or run `npx playwright install chromium`.");
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  // Visible sprites finished loading
  await page.waitForFunction(() => [...document.images]
    .filter((img) => img.getBoundingClientRect().top < window.innerHeight && img.offsetParent !== null)
    .every((img) => img.complete), undefined, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(400);
}

async function capture(browser: Browser, shot: Shot, width: number, height: number, theme: Theme): Promise<void> {
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
  if (shot.then) { await shot.then(page); await settle(page); }

  const file = `${shot.name}-${mobile ? "mobile" : "desktop"}${theme === "dark" ? "" : `-${theme}`}.webp`;
  const png = await page.screenshot();
  await sharp(png).webp({ quality: 82, effort: 6 }).toFile(path.join(OUT, file));
  console.log(`  ${file}`);
  await context.close();
}

async function run(): Promise<void> {
  if (!fs.existsSync(path.join(ROOT, "dist/index.html"))) throw new Error("dist/ is missing — run `npm run build` first.");
  fs.mkdirSync(OUT, { recursive: true });
  const server = await preview({ root: ROOT, preview: { port: PORT, strictPort: true }, logLevel: "silent" });
  const browser = await launch();
  try {
    // SHOTS=settings,pokedex re-captures only those
    const only = process.env.SHOTS?.split(",");
    for (const shot of SHOTS.filter((s) => !only || only.includes(s.name))) {
      await capture(browser, shot, 1440, 900, "dark");
      if (shot.burnished) await capture(browser, shot, 1440, 900, "burnished");
      if (shot.mobile) await capture(browser, shot, 390, 844, "dark");
    }
  } finally {
    await browser.close();
    server.httpServer.close();
  }
}

run().catch((err) => { console.error(err); process.exit(1); });
