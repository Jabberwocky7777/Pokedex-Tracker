#!/usr/bin/env node
/**
 * Version and release helpers. package.json's "version" (semver) is the one
 * source of truth; everything else is derived from it:
 *
 *   package.json  1.8.0   the source
 *   app version   1.8     a trailing ".0" patch is dropped (1.5.1 stays 1.5.1)
 *   iOS           MARKETING_VERSION = 1.8  (both build configurations)
 *   git tag       v1.8
 *   apps.json     "version": "1.8"         (written after the IPA is released)
 *
 * SideStore refuses an install whose apps.json version differs from the IPA's
 * CFBundleShortVersionString (MARKETING_VERSION), which is why they must agree.
 *
 *   node scripts/release.mjs set <version>     write package.json, its lockfile and project.pbxproj
 *   node scripts/release.mjs check [--tag vX]  fail if they disagree (or with the tag)
 *   node scripts/release.mjs notes <version> [--backfill]   release notes from CHANGELOG.md, on stdout
 *   node scripts/release.mjs source <version> <ipa> [date]   point apps.json at that release
 */
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "Jabberwocky7777/Pokedex-Tracker";
const PBXPROJ = "ios/App/App.xcodeproj/project.pbxproj";
const MARKETING = /MARKETING_VERSION = ([^;]+);/g;

const read = (path) => readFileSync(join(ROOT, path), "utf8");
const write = (path, text) => writeFileSync(join(ROOT, path), text);
const readJson = (path) => JSON.parse(read(path));
const writeJson = (path, value) => write(path, JSON.stringify(value, null, 2) + "\n");

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** "1.8" → "1.8.0"; "1.5.1" stays */
function toSemver(version) {
  if (!/^\d+\.\d+(\.\d+)?$/.test(version)) fail(`Not a version: "${version}" (expected 1.8 or 1.8.1)`);
  return version.split(".").length === 2 ? `${version}.0` : version;
}

/** "1.8.0" → "1.8"; "1.5.1" stays */
function toAppVersion(semver) {
  return semver.replace(/^(\d+\.\d+)\.0$/, "$1");
}

function marketingVersions() {
  return [...new Set([...read(PBXPROJ).matchAll(MARKETING)].map((m) => m[1].trim()))];
}

function set(version) {
  const semver = toSemver(version);
  const app = toAppVersion(semver);

  const pkg = readJson("package.json");
  pkg.version = semver;
  writeJson("package.json", pkg);

  const lock = readJson("package-lock.json");
  lock.version = semver;
  lock.packages[""].version = semver;
  writeJson("package-lock.json", lock);

  write(PBXPROJ, read(PBXPROJ).replace(MARKETING, `MARKETING_VERSION = ${app};`));

  console.log(
    `package.json ${semver}, MARKETING_VERSION ${app}. Tag it v${app} once CHANGELOG.md has a [${app}] section.`,
  );
}

function check(tag) {
  const semver = readJson("package.json").version;
  const app = toAppVersion(semver);
  const problems = [];

  const lock = readJson("package-lock.json");
  if (lock.version !== semver || lock.packages[""].version !== semver)
    problems.push(`package-lock.json says ${lock.version}; run npm install`);

  const marketing = marketingVersions();
  if (marketing.length !== 1 || marketing[0] !== app)
    problems.push(`${PBXPROJ} has MARKETING_VERSION ${marketing.join(", ")}; expected ${app}`);

  if (tag !== undefined && tag !== `v${app}`) problems.push(`tag ${tag} doesn't match the version: expected v${app}`);

  if (problems.length) fail(`Version mismatch (package.json is ${semver}):\n- ${problems.join("\n- ")}`);
  console.log(`Version ${app} (package.json ${semver}) agrees everywhere${tag ? `, tag ${tag} included` : ""}.`);
}

/** The CHANGELOG.md section for one version, without its heading */
function changelogSection(app) {
  const lines = read("CHANGELOG.md").split("\n");
  const start = lines.findIndex((l) => l.startsWith(`## [${app}]`));
  if (start < 0) fail(`CHANGELOG.md has no "## [${app}]" section`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("## ") || l.startsWith("[") || l.startsWith("<!--"));
  return (end < 0 ? rest : rest.slice(0, end)).join("\n").trim();
}

/**
 * Release notes in the shape of .github/RELEASE_TEMPLATE.md: the section's
 * opening paragraph becomes Highlights, its ### headings become ## headings,
 * "### Upgrade notes" moves into the install section at the end.
 *
 * `backfill` is for releases made before this script: they have only the IPA
 * attached, and the AltStore source no longer offers them, so the install
 * section says just that.
 */
function notes(version, backfill = false) {
  const app = toAppVersion(toSemver(version));
  const section = changelogSection(app);
  const parts = section.split(/^### /m);
  const highlights = parts[0].trim();
  let body = "";
  let upgrade = "";
  for (const part of parts.slice(1)) {
    const [heading, ...text] = part.split("\n");
    const content = text.join("\n").trim();
    if (heading.trim().toLowerCase() === "upgrade notes") upgrade = content;
    else body += `## ${heading.trim()}\n\n${content}\n\n`;
  }

  const template = read(".github/RELEASE_TEMPLATE.md").replace(/<!--[\s\S]*?-->\n?/g, "");
  const install = backfill
    ? `## Install / upgrade\n\n${upgrade}\n\nThe AltStore / SideStore source offers the latest release; the \`PokedexTracker.ipa\` below is ${app}, for installing by hand.`
    : template
        .slice(template.indexOf("## Install / upgrade"))
        .replaceAll("{{VERSION}}", app)
        .replace("{{UPGRADE_NOTES}}", upgrade);
  const out = [
    highlights ? `## Highlights\n\n${highlights}\n\n` : "",
    body,
    install.trim(),
    `\n\n**Full changelog:** [CHANGELOG.md](https://github.com/${REPO}/blob/main/CHANGELOG.md)`,
  ].join("");
  process.stdout.write(out.replace(/\n{3,}/g, "\n\n") + "\n");
}

function source(version, ipa, date = new Date().toISOString().slice(0, 10)) {
  if (!ipa) fail("Usage: release.mjs source <version> <path to the .ipa> [YYYY-MM-DD]");
  const app = toAppVersion(toSemver(version));
  const marketing = marketingVersions();
  if (marketing.length !== 1 || marketing[0] !== app)
    fail(`MARKETING_VERSION is ${marketing.join(", ")}, not ${app}: SideStore would refuse the install`);

  const apps = readJson("apps.json");
  Object.assign(apps.apps[0], {
    version: app,
    versionDate: date,
    downloadURL: `https://github.com/${REPO}/releases/download/v${app}/PokedexTracker.ipa`,
    size: statSync(ipa).size,
  });
  writeJson("apps.json", apps);
  console.log(`apps.json → ${app}, ${date}, ${apps.apps[0].size} bytes`);
}

const [command, ...args] = process.argv.slice(2);
if (command === "set" && args[0]) set(args[0]);
else if (command === "check") check(args[0] === "--tag" ? args[1] : undefined);
else if (command === "notes" && args[0]) notes(args[0], args.includes("--backfill"));
else if (command === "source" && args[0]) source(args[0], args[1], args[2]);
else
  fail(
    "Usage: node scripts/release.mjs set <version> | check [--tag vX.Y] | notes <version> | source <version> <ipa> [date]",
  );
