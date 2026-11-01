import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { init as initEsModuleLexer, parse } from "es-module-lexer";

const staticRequirePattern = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/gu;
const stringAssetReferencePattern =
  /["'`]((?:\.{1,2}\/)?[A-Za-z0-9_@./-]+\.(?:cjs|mjs|js|css|json|wasm|worker\.js|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf))["'`]/gu;
const cssUrlReferencePattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gu;
const scanTextFilePattern = /\.(?:cjs|mjs|js|css)$/u;
const javaScriptFilePattern = /\.(?:cjs|mjs|js)$/u;

export async function validateRuntimeEntryFileReferences({
  rootDir,
  entryFiles,
  files,
}) {
  const fileSet = new Set(files);
  for (const entryFile of entryFiles) {
    await validateJavaScriptGraph(rootDir, entryFile, fileSet);
  }
}

export async function traceReleaseInputFiles({
  rootDir,
  entryFiles,
  keepFiles = [],
}) {
  const allFiles = new Set(await listFiles(rootDir));
  const keep = new Set(
    [...keepFiles, ...entryFiles].filter((file) => allFiles.has(file)),
  );
  const pending = [...keep].filter((file) => scanTextFilePattern.test(file));
  const scanned = new Set();

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || scanned.has(current) || !allFiles.has(current)) {
      continue;
    }
    scanned.add(current);
    const source = await readFile(path.join(rootDir, current), "utf8");
    for (const reference of await collectFileReferences(current, source)) {
      const resolved = normalizeReference(current, reference);
      if (!resolved || !allFiles.has(resolved) || keep.has(resolved)) {
        continue;
      }
      keep.add(resolved);
      if (scanTextFilePattern.test(resolved)) {
        pending.push(resolved);
      }
    }
  }

  return [...keep].sort();
}

export function runtimeEntryFilesFromManifest(manifest) {
  const entries = manifest?.lapis?.runtime?.entries;
  if (!isPlainObject(entries)) {
    return [];
  }
  return Object.values(entries)
    .filter(isPlainObject)
    .flatMap((entry) => [entry.path, entry.fallbackPath])
    .filter((file) => typeof file === "string" && file.length > 0);
}

async function validateJavaScriptGraph(rootDir, entryFile, fileSet) {
  const pending = [entryFile];
  const scanned = new Set();
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || scanned.has(current)) {
      continue;
    }
    scanned.add(current);
    if (!fileSet.has(current)) {
      throw new Error(
        `Runtime entry graph references missing release file: ${current}`,
      );
    }
    if (!javaScriptFilePattern.test(current)) {
      continue;
    }

    const source = await readFile(path.join(rootDir, current), "utf8");
    for (const specifier of await collectStaticJavaScriptReferences(source)) {
      const resolved = normalizeReference(current, specifier);
      if (!resolved) {
        continue;
      }
      if (!fileSet.has(resolved)) {
        throw new Error(
          `Runtime entry ${entryFile} references missing local module ${specifier} from ${current}`,
        );
      }
      if (javaScriptFilePattern.test(resolved)) {
        pending.push(resolved);
      }
    }
  }
}

async function collectStaticJavaScriptReferences(source) {
  const references = [];
  const [imports] = await parseJavaScriptImports(source);
  for (const importRecord of imports) {
    if (importRecord.n?.startsWith(".")) {
      references.push(importRecord.n);
    }
  }
  const requireSource = maskJavaScriptTrivia(source);
  for (const match of requireSource.matchAll(staticRequirePattern)) {
    const specifier = match[1];
    if (specifier.startsWith(".")) {
      references.push(specifier);
    }
  }
  return references;
}

async function collectFileReferences(file, source) {
  const references = new Set();
  if (javaScriptFilePattern.test(file)) {
    for (const reference of await collectStaticJavaScriptReferences(source)) {
      references.add(reference);
    }
  }
  for (const match of source.matchAll(stringAssetReferencePattern)) {
    if (match[1]) references.add(match[1]);
  }
  for (const match of source.matchAll(cssUrlReferencePattern)) {
    if (match[1]) references.add(match[1]);
  }
  return references;
}

async function parseJavaScriptImports(source) {
  await initEsModuleLexer;
  try {
    return parse(source);
  } catch (error) {
    throw new Error(`Failed to parse JavaScript imports: ${error.message}`, {
      cause: error,
    });
  }
}

function maskJavaScriptTrivia(source) {
  let result = "";
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "'" || char === '"') {
      const end = consumeQuotedString(source, index, char);
      result += " ".repeat(end - index);
      index = end;
      continue;
    }
    if (char === "`") {
      const end = consumeTemplateLiteral(source, index);
      result += " ".repeat(end - index);
      index = end;
      continue;
    }
    if (char === "/" && next === "/") {
      const end = consumeLineComment(source, index);
      result += " ".repeat(end - index);
      index = end;
      continue;
    }
    if (char === "/" && next === "*") {
      const end = consumeBlockComment(source, index);
      result += " ".repeat(end - index);
      index = end;
      continue;
    }
    result += char;
    index += 1;
  }
  return result;
}

function consumeQuotedString(source, start, quote) {
  let index = start + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    index += 1;
    if (char === quote) {
      break;
    }
  }
  return index;
}

function consumeTemplateLiteral(source, start) {
  let index = start + 1;
  while (index < source.length) {
    const char = source[index];
    if (char === "\\") {
      index += 2;
      continue;
    }
    index += 1;
    if (char === "`") {
      break;
    }
  }
  return index;
}

function consumeLineComment(source, start) {
  const end = source.indexOf("\n", start + 2);
  return end === -1 ? source.length : end;
}

function consumeBlockComment(source, start) {
  const end = source.indexOf("*/", start + 2);
  return end === -1 ? source.length : end + 2;
}

function normalizeReference(fromFile, specifier) {
  const clean = stripQueryAndHash(specifier);
  if (
    !clean ||
    clean.startsWith("/") ||
    clean.includes("\\") ||
    /^[a-zA-Z][a-zA-Z\d+\-.]*:/u.test(clean)
  ) {
    return null;
  }
  if (!clean.startsWith(".") && !clean.includes("/")) {
    return null;
  }
  const resolved = clean.startsWith(".")
    ? path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), clean))
    : path.posix.normalize(clean);
  if (
    !resolved ||
    resolved.startsWith("../") ||
    resolved === ".." ||
    resolved.startsWith("/")
  ) {
    return null;
  }
  return resolved;
}

async function listFiles(dir, prefix = "") {
  const entries = await readdir(path.join(dir, prefix), {
    withFileTypes: true,
  });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(dir, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

function stripQueryAndHash(specifier) {
  return specifier.split(/[?#]/u, 1)[0];
}

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
