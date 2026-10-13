/**
 * Click-through of the cross-tab links (and a few things around them: the
 * Content-Security-Policy, offline use, no PokéAPI at runtime) in a real
 * browser, against the production build in dist/.
 *
 *   npm run e2e            builds, then runs this
 *   npx tsx scripts/e2e-links.ts            runs against the dist/ that is there
 *   E2E_HEADED=1 … / E2E_ONLY=1440 …        watch it / one width only
 *
 * It serves dist/ with `vite preview` (which sends the same CSP as nginx),
 * starts in offline mode with Gen IV and only Diamond selected, imports
 * synthetic saves (src/lib/save/__tests__/build.ts — no real save is needed),
 * and runs every check at 1440 px and at 375 px. Nothing here is picked up by
 * Vitest. Uses an installed Chrome or Edge, or Playwright's own Chromium.
 */
import fs from "node:fs";
import os from "node:os";
import { createRequire } from "node:module";
import type { Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { preview, type PreviewServer } from "vite";
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from "playwright";
import { buildSave, type MonSpec } from "../src/lib/save/__tests__/build";
import { resolvePlace } from "../src/lib/location-links";
import { GEN3_TM_LOCATIONS, GEN4_TM_LOCATIONS } from "../src/lib/tm-locations";
import { DAILY_EVENT_SECTIONS } from "../src/data/daily-events";
import type { Pokemon } from "../src/types";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4174;
const BASE = `http://localhost:${PORT}`;
const allPokemon = JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/pokemon.json"), "utf8")) as Pokemon[];

// ── Results ──────────────────────────────────────────────────────────────────

interface Result { item: string; width: number; name: string; ok: boolean; note: string }
const results: Result[] = [];
let width = 0;

async function check(item: string, name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ item, width, name, ok: true, note: "" });
  } catch (err) {
    const note = String(err instanceof Error ? err.message : err).split("\n")[0].slice(0, 220);
    results.push({ item, width, name, ok: false, note });
    console.log(`  ✖ [${item} @${width}] ${name}: ${note}`);
  }
}

function expect(actual: unknown, expected: unknown, what: string): void {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}: expected ${e}, got ${a}`);
}
function ensure(condition: unknown, what: string): asserts condition {
  if (!condition) throw new Error(what);
}

// ── Page helpers ─────────────────────────────────────────────────────────────

const TAB_LABELS: Record<string, string[]> = {
  tracker: ["Tracker"], pokedex: ["Pokédex"], attackdex: ["Attackdex", "Attacks"], routes: ["Routes"],
  "catch-calc": ["Catch Calc", "Catch"], designer: ["Designer"], "trainer-lookup": ["Trainer"],
  "damage-calc": ["Damage Calc", "Damage"], settings: ["Settings"],
};
const TITLE = { tracker: "Show in the tracker", pokedex: "Open in the Pokédex", route: "Open in Routes", search: "Search Routes for this place", move: "Open in the Attackdex" };

let page: Page;
const main = () => page.locator("main:visible").first();
/** The whole page — for tabs that have no <main>. Hidden tabs are skipped by the :visible in each selector. */
const body = () => page.locator("body");
/** The tracker's detail panel: a sidebar on a wide screen, a bottom sheet on a phone. */
const panel = () => page.locator("aside:visible").first();
const navBar = () => page.locator('nav[aria-label="Main navigation"]:visible');
const settle = (ms = 250) => page.waitForTimeout(ms);

async function ready(): Promise<void> {
  await navBar().waitFor({ state: "visible", timeout: 15000 });
  await settle(400);
}

async function activeTab(): Promise<string> {
  const label = (await navBar().locator('[aria-current="page"]').innerText()).trim();
  return Object.keys(TAB_LABELS).find((id) => TAB_LABELS[id].includes(label)) ?? label;
}

/** Switches tab the way a user does: the header on a wide screen, the bottom bar on a phone. */
async function nav(tab: string): Promise<void> {
  const button = () => navBar().locator("button").filter({ hasText: new RegExp(`^(${TAB_LABELS[tab].join("|")})$`) });
  if ((await button().count()) === 0) await navBar().locator('button[aria-label^="Switch to"]:not([disabled])').first().click();
  await button().first().click();
  await settle();
}

/** Changes persisted settings and reloads — for where a check starts, not for what it tests. */
async function settings(patch: Record<string, unknown>): Promise<void> {
  await page.evaluate((p) => {
    const key = "pokedex-settings-v1";
    const stored = JSON.parse(localStorage.getItem(key) ?? '{"state":{},"version":0}');
    Object.assign(stored.state, p);
    localStorage.setItem(key, JSON.stringify(stored));
  }, patch);
  await page.reload();
  await ready();
}

const storedSettings = () => page.evaluate(() => JSON.parse(localStorage.getItem("pokedex-settings-v1") ?? "{}").state as Record<string, unknown>);
const caught = (gen: number) => page.evaluate((g) => (JSON.parse(localStorage.getItem("pokedex-tracker-v2") ?? "{}").state?.caughtByGen?.[g] ?? []) as number[], gen);

/**
 * An inline link: must be a real, focusable <button type="button"> that is not
 * nested inside another button. Returns it, scrolled into view.
 */
async function link(scope: Locator, text: string | RegExp, title?: string): Promise<Locator> {
  const selector = title ? `button[title="${title}"]:visible` : "button[title]:visible";
  const found = scope.locator(selector).filter(typeof text === "string" ? { hasText: new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`) } : { hasText: text }).first();
  await found.waitFor({ state: "visible", timeout: 6000 });
  const info = await found.evaluate((el) => {
    const button = el as HTMLButtonElement;
    button.focus();
    return {
      tag: button.tagName, type: button.type, focused: document.activeElement === button,
      nested: !!button.parentElement?.closest("button"), dotted: getComputedStyle(button).textDecorationStyle,
    };
  });
  ensure(info.tag === "BUTTON" && info.type === "button", `link is <${info.tag} type=${info.type}>`);
  ensure(info.focused, "link cannot take focus");
  ensure(!info.nested, "link is nested inside another button");
  await found.scrollIntoViewIfNeeded();
  return found;
}

async function clickLink(scope: Locator, text: string | RegExp, title?: string): Promise<void> {
  await (await link(scope, text, title)).click();
  await settle(450);
}

const panelName = async () => (await panel().locator("h2").first().innerText()).trim();
const routeHeading = async () => (await main().locator("h2").first().innerText()).trim();
const pokedexName = async () => (await main().locator("h3").first().innerText()).trim();
const attackdexMove = async () => (await main().locator("h3").first().innerText()).trim();

/** Selects a Pokémon in the tracker's box grid (Quick mark is off, so one click selects). */
async function select(id: number): Promise<void> {
  if ((await activeTab()) !== "tracker") await nav("tracker");
  await closePanel();   // clicking the selected Pokémon again would deselect it
  const cell = main().locator(`[title^="#${String(id).padStart(3, "0")} "]`).first();
  await cell.scrollIntoViewIfNeeded();
  await cell.click();
  await panel().waitFor({ state: "visible", timeout: 5000 });
  await settle();
}

async function closePanel(): Promise<void> {
  if ((await page.locator("aside:visible").count()) > 0) await panel().locator('button[aria-label="Close details"]').click();
  await settle(150);
}

async function routesSearch(text: string): Promise<string[]> {
  await main().locator('input[placeholder^="Search routes"]').fill(text);
  await settle(350);
  return main().locator(".grid > button").allInnerTexts();
}

// ── Synthetic saves ──────────────────────────────────────────────────────────

/** Living-dex slot of a species: National Dex order, 30 a box, from box 1. */
const home = (species: number) => `${Math.floor((species - 1) / 30)}:${(species - 1) % 30}`;
const U_TURN = 369, WILL_O_WISP = 261, TACKLE = 33;

function livingDexSave(second: boolean): Uint8Array {
  const boxes: Record<string, MonSpec> = {
    [home(1)]: { species: 1, moves: [U_TURN, WILL_O_WISP, TACKLE], exp: 1000 }, // placed; evolves into Ivysaur; one free move slot
    [home(2)]: { species: 4 },            // Charmander sitting in Ivysaur's slot
    [home(15)]: { species: 14 },          // Kakuna holding Beedrill's slot
    [home(25)]: { species: 25 },          // Pikachu placed → Pichu needs breeding
    [home(133)]: { species: 133 },        // Eevee placed…
    "17:0": { species: 133 },             // …and a spare one, which counts towards an evolution
  };
  if (second) boxes[home(7)] = { species: 7 }; // the second dump adds a placed Squirtle
  return buildSave({ family: "platinum", trainerName: "DAWN", saveCount: second ? 11 : 10, boxes });
}

const playthroughSave = () =>
  buildSave({ family: "dp", trainerName: "LUCAS", tid: 222, sid: 333, saveCount: 5, boxes: { "0:0": { species: 387 }, "0:1": { species: 393 } } });

async function importSave(bytes: Uint8Array, name: string): Promise<void> {
  await page.locator('[data-testid="save-file-input"]').setInputFiles({ name, mimeType: "application/octet-stream", buffer: Buffer.from(bytes) });
  await settle(900);
}

/** Applies whatever the import review proposes, or closes it when there is nothing to apply. */
async function finishReview(): Promise<void> {
  const dialog = page.locator('[role="dialog"]:visible').last();
  if ((await dialog.count()) === 0) return;
  const apply = dialog.locator("button").filter({ hasText: /^Apply \d+ change/ });
  if ((await apply.count()) > 0 && (await apply.first().isEnabled())) await apply.first().click();
  else await dialog.locator("button").filter({ hasText: /^(Close|Cancel|Done|Skip|Not now)/ }).first().click();
  await settle(500);
}

// ── The checks ───────────────────────────────────────────────────────────────

const VERSION_GROUP_GAMES: Record<string, string[]> = {
  "ruby-sapphire": ["ruby", "sapphire"], emerald: ["emerald"], "firered-leafgreen": ["firered", "leafgreen"],
  "diamond-pearl": ["diamond", "pearl"], platinum: ["platinum"], "heartgold-soulsilver": ["heartgold", "soulsilver"],
};

/** A TM/HM whose location text behaves a given way in a given version group, picked from the real tables. */
function findTm(versionGroups: string[], want: (text: string, kinds: (string | null)[]) => boolean): { slug: string; versionGroup: string; text: string } {
  for (const table of [GEN3_TM_LOCATIONS, GEN4_TM_LOCATIONS]) {
    for (const [slug, byGroup] of Object.entries(table)) {
      for (const versionGroup of versionGroups) {
        const text = byGroup[versionGroup as keyof typeof byGroup];
        if (!text) continue;
        const kinds = text.split(" / ").map((part) => resolvePlace(part, VERSION_GROUP_GAMES[versionGroup], allPokemon)?.kind ?? null);
        if (want(text, kinds)) return { slug, versionGroup, text };
      }
    }
  }
  throw new Error("no TM entry of that kind in tm-locations.ts");
}

const GEN4_START = {
  activeGeneration: 4, activeGames: ["diamond"], dexMode: "national", availabilityMode: "all", showUncaughtOnly: false,
  quickMark: false, gestureHintDismissed: true, viewMode: "box", activeTab: "tracker", theme: "dark",
};

async function runChecks(problems: string[]): Promise<void> {
  const mobile = width < 768;

  // ── 9. Content-Security-Policy: every tab, both themes, the sprite hosts ──
  await check("9", "every tab loads with no CSP violation or page error", async () => {
    for (const tab of Object.keys(TAB_LABELS)) { await nav(tab); await settle(500); }
    await nav("tracker");
    expect(problems, [], "console");
  });
  await check("9", "a Pokémon sprite loads (raw.githubusercontent.com)", async () => {
    const img = main().locator('img[src*="raw.githubusercontent.com"]').first();
    await img.scrollIntoViewIfNeeded();
    await page.waitForFunction((el) => (el as HTMLImageElement).naturalWidth > 0, await img.elementHandle(), { timeout: 15000 });
  });
  await check("9", "the Burnished theme's font loads (Google Fonts)", async () => {
    await settings({ theme: "burnished" });
    const loaded = await page.evaluate(async () => (await document.fonts.load('600 16px "Cormorant Garamond"')).length);
    ensure(loaded > 0, "Cormorant Garamond did not load");
    expect(problems, [], "console");
    await settings({ theme: "dark" });
  });

  // ── 14. Tracker detail panel ──────────────────────────────────────────────
  await check("14", "location table row opens the route", async () => {
    await select(396); // Starly: Route 201 in Diamond
    await clickLink(panel().locator("table"), "Route 201", TITLE.route);
    expect([await activeTab(), await routeHeading()], ["routes", "Route 201"], "after the row link");
  });
  await check("21", "leaving through a panel link closes the panel; it is not open on return", async () => {
    await nav("tracker");
    expect(await page.locator("aside:visible").count(), 0, "panels open after coming back");
    expect((await storedSettings()).selectedPokemonId, undefined, "persisted selection");
  });
  await check("14", "the Best: location opens the route", async () => {
    await select(396);
    const best = panel().locator("xpath=.//span[starts-with(normalize-space(.), 'Best:')]/following-sibling::button[1]").first();
    const name = (await best.innerText()).trim();
    expect(await best.getAttribute("title"), TITLE.route, "Best: link title");
    await best.scrollIntoViewIfNeeded();
    await best.click();
    await settle(450);
    expect([await activeTab(), await routeHeading()], ["routes", name], "after Best:");
  });
  await check("14", "\"Evolve X\" opens X in the panel", async () => {
    await select(397); // Staravia ← Starly
    const note = panel().locator("div.text-xs").filter({ hasText: /Also obtainable:/ }).first();
    await clickLink(note, "Starly", TITLE.tracker);
    expect([await activeTab(), await panelName()], ["tracker", "Starly"], "after Evolve X");
  });
  await check("14", "breeding parent: Wynaut → Wobbuffet", async () => {
    await select(360);
    ensure((await panel().innerText()).includes("Obtainable via breeding"), "no breeding note for Wynaut");
    await clickLink(panel(), "Wobbuffet", TITLE.tracker);
    expect([await activeTab(), await panelName()], ["tracker", "Wobbuffet"], "after the parent link");
  });
  await check("14", "NPC trade location opens the route", async () => {
    await select(441); // Chatot: in-game trade in Eterna City
    const card = panel().locator("xpath=.//*[normalize-space(text())='NPC Trade']/ancestor::div[2]").first();
    const place = card.locator(`button[title="${TITLE.route}"]`).first();
    const name = (await place.innerText()).trim();
    await clickLink(card, name, TITLE.route);
    expect(await activeTab(), "routes", "tab after the trade location");
    ensure((await routeHeading()).length > 0, "no route opened");
  });
  await check("14", "each evolution-chain stage opens in the panel", async () => {
    for (const stage of ["Vaporeon", "Jolteon", "Glaceon"]) {
      await select(133);
      await clickLink(panel(), new RegExp(stage), TITLE.tracker);
      expect(await panelName(), stage, "panel after the chain link");
    }
  });
  await check("14", "the evolution named in the reminder opens in the panel", async () => {
    await select(396);
    if (!(await panel().innerText()).includes("Next: evolve it")) {
      await panel().locator("button").filter({ hasText: /^Mark as Caught$/ }).click();
      await settle(400);
    }
    const reminder = panel().locator("xpath=.//*[normalize-space(text())='Next: evolve it']/..").first();
    await clickLink(reminder, "Staravia", TITLE.tracker);
    expect(await panelName(), "Staravia", "panel after the reminder link");
  });
  await check("14", "the reminder links the whole name: Pidgeot, not the start of Pidgeotto", async () => {
    await select(17);
    if (!(await panel().innerText()).includes("Next: evolve it")) {
      await panel().locator("button").filter({ hasText: /^Mark as Caught$/ }).click();
      await settle(400);
    }
    const reminder = panel().locator("xpath=.//*[normalize-space(text())='Next: evolve it']/..").first();
    ensure(/Pidgeotto evolves into Pidgeot /.test(await reminder.innerText()), `reminder: ${await reminder.innerText()}`);
    await clickLink(reminder, "Pidgeot", TITLE.tracker);
    expect(await panelName(), "Pidgeot", "panel after the reminder link");
  });
  for (const [id, expected, why] of [
    [15, "Kakuna", "the placeholder holding the slot"], [2, "Charmander", "the wrong occupant"],
    [134, "Eevee", "the spare it is pending from"], [134, "Jolteon", "an alternative"],
    [135, "Vaporeon", "what the spare is counted towards"], [172, "Pikachu", "the breeding parent"],
  ] as const) {
    await check("14", `In your saves: ${why} (${expected})`, async () => {
      await select(id);
      const card = panel().locator("xpath=.//*[normalize-space(text())='In your saves']/..").first();
      await clickLink(card, expected, TITLE.tracker);
      expect([await activeTab(), await panelName()], ["tracker", expected], "after the link");
    });
  }

  // ── 15. A route outside the selected games ────────────────────────────────
  await check("15", "HG/SS route from the Pokédex with only Diamond selected: notice, Gen IV marks", async () => {
    await settings({ activeTab: "pokedex", activePokedexId: 161 });
    await clickLink(main(), "Route 29", TITLE.route);
    expect([await activeTab(), await routeHeading()], ["routes", "Route 29"], "route opened");
    const notice = await main().locator('[role="status"]').first().innerText();
    ensure(/isn.t in Diamond/.test(notice) && /HeartGold/.test(notice), `notice: ${notice}`);
    const before = [(await caught(4)).length, (await caught(3)).length];
    const box = main().locator('tbody input[type="checkbox"]').first();
    await box.click(); await settle(350);
    expect([(await caught(4)).length - before[0], (await caught(3)).length - before[1]], [1, 0], "marks added to [Gen IV, Gen III]");
    ensure(/^1\/\d+ caught/.test((await main().innerText()).match(/\d+\/\d+ caught/)?.[0] ?? ""), "count did not follow the mark");
    await main().locator('tbody input[type="checkbox"]').first().click(); await settle(300);
  });
  await check("15", "a Kanto route that FR/LG and HG/SS share stays in Gen IV: HG/SS columns, Gen IV marks", async () => {
    await settings({ activeTab: "pokedex", activePokedexId: 16 });
    await clickLink(main(), "Route 1", TITLE.route);
    const notice = await main().locator('[role="status"]').first().innerText();
    ensure(/HeartGold, SoulSilver/.test(notice) && !/FireRed|Generation 3/.test(notice), `notice: ${notice}`);
    ensure(!/FireRed|LeafGreen/.test(await main().locator("thead").first().innerText()), "Gen III columns are shown");
    const before = [(await caught(4)).length, (await caught(3)).length];
    await main().locator('tbody input[type="checkbox"]').first().click(); await settle(350);
    expect([(await caught(4)).length - before[0], (await caught(3)).length - before[1]], [1, 0], "marks added to [Gen IV, Gen III]");
    await main().locator('tbody input[type="checkbox"]').first().click(); await settle(300);
  });
  await check("15", "a Gen III area while Gen IV is active: marks go to Gen III", async () => {
    await nav("routes");
    const found = await routesSearch("Route 114");
    ensure(found.some((name) => name.trim() === "Route 114"), `search found ${JSON.stringify(found)}`);
    await main().locator(".grid > button").filter({ hasText: /^\s*Route 114\s*$/ }).first().click();
    await settle(450);
    const notice = await main().locator('[role="status"]').first().innerText();
    ensure(/Generation 3/.test(notice), `notice: ${notice}`);
    const before = [(await caught(4)).length, (await caught(3)).length];
    await main().locator('tbody input[type="checkbox"]').first().click(); await settle(350);
    expect([(await caught(4)).length - before[0], (await caught(3)).length - before[1]], [0, 1], "marks added to [Gen IV, Gen III]");
    await main().locator('tbody input[type="checkbox"]').first().click(); await settle(300);
  });

  // ── 16. Attackdex deep link out of Combo and HM mode ──────────────────────
  for (const mode of ["Combo", "HM"]) {
    await check("16", `a move opened from the Trainer tab leaves ${mode} mode`, async () => {
      await nav("attackdex");
      await main().locator("button").filter({ hasText: new RegExp(`^${mode}$`) }).first().click();
      await settle();
      await nav("trainer-lookup");
      await pickTrainer();
      const move = body().locator(`button[title="${TITLE.move}"]:visible`).first();
      const name = (await move.innerText()).trim();
      await clickLink(body(), name, TITLE.move);
      expect(await activeTab(), "attackdex", "tab");
      ensure((await main().innerText()).includes("Power"), "the single-move view is not showing");
      ensure((await attackdexMove()).replace(/[^a-z]/gi, "").toLowerCase() === name.replace(/[^a-z]/gi, "").toLowerCase(), `shows ${await attackdexMove()} for ${name}`);
    });
  }

  // ── 17. Scroll position ───────────────────────────────────────────────────
  await check("17", "Pokédex, Routes and Attackdex open at the top after a deep link", async () => {
    await settings({ activeTab: "pokedex", activePokedexId: 396 });
    await main().evaluate((el) => el.scrollTo(0, 99999)); await settle();
    ensure((await main().evaluate((el) => el.scrollTop)) > 100, "Pokédex did not scroll down");
    await clickLink(main(), "Route 201", TITLE.route);            // → Routes
    await main().evaluate((el) => el.scrollTo(0, 99999)); await settle();
    ensure((await main().evaluate((el) => el.scrollTop)) > 50, "Routes did not scroll down");
    await clickLink(main(), "Bidoof", TITLE.pokedex);             // → Pokédex on another Pokémon
    expect([await pokedexName(), await main().evaluate((el) => el.scrollTop)], ["Bidoof", 0], "Pokédex after a link");
    await nav("attackdex");
    await main().evaluate((el) => el.scrollTo(0, 99999)); await settle();
    await nav("pokedex");
    await main().evaluate((el) => el.scrollTo(0, 99999)); await settle();
    await clickLink(main(), "Route 201", TITLE.route);            // → Routes, a different area than before? same slug: go via another
    await nav("pokedex");
    const moveButton = main().locator("table button").filter({ hasText: /^Tackle$/ }).first();
    await moveButton.scrollIntoViewIfNeeded(); await moveButton.click(); await settle(500);
    expect([await activeTab(), await attackdexMove(), await main().evaluate((el) => el.scrollTop)], ["attackdex", "Tackle", 0], "Attackdex after a link");
    await nav("routes");
    await main().evaluate((el) => el.scrollTo(0, 99999)); await settle();
    await nav("pokedex");
    await clickLink(main(), "Route 202", TITLE.route);
    expect([await routeHeading(), await main().evaluate((el) => el.scrollTop)], ["Route 202", 0], "Routes after a link");
  });

  // ── 18. Routes search ─────────────────────────────────────────────────────
  await check("18", "\"Mt. Ember\", \"Slowpoke's Well\" and \"Route 226\" find their areas", async () => {
    await nav("routes");
    const ember = await routesSearch("Mt. Ember");
    ensure(ember.length > 1 && ember.every((n) => /Mt\.? Ember/.test(n)), `Mt. Ember: ${JSON.stringify(ember)}`);
    const well = await routesSearch("Slowpoke's Well");
    ensure(well.length === 2 && well.every((n) => /Slowpoke Well/.test(n)), `Slowpoke's Well: ${JSON.stringify(well)}`);
    const sea = await routesSearch("Route 226");
    ensure(sea.some((n) => n.trim() === "Sea Route 226"), `Route 226: ${JSON.stringify(sea)}`);
    await routesSearch("");
  });

  // ── 19. Free-text places ──────────────────────────────────────────────────
  await check("19", "TM location with one area opens it (Gen III Route 114)", async () => {
    await settings({ activeGeneration: 3, activeGames: [], dexMode: "national", activeTab: "attackdex", lastAttackdexSlug: "roar", lastAttackdexMode: "single", lastAttackdexVersionGroup: "emerald", lastAttackdexQuery: "" });
    await clickLink(main(), "Route 114", TITLE.route);
    expect([await activeTab(), await routeHeading()], ["routes", "Route 114"], "after the TM location");
    expect(await main().locator('[role="status"]').count(), 0, "out-of-selection notices");
  });
  await check("19", "a gym or shop is plain text", async () => {
    const tm = findTm(["emerald"], (text, kinds) => /Gym|Dept\. Store/.test(text) && kinds.every((k) => k === null));
    await settings({ activeTab: "attackdex", lastAttackdexSlug: tm.slug, lastAttackdexVersionGroup: "emerald" });
    const location = main().locator("div.flex.flex-col.gap-1").filter({ hasText: /(TM|HM)\d+ Location/i }).last().locator("p").first();
    expect((await location.innerText()).trim(), tm.text, "location text");
    expect(await location.locator("button").count(), 0, "links in it");
  });
  await check("19", "an entry naming two places links each part on its own", async () => {
    const tm = findTm(["ruby-sapphire", "emerald"], (text, kinds) => kinds.length === 2 && kinds.every((k) => k !== null));
    await settings({ activeTab: "attackdex", lastAttackdexSlug: tm.slug, lastAttackdexVersionGroup: tm.versionGroup });
    const location = main().locator("div.flex.flex-col.gap-1").filter({ hasText: /(TM|HM)\d+ Location/i }).last().locator("p").first();
    expect((await location.innerText()).trim(), tm.text, "location text");
    expect(await location.locator("button").count(), 2, `links in "${tm.text}"`);
    const second = (await location.locator("button").nth(1).innerText()).trim();
    await clickLink(location, second);
    expect(await activeTab(), "routes", "tab after the second place");
  });
  await check("19", "TM location with several areas opens a filtered list (Mt. Coronet)", async () => {
    await settings({ ...GEN4_START, activeTab: "attackdex", lastAttackdexSlug: "explosion", lastAttackdexMode: "single", lastAttackdexVersionGroup: "diamond-pearl" });
    await clickLink(main(), "Mt. Coronet", TITLE.search);
    expect(await activeTab(), "routes", "tab");
    expect(await main().locator('input[placeholder^="Search routes"]').inputValue(), "Mt. Coronet", "search box");
    const list = await main().locator(".grid > button").allInnerTexts();
    ensure(list.length > 5 && list.every((n) => /Coronet/.test(n)), `list: ${JSON.stringify(list.slice(0, 4))}`);
    await routesSearch("");
  });
  await check("19", "every daily-checklist place links except the honey-tree lines; links don't tick the box", async () => {
    await settings({ ...GEN4_START, activeGames: [], viewMode: "daily" });
    const tabs = page.locator("main:visible .sticky button");
    const sections = DAILY_EVENT_SECTIONS.filter((s) => s.genIds.includes(4));
    expect(await tabs.count(), sections.length, "section tabs");
    const before = (await caught(4)).length;
    for (let i = 0; i < sections.length; i++) {
      await tabs.nth(i).click(); await settle(250);
      const rows = main().locator("label.gap-3");
      const count = await rows.count();
      ensure(count > 0, `${sections[i].title}: no rows`);
      for (let r = 0; r < count; r++) {
        const row = rows.nth(r);
        const place = (await row.locator("span.truncate").innerText()).trim();
        const links = await row.locator('span.truncate button').count();
        expect(links, /tree/i.test(place) ? 0 : 1, `${sections[i].title}: links in "${place}"`);
        expect(await row.locator(`button[title="${TITLE.tracker}"]`).count(), 1, `${sections[i].title}: name link in "${place}"`);
      }
    }
    await tabs.first().click(); await settle(250);
    const row = main().locator("label.gap-3").first();
    const name = (await row.locator(`button[title="${TITLE.tracker}"]`).innerText()).trim();
    await clickLink(row, name, TITLE.tracker);
    expect([await activeTab(), await panelName(), await row.locator("input").isChecked(), (await caught(4)).length - before], ["tracker", name, false, 0], "after the name link");
    await closePanel();
    const place = (await row.locator("span.truncate button").innerText()).trim();
    await clickLink(row.locator("span.truncate"), place);
    expect([await activeTab(), (await caught(4)).length - before], ["routes", 0], "after the place link");
  });

  // ── 20. Everything else on the list ───────────────────────────────────────
  await check("20", "What's next: a sprite opens the tracker panel", async () => {
    await settings({ ...GEN4_START, viewMode: "next" });
    const sprite = main().locator(`button[title="${TITLE.tracker}"]`).first();
    const name = await sprite.locator("img").getAttribute("alt");
    await sprite.scrollIntoViewIfNeeded(); await sprite.click(); await settle(450);
    expect([await activeTab(), await panelName()], ["tracker", name], "after the sprite");
    await closePanel();
  });
  await check("20", "Change log: a name opens the tracker panel", async () => {
    await settings({ ...GEN4_START, viewMode: "log" });
    let names = main().locator(`button[title="${TITLE.tracker}"]`);
    if ((await names.count()) === 0) { await main().locator("button[aria-expanded]").first().click(); await settle(300); names = main().locator(`button[title="${TITLE.tracker}"]`); }
    const name = (await names.first().innerText()).trim();
    await clickLink(main(), name, TITLE.tracker);
    expect([await activeTab(), await panelName()], ["tracker", name], "after the name");
    await closePanel();
  });
  await check("20", "Saves to-do: sprite and species name open the tracker panel", async () => {
    await settings({ ...GEN4_START, viewMode: "saves" });
    await main().locator('[role="tab"]').filter({ hasText: /^To.?do/i }).first().click(); await settle(400);
    const step = main().locator("li").filter({ has: page.locator('input[type="checkbox"]') }).first();
    const links = step.locator(`button[title="${TITLE.tracker}"]`);
    ensure((await links.count()) >= 2, `a step has ${await links.count()} links, expected the sprite and the name`);
    const name = (await links.nth(1).innerText()).trim();
    await links.nth(1).click(); await settle(450);
    expect([await activeTab(), await panelName(), await step.locator("input").isChecked()], ["tracker", name, false], "after the name");
    await closePanel();
    await links.first().click(); await settle(450);
    expect(await panelName(), name, "after the sprite");
    await closePanel();
  });
  await check("20", "Saves plan: names in Bring, Catch, Evolve, Breed and No wild encounter rows", async () => {
    await main().locator('[role="tab"]').filter({ hasText: /^Plan/i }).first().click(); await settle(400);
    const sections = main().locator("section").filter({ has: page.locator("button[aria-expanded]") });
    const seen: string[] = [];
    for (let i = 0; i < (await sections.count()); i++) {
      const section = sections.nth(i);
      const title = (await section.locator("button[aria-expanded]").innerText()).split("\n")[0].trim();
      if ((await section.locator("ul").count()) === 0) { await section.locator("button[aria-expanded]").click(); await settle(250); }
      const rows = await section.locator("li").allInnerTexts();
      for (const kind of ["Bring", "Catch"]) {
        if (rows.some((row) => row.startsWith(kind)) && !seen.includes(kind)) {
          const row = section.locator("li").filter({ hasText: new RegExp(`^${kind}`) }).first();
          ensure((await row.locator(`button[title="${TITLE.tracker}"]`).count()) === 1, `${kind} row has no link`);
          seen.push(kind);
        }
      }
      if (/^(Evolve|Breed|No wild encounter)/.test(title)) {
        ensure((await section.locator(`li button[title="${TITLE.tracker}"]`).count()) >= (await section.locator("li").count()), `${title}: a row has no link`);
        seen.push(title.split(" ")[0]);
      }
      await section.locator("button[aria-expanded]").click(); await settle(150);
    }
    for (const kind of ["Bring", "Catch", "Evolve", "Breed", "No"]) ensure(seen.includes(kind), `no ${kind} row was found to check (saw ${seen.join(", ")})`);
    const first = sections.first();
    await first.locator("button[aria-expanded]").click(); await settle(250);
    const name = (await first.locator(`li button[title="${TITLE.tracker}"]`).first().innerText()).trim();
    await clickLink(first, name, TITLE.tracker);
    expect(await panelName(), name, "panel after a plan name");
    await closePanel();
  });
  await check("20", "Saves history: species lists link; the import review dialog's do not", async () => {
    await main().locator('[role="tab"]').filter({ hasText: /^History/i }).first().click(); await settle(400);
    await clickLink(main(), "Squirtle", TITLE.tracker);
    expect([await activeTab(), await panelName()], ["tracker", "Squirtle"], "after a history name");
    await closePanel();
    expect(reviewDialogLinks, 0, "links found inside the import review dialog");
  });
  await check("20", "Pokémon card: evolution name, moves and the Pokédex button", async () => {
    await main().locator('[role="tab"]').filter({ hasText: /^Boxes/i }).first().click(); await settle(400);
    const open = async () => {
      if ((await activeTab()) !== "tracker") await nav("tracker");
      await closePanel();
      if ((await main().locator("h3").filter({ hasText: /Bulbasaur/ }).count()) === 0) {
        await main().locator('button[title*="Bulbasaur"], button[aria-label*="Bulbasaur"]').first().click(); await settle(400);
      }
      return main().locator("xpath=.//h3[contains(., 'Bulbasaur')]/ancestor::div[contains(@class,'rounded-xl')][1]").first();
    };
    let card = await open();
    await clickLink(card, "Ivysaur", TITLE.tracker);
    expect([await activeTab(), await panelName()], ["tracker", "Ivysaur"], "after Evolves into");
    card = await open();
    await clickLink(card, "U-turn", TITLE.move);
    expect([await activeTab(), await attackdexMove()], ["attackdex", "U-turn"], "after the U-turn move");
    card = await open();
    await clickLink(card, "Will-O-Wisp", TITLE.move);
    expect(await attackdexMove(), "Will-O-Wisp", "after the Will-O-Wisp move");
    card = await open();
    ensure(!(await card.innerText()).match(/Met[\s\S]{0,80}/)?.[0].includes("Open in"), "unreachable");
    await card.locator("button").filter({ hasText: /^Pokédex$/ }).click(); await settle(450);
    expect([await activeTab(), await pokedexName()], ["pokedex", "Bulbasaur"], "after the Pokédex button");
  });
  await check("20", "Designer: species name, move names and the EV-tracker KO list", async () => {
    await nav("tracker");
    await closePanel();
    await main().locator("button").filter({ hasText: /^Send to Designer$/ }).click(); await settle(700);
    expect(await activeTab(), "designer", "tab after Send to Designer");
    const scope = body();
    await clickLink(scope, "Bulbasaur", TITLE.pokedex);
    expect([await activeTab(), await pokedexName()], ["pokedex", "Bulbasaur"], "after the species name");
    await nav("designer");
    await clickLink(scope, "U-turn", TITLE.move);
    expect([await activeTab(), await attackdexMove()], ["attackdex", "U-turn"], "after a move name");
    await nav("designer");
    const search = page.locator('input[placeholder^="Find grinders"]:visible').first();
    await search.scrollIntoViewIfNeeded(); await search.fill("bidoof"); await settle(400);
    await page.locator("button:visible").filter({ hasText: /Bidoof/ }).first().click(); await settle(400);
    await clickLink(scope, "Bidoof", TITLE.pokedex);
    expect([await activeTab(), await pokedexName()], ["pokedex", "Bidoof"], "after a KO-list name");
  });
  await check("20", "Routes: a name works from the keyboard; Great Marsh rows link", async () => {
    await nav("routes");
    await routesSearch("Route 201");
    await main().locator(".grid > button").filter({ hasText: /^\s*Route 201\s*$/ }).first().click(); await settle(400);
    const name = await link(main().locator("tbody"), "Starly", TITLE.pokedex);
    await name.focus(); await page.keyboard.press("Enter"); await settle(450);
    expect([await activeTab(), await pokedexName()], ["pokedex", "Starly"], "after Enter on a name");
    await nav("routes");
    await routesSearch("Great Marsh");
    await main().locator(".grid > button").first().click(); await settle(450);
    const banner = main().locator("xpath=.//*[normalize-space(text())='Daily Pokémon']/ancestor::div[contains(@class,'rounded-lg')][1]").first();
    const marshName = (await banner.locator(`tbody button[title="${TITLE.pokedex}"]`).first().innerText()).trim();
    await clickLink(banner, marshName, TITLE.pokedex);
    expect([await activeTab(), await pokedexName()], ["pokedex", marshName], "after a Great Marsh row");
  });
  await check("20", "Pokédex: Show in tracker — and hidden for a species outside the active generation", async () => {
    await settings({ ...GEN4_START, activeTab: "pokedex", activePokedexId: 387 });
    await clickLink(main(), "Show in tracker", TITLE.tracker);
    expect([await activeTab(), await panelName()], ["tracker", "Turtwig"], "after Show in tracker");
    await settings({ activeGeneration: 3, activeGames: [], dexMode: "national", activeTab: "pokedex", activePokedexId: 387 });
    expect(await pokedexName(), "Turtwig", "Pokédex still shows the Gen IV species");
    expect(await main().locator("button").filter({ hasText: /^Show in tracker$/ }).count(), 0, "Show in tracker links while Gen III is active");
    await settings({ ...GEN4_START });
  });
  await check("20", "Catch calc: the selected Pokémon's name opens the Pokédex", async () => {
    await nav("catch-calc");
    await main().locator('input[placeholder="Search by name…"]').fill("Gengar"); await settle(400);
    await main().locator("button").filter({ hasText: /Gengar/ }).first().click(); await settle(300);
    await clickLink(main(), "Gengar", TITLE.pokedex);
    expect([await activeTab(), await pokedexName()], ["pokedex", "Gengar"], "after the name");
  });
  await check("20", "Trainer lookup: a set's species and moves", async () => {
    await nav("trainer-lookup");
    await pickTrainer();
    const species = body().locator(`button[title="${TITLE.pokedex}"]:visible`).first();
    const name = (await species.innerText()).trim();
    await clickLink(body(), name, TITLE.pokedex);
    expect([await activeTab(), await pokedexName()], ["pokedex", name], "after the species");
    await nav("trainer-lookup");
    const move = (await body().locator(`button[title="${TITLE.move}"]:visible`).first().innerText()).trim();
    await clickLink(body(), move, TITLE.move);
    expect(await activeTab(), "attackdex", "after a move");
  });
  await check("20", "Damage calc: species header and the result strip's move names", async () => {
    await nav("trainer-lookup");
    await pickTrainer();
    await page.locator("button:visible").filter({ hasText: /^Load into Calc/ }).first().click(); await settle(700);   // the set → Pokémon 2
    expect(await activeTab(), "damage-calc", "tab after loading a set");
    for (const side of [0]) {   // Pokémon 1 from the set list; Pokémon 2 is the trainer's set
      const sets = page.locator("button:visible").filter({ hasText: /Battle Tower Sets/ }).nth(side);
      await sets.scrollIntoViewIfNeeded(); await sets.click(); await settle(400);
      await page.locator("button:visible").filter({ hasText: /Energy Ball/ }).first().click(); await settle(900);
    }
    const header = page.locator(`button[title="${TITLE.pokedex}"]:visible`).first();
    const species = (await header.innerText()).trim();
    const strip = page.locator(`button[title="${TITLE.move}"]:visible`);
    ensure((await strip.count()) > 0, "no move names in a result strip");
    const move = (await strip.first().innerText()).trim();
    await strip.first().scrollIntoViewIfNeeded(); await strip.first().click(); await settle(500);
    expect([await activeTab(), await attackdexMove()], ["attackdex", move], "after a result move");
    await nav("damage-calc");
    await clickLink(page.locator("body"), species, TITLE.pokedex);
    expect([await activeTab(), await pokedexName()], ["pokedex", species], "after the species header");
  });

  // ── 21. The bottom sheet on a phone ───────────────────────────────────────
  if (mobile) {
    await check("21", "the detail panel is a bottom sheet; a link that leaves the tab closes it", async () => {
      await select(396);
      expect(await panel().getAttribute("role"), "dialog", "panel role at this width");
      await clickLink(panel().locator("table"), "Route 201", TITLE.route);
      expect([await activeTab(), await page.locator("aside:visible").count()], ["routes", 0], "after leaving");
      await nav("tracker");
      expect(await page.locator("aside:visible").count(), 0, "sheets open on return");
      await select(396);
      await panel().locator("button").filter({ hasText: /More Detail/ }).click(); await settle(450);
      await nav("tracker");
      expect(await page.locator("aside:visible").count(), 0, "sheets open after More Detail and back");
    });
  }

  // ── 22. Deep-link state is not persisted ──────────────────────────────────
  await check("22", "a reload doesn't reopen a route or move; the Pokédex keeps its Pokémon", async () => {
    await settings({ ...GEN4_START, activeTab: "pokedex", activePokedexId: 396 });
    await clickLink(main(), "Route 201", TITLE.route);
    const stored = await storedSettings();
    for (const field of ["activeRoute", "routeSearch", "activeAttackdexSlug", "selectedPokemonId"]) expect(stored[field], undefined, `persisted ${field}`);
    await page.reload(); await ready();
    expect(await activeTab(), "routes", "tab after reload");
    expect(await main().locator("tbody").count(), 0, "route tables after reload (the list should show)");
    await nav("pokedex");
    expect(await pokedexName(), "Starly", "Pokédex after reload");
    await nav("tracker");
    expect(await page.locator("aside:visible").count(), 0, "detail panels after reload");
  });

  // ── 13. No PokéAPI: the move features work with it blocked ────────────────
  await check("13", "Pokédex moves, Attackdex single/combo/HM, Designer picker and damage calc with pokeapi.co blocked", async () => {
    await settings({ ...GEN4_START, activeTab: "pokedex", activePokedexId: 94 });
    ensure((await main().innerText()).includes("Shadow Ball"), "Pokédex learnset is empty");
    await settings({ activeTab: "attackdex", lastAttackdexSlug: "surf", lastAttackdexMode: "single", lastAttackdexVersionGroup: "platinum" });
    await main().locator(`button:has(img)`).first().waitFor({ state: "visible", timeout: 8000 });
    ensure((await main().locator("button:has(img)").count()) > 50, "Attackdex shows few learners for Surf");
    await main().locator("button").filter({ hasText: /^Combo$/ }).first().click(); await settle(300);
    const slots = main().locator('input[type="text"]:visible');
    for (const [i, moveName] of ["Surf", "Ice Beam"].entries()) {
      if (i > 0 && (await slots.count()) <= i) { await main().locator("button").filter({ hasText: /Add move/ }).click(); await settle(250); }
      await slots.nth(i).fill(moveName); await settle(350);
      await main().locator("button").filter({ hasText: new RegExp(`^${moveName}$`) }).first().click(); await settle(350);
    }
    await settle(800);
    ensure(/\d+ Pokémon/.test(await main().innerText()) && (await main().locator("img").count()) > 10, "Combo found nothing for Surf + Ice Beam");
    await main().locator("button").filter({ hasText: /^HM$/ }).first().click(); await settle(300);
    await main().locator("button").filter({ hasText: /Surf/ }).first().click(); await settle(900);
    ensure((await main().locator("img").count()) > 10, "HM planner found nothing for Surf");
    await nav("designer");
    const slot = page.locator("div.border-dashed.cursor-pointer:visible").first();
    await slot.scrollIntoViewIfNeeded(); await slot.click(); await settle(900);
    const picker = page.locator('[role="dialog"]:visible').last();
    ensure((await picker.locator("button").count()) > 10, "the Designer move picker lists no moves");
    await page.keyboard.press("Escape"); await settle(200);
    if ((await page.locator('[role="dialog"]:visible').count()) > 0) await picker.locator('button[aria-label="Close"]').first().click();
    const calcMoves = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => /calc/i.test(k));
      return (JSON.parse(localStorage.getItem(key ?? "") ?? "{}").state?.slot1?.moves ?? []) as { name: string; power: number; notFound?: boolean }[];
    });
    ensure(calcMoves.some((m) => m.name === "Energy Ball" && m.power === 80), `damage calc moves: ${JSON.stringify(calcMoves)}`);
    expect(pokeapiRequests, [], "requests to pokeapi.co");
  });
}

let pokeapiRequests: string[] = [];
let reviewDialogLinks = 0;

/** Picks a trainer class and trainer whose roster has sets (a few early rosters list none). */
async function pickTrainer(): Promise<void> {
  const sets = () => page.locator(`button[title="${TITLE.move}"]:visible`).count();
  if ((await sets()) > 0) return;
  // The Platinum open-round rosters (unevolved Pokémon) have no set data; the super round does
  await page.locator("button:visible").filter({ hasText: /^Super/ }).first().click();
  await settle(250);
  const classSelect = page.locator("select:visible").first();
  const classes = await classSelect.locator("option").count();
  for (let c = classes - 1; c >= 1; c--) {
    await classSelect.selectOption({ index: c });
    await settle(250);
    await page.locator("select:visible").nth(1).selectOption({ index: 1 });
    await settle(450);
    if ((await sets()) > 0) return;
  }
  throw new Error("no trainer with sets was found");
}

// ── One width ────────────────────────────────────────────────────────────────

async function runWidth(browser: Browser, w: number, h: number): Promise<BrowserContext> {
  width = w;
  console.log(`\n── ${w} px ──`);
  const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 768, serviceWorkers: "allow" });
  pokeapiRequests = [];
  await context.route(/pokeapi\.co/, (route) => { pokeapiRequests.push(route.request().url()); return route.abort(); });
  page = await context.newPage();
  const problems: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !/Failed to load resource|net::ERR_/.test(text)) problems.push(text.slice(0, 200));
    if (/Content Security Policy/i.test(text)) problems.push(text.slice(0, 200));
  });
  page.on("pageerror", (err) => problems.push(`pageerror: ${err.message.slice(0, 200)}`));

  await page.goto(BASE);
  await page.locator("button").filter({ hasText: /^Use offline$/ }).click();
  await ready();
  await nav("pokedex");                 // any change, so the settings are written to storage
  await settings(GEN4_START);

  // Saves: a living dex, a playthrough to bring things over from, then a newer dump for the history
  await settings({ viewMode: "saves" });
  await importSave(livingDexSave(false), "platinum.sav");
  await finishReview();
  await main().locator("button").filter({ hasText: /My living dex/ }).first().click(); await settle(400);
  await importSave(playthroughSave(), "diamond.sav");
  await finishReview();
  await main().locator("button").filter({ hasText: /DAWN|Platinum/ }).first().click().catch(() => {});
  await settle(300);
  await importSave(livingDexSave(true), "platinum.sav");
  reviewDialogLinks = await page.locator('[role="dialog"]:visible button[title="Show in the tracker"]').count();
  await finishReview();
  await settings({ viewMode: "box" });

  await runChecks(problems);
  return context;
}

// ── 4, 6. Two devices and a real sync server ─────────────────────────────────

const SYNC = { user: "e2e", password: "e2e-password", token: "e2e-token" };   // throwaway values for the local server

async function syncChecks(browser: Browser): Promise<void> {
  width = 1440;
  console.log("\n── sync: two devices, real server ──");
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pokedex-e2e-sync-"));
  const { createApp } = createRequire(import.meta.url)("../sync-server/server.js") as {
    createApp: (config: Record<string, unknown>) => { listen: (port: number, cb: () => void) => Server };
  };
  // `vite preview` proxies /api and /health to this port, as nginx does in the image
  let api: Server;
  try {
    api = await new Promise<Server>((resolve, reject) => {
      const listening = createApp({ ...SYNC, dataDir }).listen(3001, () => resolve(listening));
      listening.on("error", reject);
    });
  } catch {
    await check("6", "two signed-in devices", async () => { throw new Error("port 3001 is in use — stop the other sync server and run again"); });
    return;
  }

  const device = async (): Promise<Page> => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const devicePage = await context.newPage();
    await devicePage.goto(BASE);
    await devicePage.locator('input[type="text"]').first().fill(SYNC.user);
    await devicePage.locator('input[type="password"]').fill(SYNC.password);
    await devicePage.locator("button").filter({ hasText: /^Sign in$/ }).click();
    page = devicePage;
    await ready();
    await nav("pokedex");
    await settings({ ...GEN4_START, activeGames: [] });
    return devicePage;
  };
  const mark = async (id: number) => {
    await select(id);
    await panel().locator("button").filter({ hasText: /^Mark as Caught$/ }).click();
    await closePanel();
  };
  const serverCaught = () => page.evaluate(async () => {
    const res = await fetch("/api/pull", { headers: { Authorization: `Bearer ${localStorage.getItem("pokedex_sync_token")}` } });
    return ((await res.json()).data?.tracker?.caughtByGen?.[4] ?? []).sort((a: number, b: number) => a - b) as number[];
  });
  const sorted = async () => (await caught(4)).sort((a, b) => a - b);

  try {
    const a = await device();
    const b = await device();

    await check("6", "two devices marking at the same time both end up with both marks", async () => {
      // Each marks a different Pokémon inside the same 2-second sync debounce, so their pushes race
      page = a; await mark(1);
      page = b; await mark(4);
      await page.waitForTimeout(6000);
      expect(await serverCaught(), [1, 4], "the server's copy");
      for (const d of [a, b]) { page = d; await page.reload(); await ready(); await page.waitForTimeout(2500); expect(await sorted(), [1, 4], "a device's marks after its next sync"); }
    });

    await check("4", "snapshot list and fetch need the token", async () => {
      page = a;
      const statuses = await page.evaluate(async () => [
        (await fetch("/api/snapshots")).status,
        (await fetch("/api/snapshots/2026-01-01T00", { headers: { Authorization: "Bearer wrong" } })).status,
      ]);
      expect(statuses, [401, 401], "status without / with a wrong token");
    });

    await check("4", "restoring a snapshot asks first, then replaces the marks and syncs", async () => {
      page = a;
      await nav("settings");
      await page.locator("button:visible").filter({ hasText: /^Show snapshots$/ }).click(); await settle(800);
      const rows = page.locator("li:visible").filter({ has: page.locator("button", { hasText: /^Restore…$/ }) });
      ensure((await rows.count()) > 0, "no snapshots are listed");
      await rows.last().locator("button").filter({ hasText: /^Restore…$/ }).click(); await settle(300);   // the oldest copy
      const confirm = page.locator('[role="alertdialog"]:visible').filter({ hasText: /Replace the marks/ });
      expect(await confirm.count(), 1, "confirmation prompts");
      expect(await sorted(), [1, 4], "marks while the prompt is open (nothing restored yet)");
      await confirm.locator("button").filter({ hasText: /^Cancel$/ }).click(); await settle(300);
      expect(await sorted(), [1, 4], "marks after Cancel");
      await rows.last().locator("button").filter({ hasText: /^Restore…$/ }).click(); await settle(300);
      await page.locator('[role="alertdialog"]:visible button').filter({ hasText: /^Restore this copy$/ }).click();
      await page.waitForTimeout(5000);
      const restored = await sorted();
      ensure(restored.length < 2, `the oldest copy should have fewer marks, got ${JSON.stringify(restored)}`);
      expect(await serverCaught(), restored, "the server after the restore synced");
      page = b; await page.reload(); await ready(); await page.waitForTimeout(2500);
      expect(await sorted(), restored, "the other device after its next sync");
    });
  } finally {
    await new Promise<void>((resolve) => { api.close(() => resolve()); api.closeAllConnections?.(); });
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

// ── 12. Offline, with the server gone ────────────────────────────────────────

async function offlineChecks(context: BrowserContext, server: PreviewServer): Promise<void> {
  await check("12", "the manifest is valid and its icons exist", async () => {
    const manifest = await page.evaluate(async () => {
      const href = document.querySelector('link[rel="manifest"]')?.getAttribute("href") ?? "";
      const body = await (await fetch(href)).json();
      const icons = await Promise.all((body.icons as { src: string }[]).map(async (icon) => (await fetch(`/${icon.src}`)).status));
      return { name: body.name, start: body.start_url, display: body.display, sizes: (body.icons as { sizes: string }[]).map((i) => i.sizes), icons };
    });
    expect(manifest, { name: "Pokédex Tracker", start: "/", display: "standalone", sizes: ["192x192", "512x512", "512x512"], icons: [200, 200, 200] }, "manifest");
  });
  await check("12", "after one load the app, pokemon.json and the move data work with no network", async () => {
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(async () => (await caches.keys()).some((k) => k.includes("precache")), undefined, { timeout: 20000 });
    await settle(2500);
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
    server.httpServer.closeAllConnections?.();
    await context.setOffline(true);
    await page.evaluate(() => {
      const key = "pokedex-settings-v1";
      const stored = JSON.parse(localStorage.getItem(key)!);
      Object.assign(stored.state, { activeTab: "pokedex", activePokedexId: 94 });
      localStorage.setItem(key, JSON.stringify(stored));
    });
    await page.reload();
    await ready();
    expect(await pokedexName(), "Gengar", "Pokédex after an offline reload");
    ensure((await main().innerText()).includes("Shadow Ball"), "learnsets did not load offline");
    await nav("tracker");
    ensure((await main().locator('[title^="#001 "]').count()) === 1, "the tracker grid did not load offline");
  });
  await check("12", "/api is never answered from the cache", async () => {
    const outcome = await page.evaluate(async () => {
      const network = await fetch("/api/pull").then((r) => `answered ${r.status}`, () => "network error");
      const inCache = (await Promise.all((await caches.keys()).map(async (name) => (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname)))).flat();
      return { network, cachedApi: inCache.filter((p) => p.startsWith("/api") || p === "/health") };
    });
    expect(outcome, { network: "network error", cachedApi: [] }, "offline /api");
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function launch(): Promise<Browser> {
  const headless = !process.env.E2E_HEADED;
  for (const channel of [undefined, "chrome", "msedge"] as const) {
    try { return await chromium.launch({ headless, channel }); } catch { /* try the next browser */ }
  }
  throw new Error("No browser found. Install Chrome or Edge, or run `npx playwright install chromium`.");
}

async function run(): Promise<void> {
  if (!fs.existsSync(path.join(ROOT, "dist/index.html"))) throw new Error("dist/ is missing — run `npm run build` first (or `npm run e2e`).");
  const server = await preview({ root: ROOT, preview: { port: PORT, strictPort: true }, logLevel: "silent" });
  const browser = await launch();
  try {
    const widths = ([[1440, 900], [375, 812]] as const).filter(([w]) => !process.env.E2E_ONLY || String(w) === process.env.E2E_ONLY);
    let context: BrowserContext | null = null;
    for (const [w, h] of widths) {
      if (context) await context.close();
      context = await runWidth(browser, w, h);
    }
    const lastPage = page;
    if (!process.env.E2E_ONLY) await syncChecks(browser);
    page = lastPage;
    if (context) await offlineChecks(context, server);
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.httpServer.close(() => resolve())).catch(() => {});
  }

  // ── Report ──
  const items = [...new Set(results.map((r) => r.item))].sort((a, b) => Number(a) - Number(b));
  console.log("\nItem  Result  Checks");
  for (const item of items) {
    const of = results.filter((r) => r.item === item);
    const failed = of.filter((r) => !r.ok);
    console.log(`${item.padEnd(5)} ${failed.length ? "FAIL  " : "pass  "} ${of.length - failed.length}/${of.length}`);
    for (const f of failed) console.log(`        ✖ @${f.width} ${f.name}: ${f.note}`);
  }
  const failures = results.filter((r) => !r.ok).length;
  console.log(failures ? `\n${failures} check(s) failed` : `\nAll ${results.length} checks passed`);
  process.exit(failures ? 1 : 0);
}

run().catch((err) => { console.error(err); process.exit(1); });
