import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
const root = process.cwd();
const directories = ["src/lib/render/table", "src/stories/tables"];
const extra = [
  "packages/input/src/input-host.ts",
  "packages/input/src/table-input.ts",
  "packages/input/src/table-model.ts",
  "packages/input/src/__tests__/table-model.test.ts",
  "scripts/validation/archive-projection.mjs",
  "scripts/validation/review-forward.mjs",
  "scripts/validation/review-server.mjs",
  "scripts/validation/review-stop.mjs",
  "scripts/validation/review.test.mjs",
];
const files = [
  ...directories.flatMap((directory) =>
    readdirSync(directory)
      .filter((file) => /\.(?:ts|js|mjs|svelte)$/.test(file))
      .map((file) => directory + "/" + file),
  ),
  ...extra,
];
it.each(files)("keeps %s within 300 physical lines", (file) => {
  const source = readFileSync(resolve(root, file), "utf8");
  expect(
    source.split("\n").length - Number(source.endsWith("\n")),
    file,
  ).toBeLessThanOrEqual(300);
});
