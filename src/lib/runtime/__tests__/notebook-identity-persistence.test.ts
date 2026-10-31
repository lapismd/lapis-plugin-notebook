import { expect, test, vi } from "vitest";
import { stringify } from "yaml";
import { parseNotebookDocument } from "../../parse/parse-notebook-document";
import { NotebookSession } from "../notebook-session";
import {
  deleteNotebookPersistedState,
  loadNotebookPersistedState,
  restoreNotebookPersistedState,
  saveNotebookPersistedState,
} from "../notebook-output-store";

const UUID = "8e627840-f468-4d72-912e-6136c21317ba";
const stateKey = `plugin:lapis-notebook:state:v1:${UUID}`;
const body =
  ':::cell{#controls lang="js"}\n```js\nconst name = view(Inputs.text({value: "Ada"}));\n```\n:::\n';

test("reads the source UUID while frontmatter metadata is still stale", () => {
  const document = parseNotebookDocument(
    `---\nnotebook:\n  version: 1\n  id: ${UUID}\n---\n${body}`,
    {
      sourcePath: "Original.notebook.md",
      frontmatter: { version: 1 },
    },
  );
  expect(document.frontmatter?.id).toBe(UUID);
});

function fixture(id?: string) {
  const file = { path: "Original.notebook.md", stat: { mtime: 123 } };
  const frontmatter = { notebook: { version: 1, ...(id ? { id } : {}) } };
  const meta = new Map<string, unknown>();
  const legacy = new Map<string, any>();
  const source = () => `---\n${stringify(frontmatter)}---\n${body}`;
  const app = {
    vault: {
      getFileByPath: (path: string) => (path === file.path ? file : null),
      cachedRead: async () => source(),
    },
    metadataCache: { getFileCache: () => ({ frontmatter }) },
    fileManager: {
      processFrontMatter: vi.fn(async (_file, mutate) => mutate(frontmatter)),
    },
    appDatabase: {
      getMeta: vi.fn(async (key: string) => meta.get(key)),
      setMeta: vi.fn(async (key: string, value: unknown) => {
        meta.set(key, value);
      }),
      getNotebookState: vi.fn(async (path: string) => legacy.get(path)),
      setNotebookState: vi.fn(async (path: string, value: unknown) => {
        legacy.set(path, value);
      }),
      deleteNotebookState: vi.fn(async (path: string) => {
        legacy.delete(path);
      }),
    },
  } as any;
  const document = () =>
    parseNotebookDocument(source(), { sourcePath: file.path });
  const session = new NotebookSession(document());
  session.setCellOutput("controls", [
    {
      kind: "input",
      cellId: "controls",
      variableName: "name",
      inputType: "text",
      value: "Grace",
      reconstructable: true,
      source: { library: "@lapis-notes/notebook-input", factory: "text" },
    },
  ]);
  session.setInputValue("controls", "name", "Grace");
  return { app, file, frontmatter, meta, legacy, source, document, session };
}

test("creates and persists a notebook UUID before saving generated state", async () => {
  const ctx = fixture();
  await saveNotebookPersistedState(ctx.app, ctx.file as any, ctx.session);
  expect(ctx.frontmatter.notebook).toEqual({
    version: 1,
    id: expect.stringMatching(
      /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
    ),
  });
  expect(ctx.app.fileManager.processFrontMatter).toHaveBeenCalledOnce();
  expect(ctx.app.appDatabase.setNotebookState).not.toHaveBeenCalled();
});

test("restores saved controls after a rename without executing their cells", async () => {
  const ctx = fixture(UUID);
  await saveNotebookPersistedState(ctx.app, ctx.file as any, ctx.session);
  ctx.file.path = "Folder/Renamed.notebook.md";
  const saved = await loadNotebookPersistedState(ctx.app, ctx.file.path, UUID);
  expect(saved).toBeDefined();
  const reopened = new NotebookSession(ctx.document());
  restoreNotebookPersistedState(reopened, saved!);
  expect(reopened.getCellInputValues("controls")).toEqual({ name: "Grace" });
  expect(reopened.getCellState("controls").output?.[0]).toMatchObject({
    kind: "input",
    value: "Grace",
  });
  expect(ctx.app.fileManager.processFrontMatter).not.toHaveBeenCalled();
});

test("prefers UUID state over an older path-keyed record", async () => {
  const ctx = fixture(UUID);
  const current = {
    sourcePath: ctx.file.path,
    mtime: 123,
    updatedAt: 2,
    cells: {},
  };
  ctx.meta.set(stateKey, current);
  ctx.legacy.set(ctx.file.path, { ...current, updatedAt: 1 });
  expect(
    await loadNotebookPersistedState(ctx.app, ctx.file.path, UUID),
  ).toEqual(current);
});

test("reads legacy state but never resurrects it after clearing UUID state", async () => {
  const ctx = fixture(UUID);
  const saved = {
    sourcePath: ctx.file.path,
    mtime: 123,
    updatedAt: 1,
    cells: {},
  };
  ctx.legacy.set(ctx.file.path, saved);
  expect(
    await loadNotebookPersistedState(ctx.app, ctx.file.path, UUID),
  ).toEqual(saved);
  await deleteNotebookPersistedState(ctx.app, ctx.file.path, UUID);
  ctx.legacy.set(ctx.file.path, saved);
  expect(
    await loadNotebookPersistedState(ctx.app, ctx.file.path, UUID),
  ).toBeUndefined();
});

test("forks a copied UUID without exposing the existing notebook's saved values", async () => {
  const original = fixture(UUID);
  await saveNotebookPersistedState(
    original.app,
    original.file as any,
    original.session,
  );
  const copy = fixture(UUID);
  copy.file.path = "Copy.notebook.md";
  copy.app.appDatabase = original.app.appDatabase;
  copy.app.vault.getFileByPath = (path: string) =>
    path === original.file.path
      ? original.file
      : path === copy.file.path
        ? copy.file
        : null;
  copy.app.vault.cachedRead = async (file: any) =>
    file === original.file ? original.source() : copy.source();
  expect(
    await loadNotebookPersistedState(copy.app, copy.file.path, UUID),
  ).toBeUndefined();
  await saveNotebookPersistedState(copy.app, copy.file as any, copy.session);
  expect(copy.frontmatter.notebook.id).not.toBe(UUID);
  expect(original.meta.get(stateKey)).toMatchObject({
    sourcePath: original.file.path,
  });
  expect(
    await loadNotebookPersistedState(
      copy.app,
      copy.file.path,
      copy.frontmatter.notebook.id,
    ),
  ).toMatchObject({ sourcePath: copy.file.path });
});

test("assigns one persisted UUID when saves overlap", async () => {
  const ctx = fixture();
  await Promise.all([
    saveNotebookPersistedState(ctx.app, ctx.file as any, ctx.session),
    saveNotebookPersistedState(ctx.app, ctx.file as any, ctx.session),
  ]);
  expect(ctx.app.fileManager.processFrontMatter).toHaveBeenCalledOnce();
  expect(
    new Set(
      ctx.app.appDatabase.setMeta.mock.calls.map(([key]: [string]) => key),
    ).size,
  ).toBe(1);
});

test("clearing a copied UUID leaves the original notebook state intact", async () => {
  const original = fixture(UUID);
  await saveNotebookPersistedState(
    original.app,
    original.file as any,
    original.session,
  );
  const copy = fixture(UUID);
  copy.file.path = "Copy.notebook.md";
  copy.app.appDatabase = original.app.appDatabase;
  copy.app.vault.getFileByPath = (path: string) =>
    path === original.file.path
      ? original.file
      : path === copy.file.path
        ? copy.file
        : null;
  copy.app.vault.cachedRead = async (file: any) =>
    file === original.file ? original.source() : copy.source();
  await deleteNotebookPersistedState(copy.app, copy.file.path, UUID);
  expect(original.meta.get(stateKey)).toMatchObject({
    sourcePath: original.file.path,
    cells: { controls: { inputValues: { name: "Grace" } } },
  });
  expect(copy.frontmatter.notebook.id).not.toBe(UUID);
});

test("does not save generated state when persisting the UUID fails", async () => {
  const ctx = fixture();
  ctx.app.fileManager.processFrontMatter.mockRejectedValueOnce(
    new Error("Read-only file"),
  );
  await saveNotebookPersistedState(ctx.app, ctx.file as any, ctx.session);
  expect(ctx.app.appDatabase.setMeta).not.toHaveBeenCalled();
  expect(ctx.app.appDatabase.setNotebookState).not.toHaveBeenCalled();
});
