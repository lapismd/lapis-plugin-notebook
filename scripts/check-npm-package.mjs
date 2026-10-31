import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

export function privatePackageImports(source) {
  return ts
    .preProcessFile(source, true, true)
    .importedFiles.map(({ fileName }) => fileName)
    .filter((specifier) =>
      /^@lapis-notes\/notebook-[^/]+(?:\/|$)/u.test(specifier),
    );
}

export function checkNpmPackage(root) {
  const findings = [];
  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(?:m?js|d\.ts)$/u.test(entry.name)) {
        for (const specifier of privatePackageImports(
          readFileSync(file, "utf8"),
        ))
          findings.push(
            `${relative(root, file)} imports unpublished ${specifier}`,
          );
      }
    }
  }
  walk(join(root, "dist"));
  if (findings.length)
    throw Error(
      `npm package boundary: ${findings.length} private imports\n${findings.join("\n")}`,
    );
  console.log("npm runtime and declaration boundary passed.");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  checkNpmPackage(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
