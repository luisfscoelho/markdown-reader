// End-to-end test: loads the extension in headless Firefox and checks the
// rendered page over http:// and file://. Set FIREFOX_BIN to pick the browser.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Builder } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ADDON_ID = "markdown-reader@luiscoelho";

// Work on a copy so the auto-reload test can edit the file.
const fixtures = mkdtempSync(join(tmpdir(), "markdown-reader-"));
cpSync(join(root, "test/fixtures"), fixtures, { recursive: true });
process.env.FIXTURES_DIR = fixtures;
await import("./serve.mjs");

const artifacts = join(fixtures, "artifacts");
execFileSync("npx", ["web-ext", "build", "--overwrite-dest", "-a", artifacts], { cwd: root });
const zip = join(artifacts, readdirSync(artifacts).find((name) => name.endsWith(".zip")));

// Recent Firefox makes file:// access opt-in per extension (about:addons); grant it here.
const options = new firefox.Options()
  .addArguments("-headless")
  .setPreference("extensions.webextensions.fileSchemeAccess.requireOptIn", false);
if (process.env.FIREFOX_BIN) options.setBinary(process.env.FIREFOX_BIN);
// System access lets the test open the popup page, which WebDriver cannot navigate to.
const service = new firefox.ServiceBuilder().addArguments("--allow-system-access");

const driver = await new Builder()
  .forBrowser("firefox")
  .setFirefoxOptions(options)
  .setFirefoxService(service)
  .build();
let failed = false;

const waitFor = (script, message) =>
  driver.wait(() => driver.executeScript(`return Boolean(${script})`), 10000, message);

const waitForRender = () =>
  waitFor(`document.documentElement.hasAttribute("data-mdr")`, "page was not rendered");

// Loads the popup in the current tab and changes settings through its controls.
async function changeSettings(values) {
  await driver.setContext(firefox.Context.CHROME);
  await driver.executeScript((id) => {
    const url = WebExtensionPolicy.getByID(id).getURL("src/popup/popup.html");
    gBrowser.selectedBrowser.fixupAndLoadURIString(url, {
      triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
    });
  }, ADDON_ID);
  await driver.setContext(firefox.Context.CONTENT);
  await waitFor(
    `location.protocol === "moz-extension:" && document.querySelector("[data-key=toc]")?.checked`,
    "popup did not load settings",
  );
  await waitFor(`!document.getElementById("hint").hidden`, "popup hint not shown off-page");

  await driver.executeScript((values) => {
    for (const [key, value] of Object.entries(values)) {
      const input = document.querySelector(`[data-key=${key}]`);
      input[input.type === "checkbox" ? "checked" : "value"] = value;
      input.dispatchEvent(new Event("change"));
    }
  }, values);
  await driver.sleep(300);
}

async function checkRendered(url) {
  await driver.get(url);
  await waitForRender();
  await waitFor(`document.querySelector("#mdr-content .mermaid svg")`, "mermaid diagram missing");
  await waitFor(`document.querySelector("#mdr-content img[alt=pixel]").naturalWidth`, "relative image blocked");

  const page = await driver.executeScript(() => {
    const content = document.querySelector("#mdr-content");
    const count = (selector) => content.querySelectorAll(selector).length;
    return {
      title: document.title,
      h1: content.querySelector("h1")?.textContent,
      highlighted: count(".hljs-keyword"),
      math: count(".katex"),
      tables: count("table"),
      tasks: count("input[type=checkbox]"),
      scripts: count("script"),
      handlers: count("[onerror]"),
      jsLinks: count("a[href^='javascript:']"),
      hacked: Boolean(window.hacked),
      toc: document.querySelectorAll("#mdr-toc a").length,
      duplicateIds: Boolean(document.getElementById("duplicate") && document.getElementById("duplicate-1")),
      sourceHidden: getComputedStyle(document.querySelector(".mdr-source")).display === "none",
      background: getComputedStyle(content).backgroundColor,
    };
  });

  assert.equal(page.title, "Markdown Reader sample");
  assert.equal(page.h1, "Markdown Reader sample");
  assert.ok(page.highlighted > 0, "code is highlighted");
  assert.ok(page.math >= 2, "math is rendered");
  assert.equal(page.tables, 1);
  assert.equal(page.tasks, 2);
  assert.equal(page.scripts + page.handlers + page.jsLinks, 0, "hostile HTML is removed");
  assert.equal(page.hacked, false);
  assert.ok(page.toc >= 10, "table of contents is built");
  assert.ok(page.duplicateIds, "duplicate headings get unique ids");
  assert.ok(page.sourceHidden, "raw source is hidden");
  assert.notEqual(page.background, "rgba(0, 0, 0, 0)", "theme stylesheet is applied");
}

async function checkAutoReload(url) {
  const file = join(fixtures, "sample.md");
  const original = readFileSync(file, "utf8");
  await driver.get(url);
  await waitForRender();
  writeFileSync(file, original.replace("# Markdown Reader sample", "# Reloaded"));
  try {
    await waitFor(`document.querySelector("#mdr-content h1")?.textContent === "Reloaded"`, "no auto reload");
  } finally {
    writeFileSync(file, original);
  }
}

async function step(name, run) {
  try {
    await run();
    console.log(`ok    ${name}`);
  } catch (error) {
    failed = true;
    console.log(`FAIL  ${name}\n      ${error.message}`);
  }
}

const httpUrl = "http://localhost:8765/sample.md";
const fileUrl = pathToFileURL(join(fixtures, "sample.md")).href;

try {
  await driver.installAddon(zip, true);

  await step("renders over http (text/markdown + strict CSP)", () => checkRendered(httpUrl));
  await step("renders over file://", () => checkRendered(fileUrl));

  await step("leaves HTML pages on .md URLs alone", async () => {
    await driver.get(`${httpUrl}?type=text/html`);
    await waitFor(`document.readyState === "complete"`, "page did not load");
    assert.equal(await driver.executeScript(`return document.documentElement.hasAttribute("data-mdr")`), false);
  });

  await step("settings saved in the popup apply to the page", async () => {
    await changeSettings({ theme: "dark", width: "full", toc: false, autoreload: true });
    await driver.get(httpUrl);
    await waitForRender();
    const page = await driver.executeScript(() => ({
      theme: document.documentElement.dataset.mdrTheme,
      width: document.documentElement.dataset.mdrWidth,
      toc: getComputedStyle(document.querySelector("#mdr-toc")).display,
      background: getComputedStyle(document.querySelector("#mdr-content")).backgroundColor,
    }));
    assert.deepEqual(page, { theme: "dark", width: "full", toc: "none", background: "rgb(13, 17, 23)" });
  });

  await step("auto reload over http", () => checkAutoReload(httpUrl));
  await step("auto reload over file://", () => checkAutoReload(fileUrl));
} finally {
  await driver.quit();
}

process.exit(failed ? 1 : 0);
