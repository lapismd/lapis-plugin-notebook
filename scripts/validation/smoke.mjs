import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

if (process.platform === "linux") {
  assert.notEqual(process.pid, 1, "Docker worker must run under --init");
  const directory = await mkdtemp(join(tmpdir(), "lapis-notebook-denied-write-"));
  try {
    await chmod(directory, 0o500);
    await assert.rejects(() => writeFile(join(directory, "denied"), "probe"), {
      code: "EACCES",
    });
    console.log("Linux denied-directory write smoke passed");
  } finally {
    await chmod(directory, 0o700);
    await rm(directory, { recursive: true, force: true });
  }
}

const require = createRequire(
  import.meta.resolve("@vitest/browser-playwright/package.json"),
);
const { chromium } = require("playwright");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(
    '<label>Probe<input aria-label="Probe"></label><button>Ready</button>',
  );
  await page
    .getByRole("textbox", { name: "Probe" })
    .fill("Docker browser ready");
  if (
    (await page.getByRole("textbox", { name: "Probe" }).inputValue()) !==
    "Docker browser ready"
  )
    throw Error("Browser smoke failed");
  console.log(`Headless Chromium smoke passed: ${browser.version()}`);
} finally {
  await browser.close();
}
