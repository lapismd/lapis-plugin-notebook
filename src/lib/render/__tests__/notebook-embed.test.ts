import { beforeEach, expect, test, vi } from "vitest";
const harness = vi.hoisted(() => ({
  mount: vi.fn((_component: unknown, _options: any) => ({})),
  unmount: vi.fn(async () => {}),
}));
vi.mock("svelte", () => harness);
vi.mock("../notebook-embed.svelte", () => ({ default: {} }));
vi.mock("@lapis-notes/api", () => ({
  Notice: class {},
  diagnosticResourceForPath: (path: string) => ({ uri: path }),
}));
import { registerNotebookEmbeds } from "../notebook-embed";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
function fixture() {
  let embedder: any;
  const cleanups: Array<() => void> = [];
  const diagnostics = { set: vi.fn(), delete: vi.fn() };
  const plugin = {
    createDiagnosticCollection: () => diagnostics,
    registerMarkdownEmbedder: (render: any) => {
      embedder = render;
    },
    register: (cleanup: () => void) => cleanups.push(cleanup),
  } as any;
  registerNotebookEmbeds(plugin);
  const app = {};
  const render = (path: string, parentElement: unknown = null) =>
    embedder({
      app,
      file: { path },
      containerEl: { parentElement, isConnected: true },
    });
  const renderContainer = (containerEl: unknown) =>
    embedder({ app, file: { path: "Analysis.notebook.md" }, containerEl });
  return { app, render, renderContainer, diagnostics, cleanups };
}
test("claims only notebook suffixes and uses the explicitly supplied App", async () => {
  const ctx = fixture();
  expect(ctx.render("Report.md")).toBe(false);
  expect(ctx.render("data.csv")).toBe(false);
  expect(harness.mount).not.toHaveBeenCalled();
  expect(ctx.render("Analysis.NOTEBOOK.MD").destroy).toBeTypeOf("function");
  await Promise.resolve();
  expect(harness.mount).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      props: expect.objectContaining({ app: ctx.app, recursive: false }),
    }),
  );
});

test("defers connected mounts outside the host render effect", async () => {
  const ctx = fixture();
  ctx.render("Analysis.notebook.md");
  expect(harness.mount).not.toHaveBeenCalled();
  await Promise.resolve();
  expect(harness.mount).toHaveBeenCalledOnce();
});

test("defers component unmount outside the host cleanup effect", async () => {
  const ctx = fixture();
  const handle = ctx.render("Analysis.notebook.md");
  await Promise.resolve();
  const destroyed = handle.destroy();
  expect(harness.unmount).not.toHaveBeenCalled();
  await destroyed;
  expect(harness.unmount).toHaveBeenCalledOnce();
});
test("only marks ancestor references recursive, allowing sibling embeds", async () => {
  const ctx = fixture();
  ctx.render("Analysis.notebook.md", {
    dataset: { notebookEmbed: "Analysis.notebook.md" },
    parentElement: null,
  });
  await Promise.resolve();
  expect(harness.mount.mock.calls.at(-1)?.[1]).toMatchObject({
    props: { recursive: true },
  });
  ctx.render("Analysis.notebook.md");
  await Promise.resolve();
  expect(harness.mount.mock.calls.at(-1)?.[1]).toMatchObject({
    props: { recursive: false },
  });
});
test("waits for attachment before testing notebook ancestry", () => {
  let changed!: () => void;
  const disconnect = vi.fn();
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: () => void) {
        changed = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const ctx = fixture();
  const container = {
    isConnected: false,
    parentElement: null as unknown,
    ownerDocument: {},
  };
  ctx.renderContainer(container);
  expect(harness.mount).not.toHaveBeenCalled();
  container.parentElement = {
    dataset: { notebookEmbed: "Analysis.notebook.md" },
    parentElement: null,
  };
  container.isConnected = true;
  changed();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(harness.mount.mock.calls.at(-1)?.[1]).toMatchObject({
    props: { recursive: true },
  });
});

test("publishes embed read failures to Problems and clears recovered errors", async () => {
  const ctx = fixture();
  ctx.render("Analysis.notebook.md");
  await Promise.resolve();
  const props = (harness.mount.mock.calls.at(-1) as any)[1].props;
  props.onError("Analysis.notebook.md", "Read denied");
  expect(ctx.diagnostics.set).toHaveBeenCalledWith(
    { uri: "Analysis.notebook.md" },
    [
      expect.objectContaining({
        message: "Read denied",
        severity: "error",
        code: "embed",
      }),
    ],
  );
  props.onError("Analysis.notebook.md");
  expect(ctx.diagnostics.delete).toHaveBeenCalledWith({
    uri: "Analysis.notebook.md",
  });
});

test("disposes an attachment observer before its container is mounted", async () => {
  let changed!: () => void;
  const disconnect = vi.fn();
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: () => void) {
        changed = callback;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const ctx = fixture();
  const container = { isConnected: false, ownerDocument: {} };
  const handle = ctx.renderContainer(container);
  await handle.destroy();
  container.isConnected = true;
  changed();
  expect(disconnect).toHaveBeenCalledOnce();
  expect(harness.mount).not.toHaveBeenCalled();
});
test("destroy is idempotent and plugin unload disposes remaining embeds", async () => {
  const ctx = fixture();
  const first = ctx.render("Analysis.notebook.md");
  ctx.render("Other.notebook.md");
  await Promise.resolve();
  await first.destroy();
  await first.destroy();
  expect(harness.unmount).toHaveBeenCalledOnce();
  ctx.cleanups.forEach((cleanup) => cleanup());
  await Promise.resolve();
  expect(harness.unmount).toHaveBeenCalledTimes(2);
});
