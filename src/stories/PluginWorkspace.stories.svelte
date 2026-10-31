<script lang="ts" module>
  import { pathFromDiagnosticResource, type App } from "@lapis-notes/api";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, waitFor, within } from "storybook/test";

  import PluginWorkspaceDemo from "./PluginWorkspaceDemo.svelte";
  import {
    NotebookPlugin,
    NotebookView,
    NotebookViewType,
    NOTEBOOK_PLUGIN_ID,
  } from "../lib";
  import { fireEvent, userEvent } from "storybook/test";
  import { NOTEBOOK_FIXTURE_PATHS } from "./notebook-fixtures";
  import { PluginWorkspaceExample } from "./PluginWorkspace.example-sources";

  const workspaceA11y = {
    test: "error",
    // Mira's numbered code-block highlight palette fails color-contrast
    // upstream (flagged to the Mira owner and recorded); exclude that
    // upstream chrome while everything else in the shell stays scanned.
    context: { exclude: [".mira-code-block"] },
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

  async function readSavedNotebookState(app: App, sourcePath: string) {
    const [{ getNotebookRenderService }, { loadNotebookPersistedState }] =
      await Promise.all([
        import("../lib/render/notebook-render-service"),
        import("../lib/runtime/notebook-output-store"),
      ]);
    const file = app.vault.getFileByPath(sourcePath);
    if (!file) return undefined;
    const document = await getNotebookRenderService()!.loadNotebookDocument(
      file,
      sourcePath,
    );
    return loadNotebookPersistedState(
      app,
      sourcePath,
      document.frontmatter?.id,
    );
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

  async function checkNotebookEmbed(canvasElement: HTMLElement) {
    const canvas = await waitForReady(canvasElement);
    const app = storyApp(canvasElement);
    await app.commands.executeCommand(`${NOTEBOOK_PLUGIN_ID}:run-active-notebook`);
    const sourceFile = app.vault.getFileByPath(NOTEBOOK_FIXTURE_PATHS.gettingStarted)!;
    const savedSource = await app.vault.read(sourceFile);
    const notices = app.notifications.list().length;
    app.safeMode.disableNotebookExecution = true;
    app.contextKeys.set("safeMode.notebookExecutionDisabled", true);
    await app.vault.createFolder("Reports");
    const report = await app.vault.create("Reports/Notebook report.md", [
      "# Notebook report",
      "Saved notebook results, rendered in this note.",
      "![[../Getting Started.notebook.md]]",
      "## Second reference",
      "![[Getting Started.notebook.md]]",
    ].join("\n\n"));
    const openReport = () => app.workspace.getUnpinnedLeaf().setViewState({
      type: "markdown", state: { file: report.path, mode: "preview" },
    });
    await openReport();
    await waitFor(() => {
      const embeds = canvasElement.querySelectorAll<HTMLElement>("[data-notebook-embed]");
      expect(embeds).toHaveLength(2);
      for (const embed of embeds) {
        expect(embed).toHaveTextContent("The answer is 42.");
        expect(embed.querySelector("[data-notebook-source]")).toBeNull();
        expect(within(embed).queryByRole("button", { name: "Run notebook cell" })).toBeNull();
        expect(within(embed).queryByRole("heading", { name: "Getting Started" })).toBeVisible();
      }
    }, { timeout: 15_000 });
    expect(await app.vault.read(sourceFile)).toBe(savedSource);
    expect(canvasElement.querySelector('[data-testid="notebook-execution-status"]')).toBeNull();
    const linked = await app.vault.create("linked.md", "# Correct relative target");
    await app.vault.create("Reports/linked.md", "# Wrong relative target");
    const updated = savedSource + "\n**Updated conclusion.**\n\n[[linked]]\n";
    await app.vault.modify(sourceFile, updated);
    await waitFor(() => {
      for (const embed of canvasElement.querySelectorAll<HTMLElement>("[data-notebook-embed]")) {
        expect(embed).toHaveTextContent("Updated conclusion.");
      }
    });
    const relativeLink = within(canvasElement.querySelector<HTMLElement>("[data-notebook-embed]")!).getByRole("button", { name: "linked" });
    relativeLink.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(app.workspace.getActiveFile()?.path).toBe(linked.path));
    await openReport();
    await waitFor(() => expect(canvasElement.querySelectorAll("[data-notebook-embed]")).toHaveLength(2));
    const open = canvas.getAllByRole("button", { name: "Open notebook Getting Started.notebook.md" })[0];
    open.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(app.workspace.getActiveFile()?.path).toBe(sourceFile.path));
    await waitFor(() => expect(canvasElement.querySelector("[data-notebook-embed]")).toBeNull());
    await openReport();
    await waitFor(() => expect(canvasElement.querySelectorAll("[data-notebook-embed]")).toHaveLength(2));
    await waitFor(() => expect(canvasElement.querySelector("[data-notebook-embed]")).toHaveTextContent("The answer is 42."));
    expect(app.notifications.list()).toHaveLength(notices);
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

  async function checkCompleteInputControls(
    canvasElement: HTMLElement,
    app: App,
  ) {
    const { getNotebookRenderService } = await import(
      "../lib/render/notebook-render-service"
    );
    const cell = (id: string) =>
      within(
        canvasElement.querySelector<HTMLElement>(
          `[data-notebook-cell="${id}"]`,
        )!,
      );
    const notifications = app.notifications.list().length;
    await waitFor(
      async () => {
        const last = await getNotebookRenderService()!.getRenderedCell(
          NOTEBOOK_FIXTURE_PATHS.inputTypes,
          "file-results",
        );
        expect(last?.state).toBe("completed");
      },
      { timeout: 30_000 },
    );
    for (const wrapper of canvasElement.querySelectorAll<HTMLElement>(
      ".notebook-output__dom, .notebook-output__text, .notebook-output__markdown, .notebook-output__code",
    )) {
      const style = getComputedStyle(wrapper);
      expect(style.borderTopWidth).toBe("0px");
      expect(style.paddingTop).toBe("0px");
      expect(style.paddingRight).toBe("0px");
      expect(style.paddingBottom).toBe("0px");
      expect(style.paddingLeft).toBe("0px");
    }
    expect(
      canvasElement.querySelectorAll(
        '[data-notebook-cell="checkbox-input"] .notebook-output__dom-label',
      ),
    ).toHaveLength(0);
    expect(
      canvasElement.querySelector(
        '[data-notebook-cell="button-input"] .notebook-output__dom-label',
      ),
    ).toBeNull();
    for (const wrapper of canvasElement.querySelectorAll<HTMLElement>(
      '[data-notebook-output="input"]',
    )) {
      expect(getComputedStyle(wrapper).backgroundColor).toBe(
        "rgba(0, 0, 0, 0)",
      );
    }
    const valueOutput = canvasElement.querySelector(
      '[data-notebook-cell="text-input-value"] .notebook-output__text',
    )!;
    expect(getComputedStyle(valueOutput).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    expect(
      parseFloat(
        getComputedStyle(
          canvasElement.querySelector(".lapis-notebook-input__table")!,
        ).borderTopWidth,
      ),
    ).toBeGreaterThan(0);
    const textLabel = canvasElement
      .querySelector(
        '[data-notebook-cell="text-input"] .notebook-output__dom-label',
      )!
      .getBoundingClientRect();
    const textInput = canvasElement
      .querySelector('[data-notebook-cell="text-input"] input')!
      .getBoundingClientRect();
    expect(textLabel.right).toBeLessThanOrEqual(textInput.left);
    expect(textLabel.bottom).toBeGreaterThan(textInput.top);
    const markdown = cell("markdown-input");
    const composer = await markdown.findByRole("textbox", {
      name: "Markdown notes",
    });
    expect(markdown.queryByRole("button", { name: /send/i })).toBeNull();
    const markdownHost = composer.closest(".lapis-notebook-input")!;
    let markdownChanges = 0;
    const countMarkdownChange = () => markdownChanges++;
    markdownHost.addEventListener("input", countMarkdownChange);
    await userEvent.click(composer);
    await userEvent.keyboard("{End}!");
    await pollUntil(async () => {
      const rendered = await getNotebookRenderService()!.getRenderedCell(
        NOTEBOOK_FIXTURE_PATHS.inputTypes,
        "markdown-preview",
      );
      return (
        rendered?.state === "completed" &&
        rendered.outputs.some(
          (output) =>
            output.kind === "markdown" &&
            output.markdown === "**Notebook notes**!",
        )
      );
    });
    await waitFor(() =>
      expect(
        canvasElement.querySelector(
          '[data-notebook-cell="markdown-preview"] .notebook-output__markdown-body',
        ),
      ).toHaveTextContent("Notebook notes!"),
    );
    expect(markdownChanges).toBe(1);
    markdownHost.removeEventListener("input", countMarkdownChange);
    expect(markdown.getByRole("textbox", { name: "Markdown notes" })).toBe(
      composer,
    );
    expect(composer).toHaveFocus();
    await userEvent.click(
      markdown.getByRole("button", { name: "Formatting options" }),
    );
    await expect(
      markdown.getByRole("button", { name: "Bold", exact: true }),
    ).toBeVisible();
    await userEvent.click(
      markdown.getByRole("button", { name: "Formatting options" }),
    );
    await waitFor(() =>
      expect(
        markdown.queryByRole("button", { name: "Bold", exact: true }),
      ).toBeNull(),
    );
    await expect(
      markdown.getByRole("button", { name: "Formatting options" }),
    ).toHaveFocus();
    const counter = cell("button-input").getByRole("button", {
      name: "Click me",
    });
    const counterHost = counter.closest(".lapis-notebook-input")!;
    let counterChanges = 0;
    const countCounterChange = () => counterChanges++;
    counterHost.addEventListener("input", countCounterChange);
    expect(
      parseFloat(getComputedStyle(counter).borderTopWidth),
    ).toBeGreaterThan(0);
    await userEvent.click(counter);
    expect(counterChanges).toBe(1);
    counterHost.removeEventListener("input", countCounterChange);
    await pollUntil(async () => {
      const rendered = await getNotebookRenderService()!.getRenderedCell(
        NOTEBOOK_FIXTURE_PATHS.inputTypes,
        "button-input-value",
      );
      return (
        rendered?.state === "completed" &&
        rendered.outputs.some(
          (output) => output.kind === "code" && output.code === "1",
        )
      );
    });
    await waitFor(() =>
      expect(
        canvasElement.querySelector(
          '[data-notebook-cell="button-input-value"] .notebook-output__code',
        ),
      ).toHaveTextContent("1"),
    );
    expect(cell("button-input").getByRole("button", { name: "Click me" })).toBe(
      counter,
    );
    const sweet = cell("checkbox-input").getByRole("checkbox", {
      name: "Sweet",
    });
    expect(sweet).toHaveAttribute("aria-checked", "true");
    expect(sweet.querySelector("svg")).toBeTruthy();
    expect(getComputedStyle(sweet).color).toBe("rgb(255, 255, 255)");
    const selectedRow = canvasElement.querySelector(
      '[data-notebook-cell="table-input"] tbody tr',
    )!;
    await userEvent.click(
      within(selectedRow as HTMLElement).getByRole("radio"),
    );
    expect(selectedRow).toHaveAttribute("data-selected", "true");
    expect(getComputedStyle(selectedRow).backgroundColor).not.toBe(
      getComputedStyle(selectedRow.querySelector("td")!).borderBottomColor,
    );
    await userEvent.click(sweet);
    await expect(sweet).toHaveAttribute("aria-checked", "false");
    await waitFor(() =>
      expect(
        canvasElement.querySelector(
          '[data-notebook-cell="checkbox-input-value"] .notebook-output__code',
        ),
      ).toHaveTextContent("[]"),
    );
    const single = cell("select-input").getByRole("combobox", {
      name: "Number choice",
    });
    await userEvent.click(single);
    await userEvent.keyboard("{Home}{Enter}");
    await waitFor(() => {
      expect(single).toHaveTextContent("One");
      expect(single).toHaveAttribute("aria-expanded", "false");
      expect(getComputedStyle(single).pointerEvents).not.toBe("none");
    });
    await userEvent.click(single);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(single).toHaveFocus();
      expect(getComputedStyle(single).pointerEvents).not.toBe("none");
    });
    expect(
      canvasElement.querySelector(
        '[data-notebook-cell="search-input"] [data-slot="input-group-addon"] svg',
      ),
    ).toBeTruthy();
    await waitFor(
      () => {
        const block = canvasElement.querySelector(
          '[data-notebook-cell="code-output-example"] [data-ui-component="code-block"]',
        );
        expect(block).toHaveAttribute("data-language", "json");
        expect(block?.querySelector('[class*="ui-code-token-"]')).toBeTruthy();
      },
      { timeout: 15_000 },
    );
    const search = cell("search-input").getByRole("searchbox", {
      name: "Search penguins",
    });
    const valuesExample = cell("javascript-values-example");
    await waitFor(() => {
      expect(valuesExample.getAllByText(/\[Circular\]/).length).toBeGreaterThan(
        0,
      );
      const blocks = canvasElement.querySelectorAll(
        '[data-notebook-cell="javascript-values-example"] [data-ui-component="code-block"]',
      );
      expect(blocks).toHaveLength(2);
      for (const block of blocks) {
        expect(block).toHaveAttribute("data-language", "javascript");
        expect(block.querySelector('[class*="ui-code-token-"]')).toBeTruthy();
      }
    });
    await userEvent.clear(search);
    await userEvent.type(search, "gentoo biscoe");
    await expect(search).toHaveFocus();
    await waitFor(() =>
      expect(cell("search-input").getByText("124 results")).toBeTruthy(),
    );
    const profile = cell("form-input").getByRole("textbox", {
      name: "Profile name",
    });
    await userEvent.type(profile, " Lovelace");
    await expect(profile).toHaveValue("Ada Lovelace");
    await pollUntil(async () => {
      const rendered = await getNotebookRenderService()!.getRenderedCell(
        NOTEBOOK_FIXTURE_PATHS.inputTypes,
        "form-input-value",
      );
      return (
        rendered?.state === "completed" &&
        rendered.outputs.some(
          (output) =>
            output.kind === "code" && output.code.includes("Ada Lovelace"),
        )
      );
    });
    await waitFor(() =>
      expect(
        canvasElement.querySelector(
          '[data-notebook-cell="form-input-value"] .notebook-output__code',
        ),
      ).toHaveTextContent("Ada Lovelace"),
    );
    const files = cell("file-input");
    const choose = files.getByRole("button", { name: "Choose from vault" });
    await userEvent.click(choose);
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(
        body.getByRole("dialog", { name: "Choose from vault" }),
      ).toBeVisible(),
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(choose).toHaveFocus();
      expect(getComputedStyle(choose).pointerEvents).not.toBe("none");
    });
    await expect(files.getByText("No file selected.")).toBeTruthy();
    const fileHost = canvasElement.querySelector<HTMLElement>(
      '[data-notebook-cell="file-input"] .lapis-notebook-input--file',
    )!;
    let fileChanges = 0;
    const countFileChange = () => fileChanges++;
    fileHost.addEventListener("input", countFileChange);
    await userEvent.upload(
      files.getByLabelText("Data files browser upload"),
      new File(['[{"name":"Uploaded"}]'], "sample.json", {
        type: "application/json",
      }),
    );
    await waitFor(() => expect(files.getByText("sample.json")).toBeTruthy());
    fileHost.removeEventListener("input", countFileChange);
    expect(fileChanges).toBe(1);
    await userEvent.click(choose);
    await waitFor(() =>
      expect(
        body.getByRole("option", { name: /assets\/system-guide-table.csv/ }),
      ).toBeTruthy(),
    );
    const chooser = body.getByRole("dialog", { name: "Choose from vault" });
    expect(
      body
        .getByRole("option", { name: /assets\/system-guide-table.csv/ })
        .querySelector('[data-ui-component="file-type-icon"]'),
    ).toBeTruthy();
    await userEvent.click(
      body.getByRole("option", { name: /assets\/system-guide-table.csv/ }),
    );
    await userEvent.click(
      body.getByRole("button", { name: "Add file", exact: true }),
    );
    await waitFor(() => expect(chooser).not.toBeInTheDocument());
    await waitFor(() =>
      expect(files.getByText("system-guide-table.csv")).toBeTruthy(),
    );
    expect(files.getAllByRole("listitem")).toHaveLength(2);
    expect(
      canvasElement.querySelectorAll(
        '[data-notebook-cell="file-input"] [data-ui-component="file-type-icon"]',
      ),
    ).toHaveLength(2);
    const uploadChip = canvasElement.querySelector<HTMLElement>(
      '[data-file-source="upload"]',
    )!;
    const vaultChip = canvasElement.querySelector<HTMLElement>(
      '[data-file-source="vault"]',
    )!;
    expect(getComputedStyle(uploadChip).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    expect(getComputedStyle(vaultChip).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    expect(getComputedStyle(uploadChip).backgroundColor).not.toBe(
      getComputedStyle(vaultChip).backgroundColor,
    );

    await waitFor(
      () => expect(cell("file-results").getByText(/Uploaded/)).toBeTruthy(),
      { timeout: 30_000 },
    );
    for (const host of canvasElement.querySelectorAll<HTMLElement>(
      ".lapis-notebook-input",
    )) {
      const bounds = host.getBoundingClientRect();
      // Tables intentionally scroll when their data is wider than the cell.
      // The viewport stays contained; its offscreen column controls may extend.
      if (host.classList.contains("lapis-notebook-input--table")) {
        const viewport = host.querySelector<HTMLElement>(
          ".lapis-notebook-input__table",
        )!;
        expect(getComputedStyle(viewport).overflowX).toBe("auto");
        expect(viewport.getBoundingClientRect().right).toBeLessThanOrEqual(
          bounds.right + 1,
        );
        continue;
      }
      for (const control of host.querySelectorAll<HTMLElement>(
        'button, input:not([type="file"]), [role="combobox"]',
      )) {
        const rect = control.getBoundingClientRect();
        expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
        expect(rect.left).toBeGreaterThanOrEqual(bounds.left - 1);
      }
    }
    expect(
      app.workspace.diagnostics
        .snapshot()
        .entries.filter((entry) => entry.diagnostic.source === "Notebook"),
    ).toHaveLength(0);
    expect(app.notifications.list()).toHaveLength(notifications);
  }

  async function checkTableFilters(canvasElement: HTMLElement) {
    await waitForReady(canvasElement);
    const app = storyApp(canvasElement);
    await app.commands.executeCommand(
      `${NOTEBOOK_PLUGIN_ID}:run-active-notebook`,
    );
    await waitFor(
      () =>
        expect(canvasElement.querySelector(".notebook-dataframe")).toBeTruthy(),
      { timeout: 60_000 },
    );
    const viewer = canvasElement.querySelector<HTMLElement>(
      ".notebook-dataframe",
    )!;
    const table = within(viewer);
    await userEvent.click(
      table.getByRole("button", { name: "Filters", exact: true }),
    );
    await waitFor(() => {
      const panel = viewer.querySelector<HTMLElement>(
        ".notebook-dataframe__filters",
      )!;
      const rows = Array.from(
        panel.querySelectorAll(".notebook-dataframe__filter"),
      );
      expect(rows).toHaveLength(4);
      const bounds = rows.map((row) => row.getBoundingClientRect());
      for (const [index, row] of bounds.entries()) {
        expect(row.width).toBeGreaterThan(panel.clientWidth - 40);
        if (index)
          expect(row.top).toBeGreaterThanOrEqual(bounds[index - 1]!.bottom - 1);
      }
      const panelRight = panel.getBoundingClientRect().right;
      for (const control of panel.querySelectorAll(
        'input, [role="combobox"]',
      )) {
        const box = control.getBoundingClientRect();
        expect(box.width).toBeGreaterThan(0);
        expect(box.right).toBeLessThanOrEqual(panelRight);
      }
    });
    expect(
      viewer.querySelectorAll(".notebook-dataframe__filters select"),
    ).toHaveLength(0);
    const operator = table.getByRole("combobox", {
      name: "name filter operator",
    });
    const page = within(canvasElement.ownerDocument.body);
    const waitForSelectOpen = async (trigger: HTMLElement) => {
      await waitFor(() => {
        const listbox = page.getByRole("listbox");
        expect(listbox).toBeVisible();
        expect(
          canvasElement.ownerDocument.activeElement === trigger ||
            listbox.contains(canvasElement.ownerDocument.activeElement),
        ).toBe(true);
      });
    };
    const waitForSelectClosed = async (trigger: HTMLElement) => {
      await waitFor(() => {
        expect(trigger).toHaveAttribute("aria-expanded", "false");
        expect(page.queryByRole("listbox")).toBeNull();
        expect(getComputedStyle(viewer).pointerEvents).not.toBe("none");
        expect(trigger).toHaveFocus();
      });
    };
    const openSelectWithKeyboard = async (trigger: HTMLElement) => {
      trigger.focus();
      await waitFor(() => expect(trigger).toHaveFocus());
      await userEvent.keyboard("{Enter}");
      await waitForSelectOpen(trigger);
    };
    const clearFilters = async () => {
      await userEvent.click(
        table.getByRole("button", { name: "Clear filters", exact: true }),
      );
      await waitFor(() => {
        expect(
          table.getByRole("spinbutton", { name: "score minimum" }),
        ).toHaveValue(null);
        expect(
          table.getByRole("spinbutton", { name: "score maximum" }),
        ).toHaveValue(null);
        expect(
          table.getByRole("textbox", { name: "name filter value" }),
        ).toHaveValue("");
        expect(table.queryByText(/^[1-9]\d* active$/)).toBeNull();
        expect(
          table.getByRole("button", { name: "Clear filters", exact: true }),
        ).toBeDisabled();
        const rows = viewer.querySelector(
          ".notebook-dataframe__rows",
        )?.textContent;
        for (const name of ["Ada", "Grace", "Katherine"])
          expect(rows).toContain(name);
      });
    };
    await openSelectWithKeyboard(operator);
    await userEvent.keyboard("{Home}{ArrowDown}{Enter}");
    await waitFor(() => expect(operator).toHaveTextContent("Starts with"));
    await waitForSelectClosed(operator);
    const nameValue = table.getByRole("textbox", { name: "name filter value" });
    await userEvent.type(nameValue, "Ad");
    await waitFor(() => {
      expect(
        viewer.querySelector(".notebook-dataframe__rows")?.textContent,
      ).toContain("Ada");
      expect(
        viewer.querySelector(".notebook-dataframe__rows")?.textContent,
      ).not.toContain("Grace");
    });
    await openSelectWithKeyboard(operator);
    await userEvent.keyboard("{Escape}");
    await waitForSelectClosed(operator);
    await waitFor(() => expect(operator).toHaveFocus());
    await clearFilters();
    await waitFor(() =>
      expect(
        viewer.querySelector(".notebook-dataframe__rows")?.textContent,
      ).toContain("Grace"),
    );
    await openSelectWithKeyboard(operator);
    await userEvent.keyboard("{End}{Enter}");
    await waitFor(() => expect(operator).toHaveTextContent("Is not null"));
    await waitForSelectClosed(operator);
    await expect(nameValue).toBeDisabled();
    await expect(table.getByText("1 active", { exact: true })).toBeVisible();
    await userEvent.click(
      table.getByRole("button", { name: "Clear name filter", exact: true }),
    );
    await expect(nameValue).toBeEnabled();
    await userEvent.type(
      table.getByRole("spinbutton", { name: "score minimum" }),
      "8",
    );
    await waitFor(() => {
      expect(
        viewer.querySelector(".notebook-dataframe__rows")?.textContent,
      ).toContain("Katherine");
      expect(
        viewer.querySelector(".notebook-dataframe__rows")?.textContent,
      ).not.toContain("Ada");
    });
    await clearFilters();
    await userEvent.type(
      table.getByRole("spinbutton", { name: "score maximum" }),
      "8",
    );
    expect(
      table.getByRole("spinbutton", { name: "score maximum" }),
    ).toHaveValue(8);
    await waitFor(() => {
      expect(
        viewer.querySelector(".notebook-dataframe__rows")?.textContent,
      ).toContain("Ada");
      expect(
        viewer.querySelector(".notebook-dataframe__rows")?.textContent,
      ).not.toContain("Grace");
    });
    await clearFilters();
    const booleanValue = table.getByRole("combobox", {
      name: "enabled filter value",
    });
    await openSelectWithKeyboard(booleanValue);
    await userEvent.keyboard("{End}{Enter}");
    await waitFor(() => expect(booleanValue).toHaveTextContent("False"));
    await waitForSelectClosed(booleanValue);
    await waitFor(() => {
      expect(
        viewer.querySelector(".notebook-dataframe__rows")?.textContent,
      ).toContain("Grace");
      expect(
        viewer.querySelector(".notebook-dataframe__rows")?.textContent,
      ).not.toContain("Katherine");
    });
    await clearFilters();
    const date = table.getByLabelText("created minimum");
    fireEvent.input(date, { target: { value: "2026-03-01" } });
    await waitFor(() => {
      expect(
        viewer.querySelector(".notebook-dataframe__rows")?.textContent,
      ).toContain("Katherine");
      expect(
        viewer.querySelector(".notebook-dataframe__rows")?.textContent,
      ).not.toContain("Ada");
    });
    await clearFilters();
  }

  async function checkCellEditorLayout(canvasElement: HTMLElement) {
    await waitForReady(canvasElement);
    await waitFor(
      () =>
        expect(
          canvasElement.querySelector(
            '[data-notebook-cell="step-1"] .mira-code-block',
          ),
        ).toBeTruthy(),
      { timeout: 20_000 },
    );
    const cell = canvasElement.querySelector('[data-notebook-cell="step-1"]')!;
    const source = cell.querySelector(".notebook-cell__source")!;
    const preview = source.querySelector(".mira-code-block")!;
    expect(getComputedStyle(preview).borderBottomLeftRadius).toBe("0px");
    expect(getComputedStyle(preview).borderBottomRightRadius).toBe("0px");
    const previewHeight = preview.getBoundingClientRect().height;
    const previewPadding = {
      top: getComputedStyle(preview).paddingTop,
      left: getComputedStyle(preview).paddingLeft,
      right: getComputedStyle(preview).paddingRight,
      bottom: getComputedStyle(preview).paddingBottom,
    };
    await fireEvent.click(preview);
    await waitFor(() =>
      expect(
        source.querySelector(".notebook-cell__editor .cm-content"),
      ).toBeTruthy(),
    );
    await waitFor(() => {
      const editor = source.querySelector(".notebook-cell__editor")!;
      expect(
        Math.abs(editor.getBoundingClientRect().height - previewHeight),
      ).toBeLessThanOrEqual(2);
      const cm = editor.querySelector(".cm-editor")!;
      const scrollerStyle = getComputedStyle(
        editor.querySelector(".cm-scroller")!,
      );
      expect(scrollerStyle.paddingTop).toBe(previewPadding.top);
      expect(scrollerStyle.paddingLeft).toBe(previewPadding.left);
      expect(scrollerStyle.paddingRight).toBe(previewPadding.right);
      expect(scrollerStyle.paddingBottom).toBe(previewPadding.bottom);
      expect(parseFloat(getComputedStyle(cm).paddingBlockEnd) || 0).toBe(0);
      expect(
        getComputedStyle(editor.querySelector(".cm-gutters")!).backgroundColor,
      ).toBe(getComputedStyle(cm).backgroundColor);
      const surface = source.closest(".notebook-cell__surface")!;
      expect(getComputedStyle(surface).outlineStyle).toBe("none");
      const frame = getComputedStyle(surface, "::after");
      expect(frame.borderTopWidth).toBe("2px");
      expect(frame.borderRightWidth).toBe("2px");
      expect(parseFloat(frame.borderTopLeftRadius)).toBe(
        parseFloat(getComputedStyle(surface).borderTopLeftRadius) -
          parseFloat(getComputedStyle(surface).borderLeftWidth),
      );
      expect(Number(frame.zIndex)).toBeGreaterThan(
        Number(getComputedStyle(source).zIndex),
      );
    });
  }
</script>

<Story
  name="Preview cell editing layout"
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.progress,
  }}
  play={async ({ canvasElement }) => checkCellEditorLayout(canvasElement)}
/>
<Story
  name="Live cell editing layout"
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.progress,
  }}
  play={async ({ canvasElement }) => {
    await waitForReady(canvasElement);
    const view = storyApp(canvasElement).workspace.activeLeaf!
      .view as NotebookView;
    await view.setState({ ...view.getState(), mode: "live-preview" });
    await checkCellEditorLayout(canvasElement);
    await waitFor(() => {
      const cell = canvasElement.querySelector("section.notebook-cell")!;
      const host = cell.closest(".cm-editor.cm-live-preview")!;
      const gutter = host.querySelector(
        ":scope > .cm-scroller > .cm-gutters .cm-lineNumbers",
      )!;
      const action = cell.querySelector(".notebook-cell__action")!;
      const a = action.getBoundingClientRect();
      const g = gutter.getBoundingClientRect();
      expect(
        Math.abs((a.left + a.right - g.left - g.right) / 2),
      ).toBeLessThanOrEqual(2);
    });
    const liveCell = canvasElement.querySelector("section.notebook-cell")!;
    const action = liveCell.querySelector<HTMLElement>(
      ".notebook-cell__action",
    )!;
    action.scrollIntoView({ block: "center" });
    const assertRailHit = () => {
      for (const control of [
        action,
        ...liveCell.querySelectorAll<HTMLElement>(
          ".notebook-cell__rail-toggle",
        ),
      ]) {
        const rect = control.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        const target = canvasElement.ownerDocument.elementFromPoint(
          (rect.left + rect.right) / 2,
          rect.top + Math.min(rect.height / 2, 12),
        );
        expect(control === target || control.contains(target)).toBe(true);
      }
    };
    await waitFor(assertRailHit);
    await userEvent.click(action);
    await waitFor(() =>
      expect(action).toHaveAccessibleName("Stop notebook execution"),
    );
    await waitFor(assertRailHit);
    await waitFor(
      () =>
        expect(
          liveCell.querySelector(".notebook-output__text"),
        ).toHaveTextContent("Step 1 complete"),
      { timeout: 15_000 },
    );
    await waitFor(assertRailHit);
  }}
/>

<Story
  name="Source cell highlighting"
  args={{
    displayMode: "desktop",
    notebookMode: "source",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.progress,
  }}
  play={async ({ canvasElement }) => {
    await waitForReady(canvasElement);
    await waitFor(() => {
      const editor = canvasElement.querySelector(
        ".cm-editor.markdown-source-view",
      )!;
      expect(
        [...editor.querySelectorAll(".cm-keyword")].some(
          (node) => node.textContent === "await",
        ),
      ).toBe(true);
      expect(
        [...editor.querySelectorAll(".cm-number")].some(
          (node) => node.textContent === "1000",
        ),
      ).toBe(true);
    });
  }}
/>

<Story
  name="Editable cell identifiers"
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.progress,
  }}
  play={async ({ canvasElement }) => {
    const canvas = await waitForReady(canvasElement);
    const app = storyApp(canvasElement);
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Rename cell step-1" }),
      ).toBeTruthy(),
    );
    const badge = canvas.getByRole("button", { name: "Rename cell step-1" });
    badge.focus();
    const badgeCell = badge.closest("[data-notebook-cell]")!;
    const code = badgeCell.querySelector(".mira-code-block")!;
    await waitFor(() => {
      expect(getComputedStyle(badge).backgroundColor).toBe(
        getComputedStyle(code).backgroundColor,
      );
      expect(getComputedStyle(badge).outlineWidth).toBe("2px");
      expect(getComputedStyle(badge).outlineColor).toBe(
        getComputedStyle(
          badgeCell.querySelector(".notebook-cell__surface--code")!,
          "::after",
        ).borderTopColor,
      );
    });
    await userEvent.keyboard("{Enter}");
    const input = canvas.getByRole("textbox", { name: "Cell ID" });
    await userEvent.clear(input);
    await userEvent.type(input, "step-2{Enter}");
    await expect(canvas.getByRole("alert")).toHaveTextContent("already exists");
    await userEvent.keyboard("{Escape}");
    await expect(
      canvas.getByRole("button", { name: "Rename cell step-1" }),
    ).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.clear(canvas.getByRole("textbox", { name: "Cell ID" }));
    await userEvent.type(
      canvas.getByRole("textbox", { name: "Cell ID" }),
      "first-step{Enter}",
    );
    await pollUntil(async () =>
      (
        await app.vault.read(
          app.vault.getFileByPath(NOTEBOOK_FIXTURE_PATHS.progress)!,
        )
      ).includes("#first-step"),
    );
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Rename cell first-step" }),
      ).toBeTruthy(),
    );
    const cell = canvasElement.querySelector(
      'section[data-notebook-cell="first-step"]',
    )!;
    await userEvent.click(
      within(cell as HTMLElement).getByRole("button", {
        name: "Run notebook cell",
      }),
    );
    await waitFor(
      () =>
        expect(cell.querySelector(".notebook-output__text")).toHaveTextContent(
          "Step 1 complete",
        ),
      {
        timeout: 15_000,
      },
    );
    await userEvent.click(
      cell.querySelector<HTMLElement>(".notebook-cell__rail-toggle--code")!,
    );
    await waitFor(() =>
      expect(cell.querySelector(".notebook-cell__collapsed")).toBeTruthy(),
    );
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Rename cell first-step" }),
      ).toBeEnabled(),
    );
    const collapsed = cell.querySelector(".notebook-cell__collapsed")!;
    expect(getComputedStyle(collapsed, "::after").borderTopWidth).toBe("2px");
    expect(
      getComputedStyle(
        canvas.getByRole("button", { name: "Rename cell first-step" }),
      ).backgroundColor,
    ).toBe(
      getComputedStyle(collapsed.querySelector(".mira-code-block")!)
        .backgroundColor,
    );
    const corner = cell.querySelector(".notebook-cell__collapsed-id")!;
    expect(getComputedStyle(corner).position).toBe("absolute");
    const badgeBounds = corner.getBoundingClientRect();
    const codeBounds = collapsed.getBoundingClientRect();
    expect(
      Math.abs(badgeBounds.bottom - codeBounds.bottom),
    ).toBeLessThanOrEqual(1);
    expect(Math.abs(badgeBounds.right - codeBounds.right)).toBeLessThanOrEqual(
      1,
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Rename cell first-step" }),
    );
    await expect(canvas.getByRole("textbox", { name: "Cell ID" })).toHaveValue(
      "first-step",
    );
    await userEvent.keyboard("{Escape}");
    await expect(cell.querySelector(".notebook-cell__collapsed")).toBeTruthy();
  }}
/>

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
    expect(
      app.vault.getFileByPath(NOTEBOOK_FIXTURE_PATHS.welcome),
    ).toBeTruthy();

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
    expect(
      notebookPlugin.getSettings().execution.autoRunStaleOnCellChange,
    ).toBeTypeOf("boolean");

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

    // Generic file-open routing: the exclusive editor-view contribution must
    // outrank markdown's `*.md` claim so notebook files open as NotebookView
    // (header actions included) through the normal open path, not only via
    // explicit layout state.
    expect(
      app.workspace.determineViewTypeForPath(
        NOTEBOOK_FIXTURE_PATHS.interactiveInputs,
      ),
    ).toBe(NotebookViewType);
    const routedFile = app.vault.getFileByPath(
      NOTEBOOK_FIXTURE_PATHS.interactiveInputs,
    );
    expect(routedFile).toBeTruthy();
    await app.workspace.getUnpinnedLeaf().openFile(routedFile!);
    await waitFor(() => {
      expect(app.workspace.activeLeaf?.view).toBeInstanceOf(NotebookView);
    });
    await waitFor(() => {
      expect(
        canvasElement.querySelector('[aria-label="Run notebook now"]'),
      ).toBeTruthy();
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
        const calc = canvasElement.querySelector('[data-notebook-cell="calc"]');
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
        const state = await readSavedNotebookState(
          app,
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
    app.contextKeys.set("safeMode.notebookExecutionDisabled", true);
    const status = within(canvasElement).getByTestId(
      "notebook-execution-status",
    );
    await waitFor(() =>
      expect(
        within(status).getByRole("button", {
          name: "Run notebook",
          exact: true,
        }),
      ).toBeDisabled(),
    );
    await fireEvent.click(
      within(status).getByRole("button", { name: /Notebook run details/ }),
    );
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(
        page.getByRole("dialog", { name: "Notebook run details" }),
      ).toHaveTextContent("Notebook execution is disabled in Safe Mode."),
    );
    await userEvent.keyboard("{Escape}");
    await app.commands.executeCommand(
      `${NOTEBOOK_PLUGIN_ID}:run-active-notebook`,
    );

    const summary = canvasElement.querySelector(
      '[data-notebook-cell="summary"]',
    );
    expect(summary?.textContent ?? "").not.toContain("The answer is 42");
    expect(
      await readSavedNotebookState(app, NOTEBOOK_FIXTURE_PATHS.gettingStarted),
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
        expect(controls?.querySelector('input[type="range"]')).toBeTruthy();
        const echo = canvasElement.querySelector('[data-notebook-cell="echo"]');
        expect(echo?.textContent ?? "").toContain("Count is 2.");
      },
      { timeout: 30_000 },
    );

    // Moving the input schedules a targeted rerun of the downstream cell.
    const rangeInput = canvasElement.querySelector<HTMLInputElement>(
      '[data-notebook-cell="controls"] input[type="range"]',
    );
    expect(rangeInput).toBeTruthy();
    const rangeControl = canvasElement.querySelector(
      '[data-notebook-cell="controls"] [role="slider"]',
    );
    expect(rangeControl).toBeTruthy();
    await fireEvent.input(rangeInput!, { target: { value: "5" } });
    await waitFor(
      () => {
        const echo = canvasElement.querySelector('[data-notebook-cell="echo"]');
        expect(echo?.textContent ?? "").toContain("Count is 5.");
      },
      { timeout: 30_000 },
    );
    expect(
      canvasElement.querySelector(
        '[data-notebook-cell="controls"] [role="slider"]',
      ),
    ).toBe(rangeControl);
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

    const { getNotebookRenderService } =
      await import("../lib/render/notebook-render-service");
    const service = getNotebookRenderService();
    expect(service).toBeTruthy();

    const status = await within(canvasElement).findByTestId(
      "notebook-execution-status",
    );
    const notifications = app.notifications.list().length;
    await fireEvent.click(
      within(status).getByRole("button", { name: "Run notebook", exact: true }),
    );
    await waitFor(() =>
      expect(status).toHaveAttribute("data-outcome", "running"),
    );
    await pollUntil(async () => {
      const rendered = await service!.getRenderedCell(
        NOTEBOOK_FIXTURE_PATHS.slow,
        "slow",
      );
      return rendered?.state === "running";
    });
    await fireEvent.click(
      within(status).getByRole("button", { name: "Stop notebook execution" }),
    );
    await waitFor(
      () => expect(status).toHaveAttribute("data-outcome", "cancelled"),
      { timeout: 2_000 },
    );
    expect(app.notifications.list()).toHaveLength(notifications);
    expect(
      app.workspace.diagnostics
        .snapshot()
        .entries.filter((entry) => entry.diagnostic.source === "Notebook"),
    ).toHaveLength(0);

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
    expect(outputRow?.classList.contains("notebook-cell__row--hidden")).toBe(
      true,
    );
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
        const show = canvasElement.querySelector('[data-notebook-cell="show"]');
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
    const { getNotebookRenderService } =
      await import("../lib/render/notebook-render-service");
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
        const show = canvasElement.querySelector('[data-notebook-cell="show"]');
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
    const catalogTable = canvasElement.querySelector<HTMLElement>(
      '[data-notebook-cell="sample-catalog"] .lapis-notebook-input__table-grid',
    )!;
    const catalogContainer = catalogTable.parentElement!;
    expect(catalogTable.getBoundingClientRect().width).toBeGreaterThanOrEqual(
      catalogContainer.clientWidth - 2,
    );
    const wideTable = canvasElement.querySelector<HTMLElement>(
      '[data-notebook-cell="sample-preview"] .lapis-notebook-input__table',
    )!;
    expect(getComputedStyle(wideTable).overflowX).toBe("auto");
    for (const heading of ["JavaScript", "Markdown", "HTML"]) {
      expect(
        within(canvasElement).getByRole("heading", { name: heading, level: 2 }),
      ).toBeTruthy();
    }
    await waitFor(
      () => {
        const scatter = canvasElement.querySelector(
          'svg[aria-label="Penguin measurements by species"]',
        );
        expect(scatter?.querySelectorAll("circle").length).toBeGreaterThan(300);
        const stocks = canvasElement.querySelector(
          'svg[aria-label="Apple closing stock prices"]',
        );
        expect(
          stocks?.querySelector('[aria-label="line"] path')?.getAttribute("d")
            ?.length,
        ).toBeGreaterThan(1000);
        const network = canvasElement.querySelector(
          'svg[aria-label="Les Misérables character network"]',
        );
        expect(network?.querySelectorAll("circle")).toHaveLength(77);
        expect(network?.querySelectorAll("line")).toHaveLength(254);
        const preview = canvasElement.querySelector(
          '[data-notebook-cell="sample-preview"] .notebook-cell__output',
        );
        expect(preview?.textContent).toContain("Adelie");
        expect(preview?.textContent).toContain("culmen_length_mm");
        const catalog = canvasElement.querySelector(
          '[data-notebook-cell="sample-catalog"] .notebook-cell__output',
        );
        for (const name of [
          "aapl",
          "alphabet",
          "cars",
          "citywages",
          "diamonds",
          "flare",
          "industries",
          "miserables",
          "olympians",
          "penguins",
          "pizza",
          "weather",
        ])
          expect(catalog?.textContent).toContain(name);
      },
      { timeout: 20_000 },
    );
  }}
/>

<Story
  name="Table filters"
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.tableFilters,
  }}
  play={async ({ canvasElement }) => checkTableFilters(canvasElement)}
/>

<Story
  name="Table filters mobile"
  args={{
    displayMode: "mobile",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.tableFilters,
  }}
  play={async ({ canvasElement }) => checkTableFilters(canvasElement)}
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
  name="Reactive output publication"
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.reactiveOutput,
  }}
  play={async ({ canvasElement }) => {
    const canvas = await waitForReady(canvasElement);
    const status = canvas.getByTestId("notebook-execution-status");
    await fireEvent.click(
      within(status).getByRole("button", { name: "Run notebook", exact: true }),
    );
    await waitFor(
      () => {
        expect(
          canvasElement.querySelector(
            '[data-notebook-cell="publication-value"] .notebook-output__code',
          ),
        ).toHaveTextContent("42");
        expect(
          canvasElement.querySelector(
            '[data-notebook-cell="publication-slow"] .notebook-cell__action--stop',
          ),
        ).toBeTruthy();
        expect(
          canvasElement.querySelector(
            '[data-notebook-cell="publication-slow"] .notebook-output__text',
          ),
        ).toHaveTextContent("Later cell started");
        expect(status).toHaveAttribute("data-outcome", "running");
      },
      { timeout: 10000 },
    );
    const valueOutput = canvasElement.querySelector<HTMLElement>(
      '[data-notebook-cell="publication-value"] .notebook-output__code',
    )!;
    const outputCell = valueOutput.closest(".notebook-cell__output")!;
    expect(parseFloat(getComputedStyle(outputCell).paddingTop)).toBeGreaterThan(
      6,
    );
    expect(
      parseFloat(getComputedStyle(outputCell).paddingBottom),
    ).toBeGreaterThan(6);
    expect(getComputedStyle(valueOutput).paddingLeft).toBe("0px");
    expect(getComputedStyle(valueOutput).boxShadow).not.toBe("none");
    const markdownOutput = canvasElement.querySelector(
      ".notebook-output__markdown",
    )!;
    await waitFor(() =>
      expect(markdownOutput).toHaveTextContent("Markdown output"),
    );
    expect(
      getComputedStyle(markdownOutput.querySelector(".lapis-markdown-embed")!)
        .backgroundColor,
    ).toBe(getComputedStyle(markdownOutput).backgroundColor);
    await waitFor(
      () => expect(status).toHaveAttribute("data-outcome", "succeeded"),
      { timeout: 10000 },
    );
  }}
/>

<Story
  name="Notebook embed"
  parameters={{ docs: { description: { story: "A Markdown report embeds saved Notebook results using relative links, without executing cells or showing source-editing chrome. Both references update when the notebook changes." } } }}
  args={{ notebookMode: "preview" }}
  play={async ({ canvasElement }) => checkNotebookEmbed(canvasElement)}
/>

<Story
  name="Notebook embed mobile"
  parameters={{ docs: { description: { story: "The rendered Notebook report at mobile width, including keyboard navigation to the source notebook and remounting saved outputs in Safe Mode." } } }}
  args={{ notebookMode: "preview", displayMode: "mobile" }}
  play={async ({ canvasElement }) => checkNotebookEmbed(canvasElement)}
/>

<Story
  name="Notebook embed lifecycle"
  parameters={{ docs: { description: { story: "Unrun cells remain manual, deleted content is removed and recovers on recreation, and a self-reference terminates without executing cells." } } }}
  args={{ notebookMode: "preview" }}
  play={async ({ canvasElement }) => {
    await waitForReady(canvasElement);
    const app = storyApp(canvasElement);
    const original = app.vault.getFileByPath(NOTEBOOK_FIXTURE_PATHS.gettingStarted)!;
    const source = await app.vault.read(original);
    const notices = app.notifications.list().length;
    const recursive = await app.vault.create("Recursive.notebook.md", "# Recursive notebook\n\n![[Recursive.notebook.md]]");
    const report = await app.vault.create("Notebook lifecycle.md", `# Embedded notebooks\n\n![[${original.path}]]\n\n![[${recursive.path}]]`);
    await app.workspace.getUnpinnedLeaf().setViewState({ type: "markdown", state: { file: report.path, mode: "preview" } });
    await waitFor(() => expect(canvasElement).toHaveTextContent("This notebook is already embedded above."));
    expect(canvasElement.querySelectorAll("[data-notebook-embed]")).toHaveLength(3);
    await waitFor(() => expect(canvasElement).toHaveTextContent("Open the notebook and run it to display this cell’s output."));
    expect(await app.vault.read(original)).toBe(source);
    expect(await readSavedNotebookState(app, original.path)).toBeUndefined();
    await app.vault.delete(original);
    // The host removes a custom embed when its target no longer resolves.
    await waitFor(() => expect(canvasElement.querySelector('[data-notebook-embed="Getting Started.notebook.md"]')).toBeNull());
    await app.vault.create(original.path, source);
    await waitFor(() => expect(canvasElement.querySelector('[data-notebook-embed="Getting Started.notebook.md"]')).toHaveTextContent("Getting Started"));
    expect(await readSavedNotebookState(app, original.path)).toBeUndefined();
    expect(app.notifications.list()).toHaveLength(notices);
  }}
/>

<Story
  name="Notebook embed inputs"
  parameters={{ docs: { description: { story: "Two embeds retain separate mounted controls for one notebook. A keyboard input change updates both copies and their reactive outputs, and survives reopening the notebook." } } }}
  args={{ notebookMode: "preview", notebookPath: NOTEBOOK_FIXTURE_PATHS.interactiveInputs }}
  play={async ({ canvasElement }) => {
    const canvas = await waitForReady(canvasElement);
    const app = storyApp(canvasElement);
    await app.commands.executeCommand(`${NOTEBOOK_PLUGIN_ID}:run-active-notebook`);
    const report = await app.vault.create("Input report.md", "# Interactive notebook results\n\n![[Interactive Inputs.notebook.md]]\n\n![[Interactive Inputs.notebook.md]]");
    await app.workspace.getUnpinnedLeaf().setViewState({ type: "markdown", state: { file: report.path, mode: "preview" } });
    await waitFor(() => expect(canvas.getAllByRole("slider", { name: "Count" })).toHaveLength(2));
    const controls = canvas.getAllByRole("slider", { name: "Count" });
    controls[0].focus();
    await userEvent.keyboard("{End}");
    await waitFor(() => {
      for (const control of controls) expect(control).toHaveAttribute("aria-valuenow", "10");
      for (const embed of canvasElement.querySelectorAll<HTMLElement>("[data-notebook-embed]")) expect(embed).toHaveTextContent("Count is 10.");
    });
    await pollUntil(async () => (await readSavedNotebookState(app, NOTEBOOK_FIXTURE_PATHS.interactiveInputs))?.cells.controls.inputValues?.count === 10);
    expect(canvas.getAllByRole("slider", { name: "Count" })[0]).toBe(controls[0]);
    expect(canvas.getAllByRole("slider", { name: "Count" })[1]).toBe(controls[1]);
  }}
/>

<Story
  name="Saved inputs after rename"
  tags={["visual-pending"]}
  parameters={{
    docs: {
      description: {
        story:
          "Run once, change Count, then reopen the renamed notebook in Safe Mode. Its UUID, saved input and output survive without executing cells. Storybook uses an in-memory database that resets on reload.",
      },
    },
  }}
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.interactiveInputs,
  }}
  play={async ({ canvasElement }) => {
    const canvas = await waitForReady(canvasElement);
    const app = storyApp(canvasElement);
    const notices = app.notifications.list().length;
    const originalPath = NOTEBOOK_FIXTURE_PATHS.interactiveInputs;
    const renamedPath = "Renamed Inputs.notebook.md";
    const file = app.vault.getFileByPath(originalPath)!;
    await app.commands.executeCommand(`${NOTEBOOK_PLUGIN_ID}:run-active-notebook`);
    const slider = await canvas.findByRole("slider", { name: "Count" });
    slider.focus();
    await userEvent.keyboard("{End}");
    await pollUntil(async () => {
      const saved = await readSavedNotebookState(app, originalPath);
      return saved?.cells.controls?.inputValues?.count === 10 &&
        saved.cells.echo?.state === "completed" &&
        saved.cells.echo.outputs?.some((output) => output.kind === "markdown" && output.markdown === "Count is 10.");
    });
    const { getNotebookRenderService } = await import("../lib/render/notebook-render-service");
    const service = getNotebookRenderService()!;
    const id = (await service.loadNotebookDocument(file, originalPath)).frontmatter?.id;
    expect(id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
    await app.workspace.getUnpinnedLeaf().openFile(app.vault.getFileByPath(NOTEBOOK_FIXTURE_PATHS.welcome)!);
    await app.fileManager.renameFile(file, renamedPath);
    app.safeMode.disableNotebookExecution = true;
    app.contextKeys.set("safeMode.notebookExecutionDisabled", true);
    await app.workspace.getUnpinnedLeaf().setViewState({ type: NotebookViewType, state: { file: renamedPath, mode: "preview" } });
    const restored = await canvas.findByRole("slider", { name: "Count" });
    expect(restored).not.toBe(slider);
    await waitFor(() => expect(restored).toHaveAttribute("aria-valuenow", "10"));
    await waitFor(() => expect(canvasElement.querySelector('[data-notebook-cell="echo"]')).toHaveTextContent("Count is 10."));
    const renamedFile = app.vault.getFileByPath(renamedPath)!;
    expect((await service.loadNotebookDocument(renamedFile, renamedPath)).frontmatter?.id).toBe(id);
    expect(await app.appDatabase.getMeta(`plugin:lapis-notebook:state:v1:${id}`)).toMatchObject({ cells: { controls: { inputValues: { count: 10 } } } });
    expect(canvas.getByTestId("notebook-execution-status").querySelector('button[aria-label="Run notebook"]')).toBeDisabled();
    expect(app.notifications.list()).toHaveLength(notices);
  }}
/>

<Story
  name="Input lifecycle"
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.inputLifecycle,
  }}
  play={async ({ canvasElement }) => {
    await waitForReady(canvasElement);
    const app = storyApp(canvasElement);
    const notices = app.notifications.list().length;
    const cell = (id: string) =>
      within(
        canvasElement.querySelector<HTMLElement>(
          `[data-notebook-cell="${id}"]`,
        )!,
      );
    await app.commands.executeCommand(
      `${NOTEBOOK_PLUGIN_ID}:run-active-notebook`,
    );
    await waitFor(
      () =>
        expect(
          within(canvasElement).getByTestId("notebook-execution-status"),
        ).toHaveAttribute("data-outcome", "succeeded"),
      { timeout: 30_000 },
    );
    const markdown = await cell("markdown-input").findByRole("textbox", {
      name: "Markdown notes",
    });
    await userEvent.click(markdown);
    await userEvent.keyboard("{End}!");
    await userEvent.click(
      cell("button-input").getByRole("button", { name: "Click me" }),
    );
    const search = cell("search-input").getByRole("searchbox", {
      name: "Search penguins",
    });
    await userEvent.clear(search);
    await userEvent.type(search, "gentoo biscoe");
    await userEvent.type(
      cell("form-input").getByRole("textbox", { name: "Profile name" }),
      " Lovelace",
    );
    const files = cell("file-input");
    await userEvent.upload(
      files.getByLabelText("Data files browser upload"),
      new File(['[{"name":"Uploaded"}]'], "sample.json", {
        type: "application/json",
      }),
    );
    await userEvent.click(
      files.getByRole("button", { name: "Choose from vault" }),
    );
    const body = within(canvasElement.ownerDocument.body);
    const chooser = await body.findByRole("dialog", {
      name: "Choose from vault",
    });
    await userEvent.click(
      await body.findByRole("option", {
        name: /assets\/system-guide-table.csv/,
      }),
    );
    await userEvent.click(
      body.getByRole("button", { name: "Add file", exact: true }),
    );
    await waitFor(() => expect(chooser).not.toBeInTheDocument());
    await waitFor(() => expect(files.getAllByRole("listitem")).toHaveLength(2));
    await app.commands.executeCommand(
      `${NOTEBOOK_PLUGIN_ID}:run-active-notebook`,
    );
    const expectRetained = async () => {
      await waitFor(() =>
        expect(cell("file-input").getAllByRole("listitem")).toHaveLength(2),
      );
      expect(
        cell("markdown-input").getByRole("textbox", { name: "Markdown notes" }),
      ).toHaveTextContent("**Notebook notes**!");
      expect(
        cell("search-input").getByRole("searchbox", {
          name: "Search penguins",
        }),
      ).toHaveValue("gentoo biscoe");
      expect(
        cell("form-input").getByRole("textbox", { name: "Profile name" }),
      ).toHaveValue("Ada Lovelace");
      await waitFor(() =>
        expect(
          canvasElement.querySelector(
            '[data-notebook-cell="button-input-value"] .notebook-output__code',
          ),
        ).toHaveTextContent("1"),
      );
      await waitFor(() =>
        expect(cell("file-results").getByText(/Uploaded/)).toBeTruthy(),
      );
    };
    await expectRetained();
    await app.workspace
      .getUnpinnedLeaf()
      .openFile(app.vault.getFileByPath(NOTEBOOK_FIXTURE_PATHS.welcome)!);
    await waitFor(() =>
      expect(
        within(canvasElement).queryByTestId("notebook-execution-status"),
      ).toBeNull(),
    );
    await app.workspace.getUnpinnedLeaf().setViewState({
      type: NotebookViewType,
      state: { file: NOTEBOOK_FIXTURE_PATHS.inputLifecycle, mode: "preview" },
    });
    await expectRetained();
    expect(
      app.workspace.diagnostics
        .snapshot()
        .entries.filter((entry) => entry.diagnostic.source === "Notebook"),
    ).toHaveLength(0);
    expect(app.notifications.list()).toHaveLength(notices);
  }}
/>

<Story
  name="Input row layout"
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.inputRows,
  }}
  play={async ({ canvasElement }) => {
    await waitForReady(canvasElement);
    await storyApp(canvasElement).commands.executeCommand(
      `${NOTEBOOK_PLUGIN_ID}:run-active-notebook`,
    );
    for (const [id, labelSelector, controlSelector] of [
      ["row-text", ".notebook-output__dom-label", 'input[type="text"]'],
      [
        "row-select",
        ".notebook-input-control__field > label",
        '[role="combobox"]',
      ],
      ["row-checkbox", "legend", '[role="checkbox"]'],
      [
        "row-file",
        ".notebook-input-control__file > label",
        ".notebook-input-control__file-actions",
      ],
    ]) {
      const cell = canvasElement.querySelector(`[data-notebook-cell="${id}"]`)!;
      await waitFor(() =>
        expect(cell.querySelector(controlSelector)).toBeTruthy(),
      );
      const label = cell.querySelector(labelSelector)!;
      const control = cell.querySelector(controlSelector)!;
      await waitFor(() => {
        const l = label.getBoundingClientRect(),
          c = control.getBoundingClientRect();
        expect(l.right).toBeLessThanOrEqual(c.left);
        expect(l.top).toBeLessThan(c.bottom);
        expect(l.bottom).toBeGreaterThan(c.top);
      });
    }
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
    await expectInput(
      "markdown-input",
      '[data-ui-component="markdown-composer"]',
    );
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
    await expectInput("button-input", "button");
    await expectInput("checkbox-input", '[role="checkbox"]');
    await expectInput("radio-input", '[role="radiogroup"]');
    await expectInput("select-input", '[role="combobox"]');
    await expectInput("multiple-input", '[role="combobox"]');
    await expectInput("file-input", 'input[type="file"]');
    await expectInput("search-input", 'input[type="search"]');
    await expectInput("form-input", 'input[type="text"]');
    await checkCompleteInputControls(canvasElement, app);

    await waitFor(
      () => {
        const rows = canvasElement.querySelector(
          '[data-notebook-cell="table-input"]',
        );
        expect(rows?.textContent ?? "").toContain("Grace");
        expect(
          canvasElement.querySelector(
            '[data-notebook-cell="text-input-value"] .notebook-output__text',
          ),
        ).toHaveTextContent("ada");
        expect(
          canvasElement.querySelector(
            '[data-notebook-cell="range-input-value"] .notebook-output__code',
          ),
        ).toHaveTextContent("4");
      },
      { timeout: 30_000 },
    );
  }}
/>

<Story
  name="Input types mobile"
  args={{
    displayMode: "mobile",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.inputTypes,
  }}
  play={async ({ canvasElement }) => {
    await waitForReady(canvasElement);
    const app = storyApp(canvasElement);
    await app.commands.executeCommand(
      `${NOTEBOOK_PLUGIN_ID}:run-active-notebook`,
    );
    await waitFor(
      () =>
        expect(
          canvasElement.querySelector(
            '[data-notebook-cell="file-input"] input[type="file"]',
          ),
        ).toBeTruthy(),
      { timeout: 30_000 },
    );
    await checkCompleteInputControls(canvasElement, app);
  }}
/>

<Story
  name="Panel group"
  args={{
    displayMode: "desktop",
    notebookMode: "source",
    panelGroupLayout: true,
  }}
  play={async ({ canvasElement }) => {
    await waitForReady(canvasElement);

    // Default presentation: opening a notebook surfaces Variables,
    // Dependencies, and Packages together in one right-sidebar group.
    await waitFor(
      () => {
        // The group name renders as aria-label/data attribute, not text.
        const group = canvasElement.querySelector(
          '[data-ui-component="workspace-sidebar-group"][data-sidebar-group-id="notebook-panel-group"]',
        );
        expect(group).toBeTruthy();
        for (const testId of [
          "notebook-inspector-panel",
          "notebook-dependencies-panel",
          "notebook-packages-panel",
        ]) {
          expect(
            group?.querySelector(`[data-testid="${testId}"]`),
            `panel ${testId} mounted inside the Notebook group`,
          ).toBeTruthy();
        }
      },
      // Cold module graphs for the panel views (inspector pulls the DuckDB
      // service chain) can take a while under the vitest browser transform.
      { timeout: 60_000 },
    );
  }}
/>

<Story
  name="Run progress"
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.progress,
  }}
  play={async ({ canvasElement }) => {
    const canvas = await waitForReady(canvasElement);
    const app = storyApp(canvasElement);
    await waitFor(() =>
      expect(canvas.getByTestId("notebook-execution-status")).toBeVisible(),
    );
    const notifications = app.notifications.list().length;
    const status = canvas.getByTestId("notebook-execution-status");
    const statusBar = status.closest(
      '[data-ui-component="workspace-status-bar"]',
    )!;
    const groupBounds = status.getBoundingClientRect();
    const barBounds = statusBar.getBoundingClientRect();
    expect(groupBounds.top).toBeGreaterThan(barBounds.top);
    expect(groupBounds.bottom).toBeLessThan(barBounds.bottom);
    await fireEvent.click(
      within(status).getByRole("button", { name: "Run notebook", exact: true }),
    );
    await waitFor(() =>
      expect(status).toHaveAttribute("data-outcome", "running"),
    );
    const stop = within(status).getByRole("button", {
      name: "Stop notebook execution",
    });
    expect(getComputedStyle(stop).color).not.toBe(
      getComputedStyle(status).color,
    );
    await waitFor(() =>
      expect(
        status.querySelector(".notebook-execution-status__outcome svg"),
      ).toBeTruthy(),
    );
    const spinner = status.querySelector(
      ".notebook-execution-status__outcome svg",
    )!;
    expect(getComputedStyle(spinner).animationName).toBe(
      "notebook-execution-spin",
    );
    const initialDuration = status.querySelector(
      ".notebook-execution-status__duration",
    )!.textContent;
    const details = within(status).getByRole("button", {
      name: /Notebook run details/,
    });
    details.focus();
    await userEvent.keyboard("{Enter}");
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(
        page.getByRole("dialog", { name: "Notebook run details" }),
      ).toBeVisible(),
    );
    const dialog = page.getByRole("dialog", { name: "Notebook run details" });
    await waitFor(
      () =>
        expect(dialog.querySelector('[role="progressbar"]')).toHaveAttribute(
          "aria-valuenow",
          "25",
        ),
      { timeout: 20_000 },
    );
    const elapsed = dialog.querySelector(
      ".notebook-execution-status__summary span",
    )!.textContent;
    await waitFor(
      () =>
        expect(dialog.querySelector('[role="progressbar"]')).toHaveAttribute(
          "aria-valuenow",
          "50",
        ),
      { timeout: 5_000 },
    );
    expect(
      dialog.querySelector(".notebook-execution-status__summary span")!
        .textContent,
    ).not.toBe(elapsed);
    expect(
      status.querySelector(".notebook-execution-status__duration")!.textContent,
    ).not.toBe(initialDuration);
    await waitFor(
      () => expect(status).toHaveAttribute("data-outcome", "succeeded"),
      { timeout: 10_000 },
    );
    expect(dialog).toHaveTextContent("4/4 cells");
    expect(dialog).toHaveTextContent("100%");
    expect(dialog).toHaveTextContent("Worker runtime");
    await waitFor(() => expect(dialog).toHaveTextContent("Outputs recomputed"));
    const textOutput = canvasElement.querySelector(
      '[data-notebook-cell="step-1"] [data-notebook-output-root]',
    )!.firstElementChild!;
    expect(getComputedStyle(textOutput).fontFamily).toBe(
      getComputedStyle(canvasElement.querySelector(".markdown-view__document")!)
        .fontFamily,
    );
    expect(status.textContent?.trim()).toMatch(/^(?:[0-9]+m )?[0-9.]+s$/);
    expect(app.notifications.list()).toHaveLength(notifications);
    expect(
      app.notifications.activeProgress.filter(
        (progress) => progress.source === "Notebook",
      ),
    ).toHaveLength(0);
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(details).toHaveFocus());
    await app.workspace
      .getUnpinnedLeaf()
      .openFile(app.vault.getFileByPath(NOTEBOOK_FIXTURE_PATHS.welcome)!);
    await waitFor(() =>
      expect(canvas.queryByTestId("notebook-execution-status")).toBeNull(),
    );
    await app.workspace
      .getUnpinnedLeaf()
      .openFile(app.vault.getFileByPath(NOTEBOOK_FIXTURE_PATHS.progress)!);
    await waitFor(() =>
      expect(canvas.getByTestId("notebook-execution-status")).toHaveAttribute(
        "data-outcome",
        "succeeded",
      ),
    );
  }}
/>

<Story
  name="Run failure details"
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.failure,
  }}
  play={async ({ canvasElement }) => {
    const canvas = await waitForReady(canvasElement);
    const app = storyApp(canvasElement);
    await waitFor(() =>
      expect(canvas.getByTestId("notebook-execution-status")).toBeVisible(),
    );
    const notifications = app.notifications.list().length;
    const status = canvas.getByTestId("notebook-execution-status");
    await fireEvent.click(
      within(status).getByRole("button", { name: "Run notebook", exact: true }),
    );
    await waitFor(
      () => expect(status).toHaveAttribute("data-outcome", "failed"),
      { timeout: 20_000 },
    );
    const entries = app.workspace.diagnostics
      .snapshot()
      .entries.filter((entry) => entry.diagnostic.source === "Notebook");
    expect(entries).toHaveLength(1);
    expect(pathFromDiagnosticResource(entries[0].resource!)).toBe(
      NOTEBOOK_FIXTURE_PATHS.failure,
    );
    expect(entries[0].diagnostic.message).toBe(
      "The sample data could not be loaded",
    );
    await fireEvent.click(
      within(status).getByRole("button", { name: /Notebook run details/ }),
    );
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(
        page.getByRole("dialog", { name: "Notebook run details" }),
      ).toHaveTextContent("The sample data could not be loaded"),
    );
    await fireEvent.click(page.getByRole("button", { name: "Reveal broken" }));
    await waitFor(() =>
      expect(
        page.queryByRole("dialog", { name: "Notebook run details" }),
      ).toBeNull(),
    );
    expect(app.notifications.list()).toHaveLength(notifications);
  }}
/>

<Story
  name="Cancel promise in process"
  args={{
    displayMode: "desktop",
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.inProcessPromise,
  }}
  play={async ({ canvasElement }) => {
    const canvas = await waitForReady(canvasElement);
    const app = storyApp(canvasElement);
    await waitFor(() =>
      expect(canvas.getByTestId("notebook-execution-status")).toBeVisible(),
    );
    const notifications = app.notifications.list().length;
    const status = canvas.getByTestId("notebook-execution-status");
    await fireEvent.click(
      within(status).getByRole("button", { name: "Run notebook", exact: true }),
    );
    await waitFor(() =>
      expect(status).toHaveAttribute("data-outcome", "running"),
    );
    await waitFor(
      () =>
        expect(
          canvasElement.querySelector(
            '[data-notebook-cell="waiting"] [aria-label="Stop notebook execution"]',
          ),
        ).toBeTruthy(),
      { timeout: 20_000 },
    );
    await fireEvent.click(
      within(status).getByRole("button", { name: "Stop notebook execution" }),
    );
    await waitFor(
      () => expect(status).toHaveAttribute("data-outcome", "cancelled"),
      { timeout: 2_000 },
    );
    expect(
      within(status).getByRole("button", { name: "Run notebook", exact: true }),
    ).toBeEnabled();
    await fireEvent.click(
      within(status).getByRole("button", { name: /Notebook run details/ }),
    );
    const page = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(
        page.getByRole("dialog", { name: "Notebook run details" }),
      ).toHaveTextContent("Cancelled"),
    );
    expect(app.notifications.list()).toHaveLength(notifications);
    expect(
      canvasElement.querySelector(
        '[data-notebook-cell="waiting"] .notebook-cell__row--output',
      )?.textContent ?? "",
    ).not.toContain("late output");
    await userEvent.keyboard("{Escape}");
    await fireEvent.click(
      within(status).getByRole("button", { name: "Run notebook", exact: true }),
    );
    await waitFor(() =>
      expect(status).toHaveAttribute("data-outcome", "running"),
    );
    await fireEvent.click(
      within(status).getByRole("button", { name: "Stop notebook execution" }),
    );
    await waitFor(() =>
      expect(status).toHaveAttribute("data-outcome", "cancelled"),
    );
  }}
/>
