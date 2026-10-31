import type { App, TFile } from "@lapis-notes/api";

export type NotebookEmbedSource = {
  path: string;
  source: string;
  status: "loading" | "ready" | "missing" | "error";
  error?: string;
};

/** Owns file observation and rejects reads superseded by updates or teardown. */
export function observeNotebookEmbedSource(
  app: App,
  file: TFile,
  onChange: (state: NotebookEmbedSource) => void,
): () => void {
  let path = file.path;
  let revision = 0;
  let disposed = false;
  async function load(): Promise<void> {
    if (disposed) return;
    const version = ++revision;
    const currentPath = path;
    const currentFile = app.vault.getFileByPath(currentPath);
    if (!currentFile) {
      onChange({ path, source: "", status: "missing" });
      return;
    }
    try {
      const source = await app.vault.cachedRead(currentFile);
      if (!disposed && version === revision)
        onChange({ path: currentPath, source, status: "ready" });
    } catch (error) {
      if (!disposed && version === revision)
        onChange({
          path: currentPath,
          source: "",
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
    }
  }
  const modified = app.vault.on("modify", (candidate) => {
    if (candidate.path === path) void load();
  });
  const created = app.vault.on("create", (candidate) => {
    if (candidate.path === path) void load();
  });
  const renamed = app.vault.on("rename", (candidate, oldPath) => {
    if (oldPath !== path && !path.startsWith(`${oldPath}/`)) return;
    path = candidate.path + path.slice(oldPath.length);
    void load();
  });
  const deleted = app.vault.on("delete", (candidate) => {
    if (candidate.path !== path && !path.startsWith(`${candidate.path}/`))
      return;
    revision += 1;
    onChange({ path, source: "", status: "missing" });
  });
  onChange({ path, source: "", status: "loading" });
  void load();
  return () => {
    disposed = true;
    revision += 1;
    app.vault.offref(modified);
    app.vault.offref(created);
    app.vault.offref(renamed);
    app.vault.offref(deleted);
  };
}
