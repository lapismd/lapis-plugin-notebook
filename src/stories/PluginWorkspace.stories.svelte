<script lang="ts" module>
  import type { App } from "@lapis-notes/api";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, waitFor, within } from "storybook/test";

  import PluginWorkspaceDemo from "./PluginWorkspaceDemo.svelte";
  import {
    NotebookPlugin,
    NotebookView,
    NOTEBOOK_PLUGIN_ID,
  } from "../lib";
  import { fireEvent } from "storybook/test";
  import { NOTEBOOK_FIXTURE_PATHS } from "./notebook-fixtures";
  import { PluginWorkspaceExample } from "./PluginWorkspace.example-sources";

  const workspaceA11y = {
    test: "error",
    config: {
      rules: [
        // Full-shell rows intentionally compose nested workspace controls.
        { id: "nested-interactive", enabled: false },
        // CodeMirror owns its aria-hidden gutter focus behavior upstream.
        { id: "aria-hidden-focus", enabled: false },
      ],
    },
  } as const;

  const { Story } = defineMeta({
    title: "Plugins/Notebook/Shell",
    component: PluginWorkspaceDemo,
    tags: ["visual-pending", "test"],
    globals: {
      colorMode: "light",
      theme: "lapis",
    },
    parameters: {
      layout: "fullscreen",
      a11y: workspaceA11y,
      docs: {
        canvas: { className: "workspace-shell-docs-canvas" },
        source: {
          code: PluginWorkspaceExample,
          language: "svelte",
          type: "code",
        },
        story: { height: "700px", inline: false },
      },
    },
  });

  function storyApp(canvasElement: HTMLElement): App {
    const root = canvasElement.querySelector<
      HTMLElement & { __lapisApp?: App }
    >('[data-testid="plugin-workspace-demo"]');
    if (!root?.__lapisApp) {
      throw new Error("The plugin workspace story has no active Lapis app");
    }
    return root.__lapisApp;
  }

  async function pollUntil(
    predicate: () => Promise<boolean> | boolean,
    timeoutMs = 15_000,
  ): Promise<void> {
    const startedAt = Date.now();
    for (;;) {
      if (await predicate()) {
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        throw new Error("pollUntil timed out");
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async function waitForReady(canvasElement: HTMLElement) {
    const canvas = within(canvasElement);
    await waitFor(
      () => {
        expect(canvas.getByTestId("plugin-workspace-status")).toHaveTextContent(
          "ready",
        );
        expect(
          canvas
            .getByTestId("plugin-workspace-demo")
            .querySelector('[data-app-shell-ready="true"]'),
        ).toBeTruthy();
      },
      { timeout: 10_000 },
    );
    return canvas;
  }
</script>

<Story
  name="Workspace"
  args={{ displayMode: "desktop", notebookMode: "source" }}
  play={async ({ canvasElement }) => {
    const canvas = await waitForReady(canvasElement);
    const app = storyApp(canvasElement);

    // The Notebook plugin loads and enables through the public host lifecycle.
    const notebookPlugin = app.plugins.plugins.get(NOTEBOOK_PLUGIN_ID);
    expect(notebookPlugin).toBeInstanceOf(NotebookPlugin);
    await waitFor(() => {
      expect(notebookPlugin?.state).toBe("enabled");
    });

    // The seeded vault keeps the executable notebook document identity.
    expect(
      app.vault.getFileByPath(NOTEBOOK_FIXTURE_PATHS.gettingStarted),
    ).toBeTruthy();
    expect(app.vault.getFileByPath(NOTEBOOK_FIXTURE_PATHS.welcome)).toBeTruthy();

    // The `.notebook.md` file-type association routes the seeded notebook
    // into the plugin-owned NotebookView (registerExtensions +
    // registerEditorView + registerView end-to-end through layout restore).
    await waitFor(() => {
      const activeView = app.workspace.activeLeaf?.view;
      expect(activeView).toBeInstanceOf(NotebookView);
      expect(activeView?.getViewType()).toBe("notebook");
    });

    // Stage 2 authoring commands are registered under the plugin id prefix.
    for (const commandId of [
      "enable-notebook-for-active-note",
      "create-demo-notebooks",
      "insert-notebook-code-cell",
      "insert-notebook-input-cell",
      "insert-notebook-sql-cell",
      "insert-notebook-markdown-cell",
    ]) {
      expect(
        app.commands.commands[`${NOTEBOOK_PLUGIN_ID}:${commandId}`],
        `missing command ${commandId}`,
      ).toBeTruthy();
    }

    // Settings initialized with the documented defaults through loadData.
    expect(notebookPlugin.getSettings().execution.autoRunStaleOnCellChange)
      .toBeTypeOf("boolean");

    // The shell renders the real public workspace chrome.
    expect(
      canvas
        .getByTestId("plugin-workspace-demo")
        .querySelector('[data-ui-component="lapis-workspace-shell"]'),
    ).toBeTruthy();

    const root = canvasElement.ownerDocument.documentElement;
    await waitFor(() => {
      expect(root).toHaveAttribute("data-ui-theme", "lapis");
      expect(root).not.toHaveClass("dark");
    });
  }}
/>

<Story
  name="Run notebook"
  args={{ displayMode: "desktop", notebookMode: "preview" }}
  play={async ({ canvasElement }) => {
    await waitForReady(canvasElement);
    const app = storyApp(canvasElement);

    // Reading mode composes the `:::cell` directives through the bridged
    // global post-processor registry into mounted notebook cells.
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-notebook-cell="calc"]'),
        ).toBeTruthy();
        expect(
          canvasElement.querySelector('[data-notebook-cell="summary"]'),
        ).toBeTruthy();
      },
      { timeout: 15_000 },
    );

    // Running the active notebook executes the TypeScript cell through the
    // lazily loaded compiler and interpolates the markdown cell.
    await app.commands.executeCommand(
      `${NOTEBOOK_PLUGIN_ID}:run-active-notebook`,
    );
    await waitFor(
      () => {
        const calc = canvasElement.querySelector(
          '[data-notebook-cell="calc"]',
        );
        expect(calc?.textContent ?? "").toContain("42");
        const summary = canvasElement.querySelector(
          '[data-notebook-cell="summary"]',
        );
        expect(summary?.textContent ?? "").toContain("The answer is 42");
      },
      { timeout: 45_000 },
    );

    // Generated outputs persist through the host notebook-state contract.
    await waitFor(
      async () => {
        const state = await app.appDatabase.getNotebookState(
          NOTEBOOK_FIXTURE_PATHS.gettingStarted,
        );
        expect(state).toBeTruthy();
        expect(Object.keys(state?.cells ?? {}).length).toBeGreaterThan(0);
      },
      { timeout: 15_000 },
    );
  }}
/>

<Story
  name="Safe mode"
  args={{ displayMode: "desktop", notebookMode: "preview" }}
  play={async ({ canvasElement }) => {
    await waitForReady(canvasElement);
    const app = storyApp(canvasElement);

    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-notebook-cell="calc"]'),
        ).toBeTruthy();
      },
      { timeout: 15_000 },
    );

    // Safe Mode blocks notebook execution through the host contract.
    app.safeMode.disableNotebookExecution = true;
    await app.commands.executeCommand(
      `${NOTEBOOK_PLUGIN_ID}:run-active-notebook`,
    );

    const summary = canvasElement.querySelector(
      '[data-notebook-cell="summary"]',
    );
    expect(summary?.textContent ?? "").not.toContain("The answer is 42");
    expect(
      await app.appDatabase.getNotebookState(
        NOTEBOOK_FIXTURE_PATHS.gettingStarted,
      ),
    ).toBeUndefined();
  }}
/>

<Story
  name="Run inputs"
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.interactiveInputs,
  }}
  play={async ({ canvasElement }) => {
    await waitForReady(canvasElement);
    const app = storyApp(canvasElement);

    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-notebook-cell="controls"]'),
        ).toBeTruthy();
        expect(
          canvasElement.querySelector('[data-notebook-cell="echo"]'),
        ).toBeTruthy();
      },
      { timeout: 15_000 },
    );

    // Running mounts the viewof input through the in-process DOM runtime
    // and interpolates the downstream markdown cell.
    await app.commands.executeCommand(
      `${NOTEBOOK_PLUGIN_ID}:run-active-notebook`,
    );
    await waitFor(
      () => {
        const controls = canvasElement.querySelector(
          '[data-notebook-cell="controls"]',
        );
        expect(
          controls?.querySelector('input[type="range"]'),
        ).toBeTruthy();
        const echo = canvasElement.querySelector(
          '[data-notebook-cell="echo"]',
        );
        expect(echo?.textContent ?? "").toContain("Count is 2.");
      },
      { timeout: 30_000 },
    );

    // Moving the input schedules a targeted rerun of the downstream cell.
    const rangeInput = canvasElement.querySelector<HTMLInputElement>(
      '[data-notebook-cell="controls"] input[type="range"]',
    );
    expect(rangeInput).toBeTruthy();
    await fireEvent.input(rangeInput!, { target: { value: "5" } });
    await waitFor(
      () => {
        const echo = canvasElement.querySelector(
          '[data-notebook-cell="echo"]',
        );
        expect(echo?.textContent ?? "").toContain("Count is 5.");
      },
      { timeout: 30_000 },
    );
  }}
/>

<Story
  name="Query data"
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.dataQueries,
  }}
  play={async ({ canvasElement }) => {
    await waitForReady(canvasElement);
    const app = storyApp(canvasElement);

    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-notebook-cell="basic"]'),
        ).toBeTruthy();
        expect(
          canvasElement.querySelector('[data-notebook-cell="notes"]'),
        ).toBeTruthy();
      },
      { timeout: 15_000 },
    );

    // SQL cells run on DuckDB-WASM resolved through the plugin asset
    // paths, in-process per the eligibility policy.
    await app.commands.executeCommand(
      `${NOTEBOOK_PLUGIN_ID}:run-active-notebook`,
    );
    await waitFor(
      () => {
        const basic = canvasElement.querySelector(
          '[data-notebook-cell="basic"]',
        );
        expect(basic?.textContent ?? "").toContain("42");
        expect(basic?.textContent ?? "").toContain("lapis");
      },
      { timeout: 45_000 },
    );

    // App-derived tables register from vault snapshots as read-only
    // lapis.* tables.
    await waitFor(
      () => {
        const notes = canvasElement.querySelector(
          '[data-notebook-cell="notes"]',
        );
        const text = notes?.textContent ?? "";
        expect(text).toMatch(/note_count/);
        expect(text).toMatch(/[1-9][0-9]*/);
      },
      { timeout: 30_000 },
    );
  }}
/>

<Story
  name="Cancel execution"
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.slow,
  }}
  play={async ({ canvasElement }) => {
    await waitForReady(canvasElement);
    const app = storyApp(canvasElement);

    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-notebook-cell="slow"]'),
        ).toBeTruthy();
      },
      { timeout: 15_000 },
    );

    const { getNotebookRenderService } = await import(
      "../lib/render/notebook-render-service"
    );
    const service = getNotebookRenderService();
    expect(service).toBeTruthy();

    // Start a long-running cell through the render service (the same path
    // the cell stop action uses), then cancel: the checkpoint rolls back and
    // the worker runtime terminates without completing the cell.
    const runPromise = service!.runCell(NOTEBOOK_FIXTURE_PATHS.slow, "slow");
    await pollUntil(async () => {
      const rendered = await service!.getRenderedCell(
        NOTEBOOK_FIXTURE_PATHS.slow,
        "slow",
      );
      return rendered?.state === "running" || rendered?.state === "scheduled";
    });
    const cancelled = await service!.cancelExecution(
      NOTEBOOK_FIXTURE_PATHS.slow,
    );
    expect(cancelled).toBe(true);
    await runPromise.catch(() => undefined);

    await pollUntil(async () => {
      const rendered = await service!.getRenderedCell(
        NOTEBOOK_FIXTURE_PATHS.slow,
        "slow",
      );
      return rendered?.state !== "running" && rendered?.state !== "scheduled";
    });
    const rendered = await service!.getRenderedCell(
      NOTEBOOK_FIXTURE_PATHS.slow,
      "slow",
    );
    expect(rendered?.state).not.toBe("completed");
    const slow = canvasElement.querySelector('[data-notebook-cell="slow"]');
    // The cancelled run leaves the output row hidden; the source preview
    // legitimately still shows the display("done") code text.
    const outputRow = slow?.querySelector(".notebook-cell__row--output");
    expect(
      outputRow?.classList.contains("notebook-cell__row--hidden"),
    ).toBe(true);
  }}
/>

<Story
  name="Autorun stale cells"
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.autorun,
  }}
  play={async ({ canvasElement }) => {
    await waitForReady(canvasElement);
    const app = storyApp(canvasElement);

    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-notebook-cell="show"]'),
        ).toBeTruthy();
      },
      { timeout: 15_000 },
    );

    await app.commands.executeCommand(
      `${NOTEBOOK_PLUGIN_ID}:run-active-notebook`,
    );
    await waitFor(
      () => {
        const show = canvasElement.querySelector(
          '[data-notebook-cell="show"]',
        );
        expect(show?.textContent ?? "").toContain("n is 7.");
      },
      { timeout: 45_000 },
    );

    // Editing the upstream cell source marks descendants stale; the note's
    // autorun frontmatter reruns them debounced without another command.
    const file = app.vault.getFileByPath(NOTEBOOK_FIXTURE_PATHS.autorun);
    expect(file).toBeTruthy();
    await app.vault.process(file!, (source) =>
      source.replace("const n = 7;", "const n = 9;"),
    );
    const { getNotebookRenderService } = await import(
      "../lib/render/notebook-render-service"
    );
    const service = getNotebookRenderService();

    // The view re-poll after the file change reloads the document, marks the
    // edited cell and its descendants stale, and the settings-gated autorun
    // reruns them debounced.
    await pollUntil(async () => {
      const rendered = await service!.getRenderedCell(
        NOTEBOOK_FIXTURE_PATHS.autorun,
        "value",
      );
      return rendered?.state === "stale";
    });

    await waitFor(
      () => {
        const show = canvasElement.querySelector(
          '[data-notebook-cell="show"]',
        );
        expect(show?.textContent ?? "").toContain("n is 9.");
      },
      { timeout: 45_000 },
    );
  }}
/>

<Story
  name="System guide"
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.systemGuide,
  }}
  play={async ({ canvasElement }) => {
    await waitForReady(canvasElement);
    const app = storyApp(canvasElement);

    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-notebook-cell="summary"]'),
        ).toBeTruthy();
      },
      { timeout: 15_000 },
    );

    // The legacy Observable-stance acceptance notebook: async cells, vault
    // FileAttachments, relative ESM imports, viewof inputs, md/html
    // interpolation, stdlib helpers, and lapis.table.
    await app.commands.executeCommand(
      `${NOTEBOOK_PLUGIN_ID}:run-active-notebook`,
    );

    await waitFor(
      () => {
        const summary = canvasElement.querySelector(
          '[data-notebook-cell="summary"]',
        );
        const text = summary?.textContent ?? "";
        expect(text).toContain("Hello from Lapis Notebook Kit");
        expect(text).toContain("Lapis Notebook Kit (beta)");
      },
      { timeout: 60_000 },
    );

    // DOM-backed outputs (viewof inputs, html claims, tables) mount
    // asynchronously after the run resolves, so each is polled.
    await waitFor(
      () => {
        const controls = canvasElement.querySelector(
          '[data-notebook-cell="controls"]',
        );
        expect(controls?.querySelector('input[type="text"]')).toBeTruthy();
      },
      { timeout: 20_000 },
    );

    await waitFor(
      () => {
        const tableControls = canvasElement.querySelector(
          '[data-notebook-cell="table-controls"]',
        );
        expect(tableControls?.textContent ?? "").toContain("Ada");
      },
      { timeout: 20_000 },
    );

    await waitFor(
      () => {
        const htmlSource = canvasElement.querySelector(
          "[data-system-guide-html-source]",
        );
        expect(htmlSource).toBeTruthy();
        const escaped = htmlSource?.querySelector("[data-escaped]");
        expect(escaped?.textContent).toBe("<not escaped by markdown>");
        expect(
          canvasElement.querySelector("[data-system-guide-card]"),
        ).toBeTruthy();
      },
      { timeout: 20_000 },
    );

    await waitFor(
      () => {
        const tableCell = canvasElement.querySelector(
          '[data-notebook-cell="table"]',
        );
        expect(tableCell?.textContent ?? "").toContain("Katherine");
      },
      { timeout: 20_000 },
    );
  }}
/>

<Story
  name="Gallery"
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.gallery,
  }}
  play={async ({ canvasElement }) => {
    await waitForReady(canvasElement);
    const app = storyApp(canvasElement);

    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-notebook-cell="csv-query"]'),
        ).toBeTruthy();
      },
      { timeout: 15_000 },
    );

    // The legacy gallery: markdown outputs, app-table SQL, vault CSV
    // registration into DuckDB, interpolated SQL, range inputs, and md
    // interpolation.
    await app.commands.executeCommand(
      `${NOTEBOOK_PLUGIN_ID}:run-active-notebook`,
    );

    await waitFor(
      () => {
        const setup = canvasElement.querySelector(
          '[data-notebook-cell="setup"]',
        );
        expect(setup?.textContent ?? "").toContain(
          "Running E2E Vault samples for North.",
        );
      },
      { timeout: 60_000 },
    );

    await waitFor(
      () => {
        const appNotes = canvasElement.querySelector(
          '[data-notebook-cell="app-notes"]',
        );
        expect(appNotes?.textContent ?? "").toContain("Getting Started");
      },
      { timeout: 30_000 },
    );

    // Registered vault CSV queried through read_csv_auto with an
    // interpolated region filter (South rows excluded).
    await waitFor(
      () => {
        const csvQuery = canvasElement.querySelector(
          '[data-notebook-cell="csv-query"]',
        );
        const csvText = csvQuery?.textContent ?? "";
        expect(csvText).toContain("2026-03");
        expect(csvText).toContain("150");
        expect(csvText).not.toContain("86");
      },
      { timeout: 30_000 },
    );

    await waitFor(
      () => {
        const input = canvasElement.querySelector(
          '[data-notebook-cell="input"]',
        );
        expect(input?.querySelector('input[type="range"]')).toBeTruthy();
      },
      { timeout: 20_000 },
    );

    await waitFor(
      () => {
        const markdownOutput = canvasElement.querySelector(
          '[data-notebook-cell="markdown-output"]',
        );
        const mdText = markdownOutput?.textContent ?? "";
        expect(mdText).toContain("Selected region: North");
        expect(mdText).toContain("Input value placeholder: 4");
      },
      { timeout: 20_000 },
    );
  }}
/>

<Story
  name="Input types"
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.inputTypes,
  }}
  play={async ({ canvasElement }) => {
    await waitForReady(canvasElement);
    const app = storyApp(canvasElement);

    await waitFor(
      () => {
        expect(
          canvasElement.querySelector('[data-notebook-cell="table-input"]'),
        ).toBeTruthy();
      },
      { timeout: 15_000 },
    );

    // Every UI-backed input factory mounts through the lazy Design Core
    // input runtime after the run resolves.
    await app.commands.executeCommand(
      `${NOTEBOOK_PLUGIN_ID}:run-active-notebook`,
    );

    const expectInput = async (
      cellId: string,
      selector: string,
    ): Promise<void> => {
      await waitFor(
        () => {
          const cell = canvasElement.querySelector(
            `[data-notebook-cell="${cellId}"]`,
          );
          expect(cell?.querySelector(selector)).toBeTruthy();
        },
        { timeout: 30_000 },
      );
    };

    await expectInput("text-input", 'input[type="text"]');
    await expectInput("textarea-input", "textarea");
    await expectInput("number-input", 'input[type="number"]');
    await expectInput("range-input", 'input[type="range"]');
    await expectInput("toggle-input", '[role="switch"]');
    await expectInput("email-input", 'input[type="email"]');
    await expectInput("tel-input", 'input[type="tel"]');
    await expectInput("url-input", 'input[type="url"]');
    await expectInput("password-input", 'input[type="password"]');
    await expectInput("date-input", 'input[type="date"]');
    await expectInput("datetime-input", 'input[type="datetime-local"]');
    await expectInput("color-input", 'input[type="color"]');
    await expectInput("table-input", 'input[type="radio"]');

    await waitFor(
      () => {
        const rows = canvasElement.querySelector(
          '[data-notebook-cell="table-input"]',
        );
        expect(rows?.textContent ?? "").toContain("Grace");
        const echo = canvasElement.querySelector(
          '[data-notebook-cell="echo"]',
        );
        expect(echo?.textContent ?? "").toContain("Text: ada");
        expect(echo?.textContent ?? "").toContain("Range: 4");
      },
      { timeout: 30_000 },
    );
  }}
/>
