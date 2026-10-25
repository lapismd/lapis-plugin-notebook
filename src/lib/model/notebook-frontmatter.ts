import type { NotebookFrontmatter } from "@lapis-notes/notebook-core";

export type {
  NotebookFrontmatter,
  NotebookMode,
} from "@lapis-notes/notebook-core";

export const DEFAULT_NOTEBOOK_FRONTMATTER: NotebookFrontmatter = {
  version: 1,
  mode: "lazy",
  mounts: {},
};

function normalizeNotebookAutorun(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return undefined;
}

export function resolveNotebookAutoRunPreference(
  frontmatter: NotebookFrontmatter | null | undefined,
  fallback: boolean,
): boolean {
  return typeof frontmatter?.autorun === "boolean"
    ? frontmatter.autorun
    : fallback;
}

export function normalizeNotebookFrontmatter(
  value: unknown,
): NotebookFrontmatter | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const mounts =
    record.mounts &&
    typeof record.mounts === "object" &&
    !Array.isArray(record.mounts)
      ? Object.fromEntries(
          Object.entries(record.mounts as Record<string, unknown>).map(
            ([key, mount]) => [key, String(mount)],
          ),
        )
      : {};
  const autorun = normalizeNotebookAutorun(record.autorun);

  return {
    version:
      typeof record.version === "number" && Number.isFinite(record.version)
        ? record.version
        : DEFAULT_NOTEBOOK_FRONTMATTER.version,
    mode:
      record.mode === "autorun" ? "autorun" : DEFAULT_NOTEBOOK_FRONTMATTER.mode,
    ...(autorun === undefined ? {} : { autorun }),
    mounts,
  };
}
