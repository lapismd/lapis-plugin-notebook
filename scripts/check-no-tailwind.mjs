import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

const sourceRoot = resolve("src/lib");
const utilityPattern =
  /^(?:flex|inline-flex|grid|block|inline-block|hidden|absolute|relative|fixed|sticky|p[trblxy]?|m[trblxy]?|w|h|min-w|max-w|min-h|max-h|size|gap|space-[xy]|items|justify|content|self|place|bg|text|border|rounded|shadow|ring|font|leading|tracking|overflow|opacity|cursor|transition|duration|z)-/;
const standaloneUtilities = new Set([
  "flex",
  "inline-flex",
  "grid",
  "block",
  "inline-block",
  "hidden",
  "absolute",
  "relative",
  "fixed",
  "sticky",
]);

async function svelteFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await svelteFiles(path)));
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".svelte") &&
      !entry.name.endsWith(".stories.svelte")
    ) {
      files.push(path);
    }
  }
  return files;
}

function classValues(source) {
  return [...source.matchAll(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(
    (match) => ({
      value: match[1] ?? match[2] ?? "",
      offset: match.index ?? 0,
    }),
  );
}

const findings = [];
for (const file of await svelteFiles(sourceRoot)) {
  const source = await readFile(file, "utf8");
  for (const classValue of classValues(source)) {
    for (const rawToken of classValue.value.split(/\s+/).filter(Boolean)) {
      const token = rawToken.slice(rawToken.lastIndexOf(":") + 1);
      if (standaloneUtilities.has(token) || utilityPattern.test(token)) {
        findings.push({
          file: relative(process.cwd(), file),
          line: source.slice(0, classValue.offset).split("\n").length,
          token: rawToken,
        });
      }
    }
  }
}

if (findings.length) {
  console.error("Tailwind utilities remain in Notebook component sources:");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.token}`);
  }
  process.exitCode = 1;
} else {
  console.log("No Tailwind utilities found in Notebook component sources.");
}
