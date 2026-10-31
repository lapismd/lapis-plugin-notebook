export const LAPIS_NOTEBOOK_GLOBAL = "lapis";

export const LAPIS_BUILTIN_NAMES = [
  "aapl",
  "alphabet",
  "cars",
  "citywages",
  "diamonds",
  "code",
  "text",
  "markdown",
  "md",
  "html",
  "tex",
  "svg",
  "dom",
  "table",
  "chart",
  "image",
  "error",
  "duckdb",
  "vault",
  "FileAttachment",
  "d3",
  "Plot",
  "DOM",
  "flare",
  "Generators",
  "industries",
  "invalidation",
  "miserables",
  "now",
  "olympians",
  "penguins",
  "pizza",
  "Promises",
  "weather",
  "view",
  "Inputs",
] as const;

export type LapisBuiltinName = (typeof LAPIS_BUILTIN_NAMES)[number];

export const DOCUMENTED_BARE_NOTEBOOK_GLOBALS = [
  "aapl",
  "alphabet",
  "cars",
  "citywages",
  "diamonds",
  "Inputs",
  "html",
  "md",
  "tex",
  "svg",
  "d3",
  "Plot",
  "DOM",
  "flare",
  "Generators",
  "industries",
  "invalidation",
  "miserables",
  "now",
  "olympians",
  "penguins",
  "pizza",
  "Promises",
  "weather",
] as const;

export type NotebookBareGlobalName =
  (typeof DOCUMENTED_BARE_NOTEBOOK_GLOBALS)[number];

export const RESERVED_NOTEBOOK_GLOBAL_NAMES = [
  LAPIS_NOTEBOOK_GLOBAL,
  "viewof",
  ...DOCUMENTED_BARE_NOTEBOOK_GLOBALS,
] as const;

export interface NotebookGlobalNameValidation {
  ok: boolean;
  reason?: "empty" | "invalid-identifier" | "reserved" | "duplicate";
  message?: string;
}

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function isValidNotebookGlobalName(name: string): boolean {
  return IDENTIFIER_RE.test(name);
}

export function isReservedNotebookGlobalName(name: string): boolean {
  return (RESERVED_NOTEBOOK_GLOBAL_NAMES as readonly string[]).includes(name);
}

export function validateNotebookGlobalName(
  name: string,
  existingNames: Iterable<string> = [],
): NotebookGlobalNameValidation {
  const trimmed = name.trim();
  if (!trimmed) {
    return {
      ok: false,
      reason: "empty",
      message: "Global name is required.",
    };
  }
  if (!isValidNotebookGlobalName(trimmed)) {
    return {
      ok: false,
      reason: "invalid-identifier",
      message: "Global name must be a valid JavaScript identifier.",
    };
  }
  if (isReservedNotebookGlobalName(trimmed)) {
    return {
      ok: false,
      reason: "reserved",
      message: `${trimmed} is reserved by the Lapis notebook runtime.`,
    };
  }
  if (new Set(existingNames).has(trimmed)) {
    return {
      ok: false,
      reason: "duplicate",
      message: `${trimmed} is already used by another notebook dependency.`,
    };
  }
  return { ok: true };
}
