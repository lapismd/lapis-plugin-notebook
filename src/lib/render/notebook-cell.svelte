<script lang="ts">
  import { untrack } from "svelte";
  import Check from "@lucide/svelte/icons/check";
  import Clock3 from "@lucide/svelte/icons/clock-3";
  import CircleAlert from "@lucide/svelte/icons/circle-alert";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Play from "@lucide/svelte/icons/play";
  import Square from "@lucide/svelte/icons/square";
  import { Notice, type App } from "@lapis-notes/api";
  import { MarkdownEmbed } from "@lapis-notes/markdown";
  import { Button, buttonVariants } from "@lapismd/design-core/shadcn/button";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import type { NotebookCell } from "../model/notebook-cell";
  import type { NotebookOutput } from "../output";
  import { parseNotebookDocument } from "../parse/parse-notebook-document";
  import type {
    NotebookCellExecutionState,
    NotebookExecutionPhase,
  } from "../runtime/notebook-session";
  import { getNotebookCellCodeActionState } from "./notebook-cell-actions";
  import NotebookCellSourceEditor from "./notebook-cell-source-editor.svelte";
  import {
    replaceNotebookCellAttributes,
    replaceNotebookCellSource,
    updateNotebookCellSourceRange,
  } from "./notebook-cell-source";
  import {
    getSelectedNotebookCellId,
    setSelectedNotebookCellId,
  } from "./notebook-cell-selection.svelte";
  import {
    shouldHandleNotebookSectionKeydown,
    shouldIgnoreNotebookSectionClick,
  } from "./notebook-cell-interaction";
  import OutputRenderer from "./output-renderer.svelte";

  type Props = {
    app: App;
    cell: NotebookCell;
    sourcePath: string;
    outputs: NotebookOutput[];
    executionState: NotebookCellExecutionState;
    error?: string;
    durationMs?: number;
    startedAt?: number;
    statusMessage?: string;
    setupPhases?: NotebookExecutionPhase[];
    canRun?: boolean;
    onRun?: () => void | Promise<void>;
    onStop?: () => void | Promise<void>;
    onClearOutputs?: () => void | Promise<void>;
  };

  let {
    app,
    cell,
    sourcePath,
    outputs,
    executionState,
    error,
    durationMs,
    startedAt,
    statusMessage,
    setupPhases = [],
    canRun = true,
    onRun,
    onStop,
    onClearOutputs,
  }: Props = $props();
  let editingSource = $state(false);
  let savingSource = $state(false);
  let persistingCellAttributes = $state(false);
  let localSource = $state(untrack(() => cell.source));
  let localSourceRange = $state(untrack(() => ({ ...cell.sourceRange })));
  let syncedCellSignature = $state("");
  let sourcePreview = $derived(
    `\`\`\`${cell.lang} linenumbers=1\n${localSource}\n\`\`\``,
  );
  let collapsedCode = $state(untrack(() => Boolean(cell.attributes.folded)));
  let collapsedOutput = $state(
    untrack(() => Boolean(cell.attributes.outputFolded)),
  );
  let runningElapsedMs = $state(0);
  let sectionElement = $state<HTMLElement | null>(null);
  let timer: ReturnType<typeof setInterval> | null = null;
  const firstSourceLine = $derived(
    localSource.split(/\r?\n/).find((line) => line.trim() !== "") ?? "",
  );
  const firstSourcePreview = $derived(
    `\`\`\`${cell.lang}\n${firstSourceLine}\n\`\`\``,
  );

  const hasOutputs = $derived(outputs.length > 0 || executionState === "error");
  const selectedCellId = $derived(getSelectedNotebookCellId(sourcePath));
  const cellSelected = $derived(selectedCellId === cell.id);
  const codeSelected = $derived(cellSelected);
  const outputSelected = $derived(cellSelected && hasOutputs);
  const isStale = $derived(executionState === "stale");
  const statusLabel = $derived.by(() => {
    if (executionState === "scheduled") {
      return "Scheduled";
    }

    if (executionState === "running") {
      return formatDuration(runningElapsedMs);
    }

    if (executionState === "stale") {
      return "Stale";
    }

    if (durationMs !== undefined) {
      return formatDuration(durationMs);
    }

    if (hasOutputs) {
      return "Done";
    }

    return "Not run";
  });
  const menuTriggerClass = `${buttonVariants({ variant: "ghost" })} notebook-cell__menu-trigger`;

  const statusLabelClass = $derived.by(() => {
    if (executionState === "running" || durationMs !== undefined) {
      return "notebook-cell__status-label";
    }

    return undefined;
  });

  const statusTone = $derived.by(() => {
    if (executionState === "error") {
      return "notebook-cell__status--error";
    }
    if (executionState === "scheduled") {
      return "notebook-cell__status--scheduled";
    }
    if (executionState === "stale") {
      return "notebook-cell__status--stale";
    }
    if (executionState === "completed") {
      return "notebook-cell__status--completed";
    }
    return "notebook-cell__status--idle";
  });
  const statusDetail = $derived.by(() => {
    if (executionState === "scheduled") {
      return statusMessage ?? summarizeSetupPhases(setupPhases);
    }

    if (executionState === "running") {
      return statusMessage ?? summarizeSetupPhases(setupPhases);
    }

    return summarizeSetupPhases(setupPhases);
  });
  const isBusy = $derived(
    executionState === "scheduled" || executionState === "running",
  );
  const codeActionState = $derived(
    getNotebookCellCodeActionState({
      executionState,
      savingSource,
      canRun,
      hasRunHandler: Boolean(onRun),
      hasStopHandler: Boolean(onStop),
    }),
  );
  const codeRailColor = $derived(
    codeSelected
      ? "var(--interactive-accent)"
      : "var(--background-modifier-border)",
  );
  const outputRailColor = $derived(
    outputSelected
      ? "var(--interactive-accent)"
      : "var(--background-modifier-border)",
  );
  const isLivePreview = $derived(
    Boolean(sectionElement?.closest(".cm-editor.cm-live-preview")),
  );
  const sectionRowClass = $derived.by(() => {
    let className = "notebook-cell__row-grid";
    if (isLivePreview) {
      className += " notebook-cell__row-grid--full";
      return className;
    }
    className += " notebook-cell__row-grid--bleed";
    return className;
  });

  function startTimer(activeStartedAt?: number): void {
    stopTimer();
    const baseStartedAt = activeStartedAt ?? Date.now();
    runningElapsedMs = Math.max(0, Date.now() - baseStartedAt);
    timer = setInterval(() => {
      runningElapsedMs = Math.max(0, Date.now() - baseStartedAt);
    }, 100);
  }

  function stopTimer(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function selectCell(): void {
    setSelectedNotebookCellId(sourcePath, cell.id);
  }

  async function toggleCodeSection(): Promise<void> {
    selectCell();
    const previousCollapsedCode = collapsedCode;
    const nextCollapsedCode = !collapsedCode;
    collapsedCode = nextCollapsedCode;
    if (nextCollapsedCode) {
      editingSource = false;
    }

    const persisted = await persistCollapseState({
      folded: nextCollapsedCode,
      outputFolded: collapsedOutput,
    });
    if (!persisted) {
      collapsedCode = previousCollapsedCode;
    }
  }

  async function toggleOutputSection(): Promise<void> {
    selectCell();
    const previousCollapsedOutput = collapsedOutput;
    const nextCollapsedOutput = !collapsedOutput;
    collapsedOutput = nextCollapsedOutput;

    const persisted = await persistCollapseState({
      folded: collapsedCode,
      outputFolded: nextCollapsedOutput,
    });
    if (!persisted) {
      collapsedOutput = previousCollapsedOutput;
    }
  }

  function handleRailKeydown(
    event: KeyboardEvent,
    section: "code" | "output",
  ): void {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    if (section === "code") {
      toggleCodeSection();
      return;
    }

    toggleOutputSection();
  }

  function handleSectionKeydown(
    event: KeyboardEvent,
    section: "code" | "output",
  ): void {
    if (
      !shouldHandleNotebookSectionKeydown(event.target, event.currentTarget)
    ) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    if (section === "output" && !hasOutputs) {
      return;
    }

    selectCell();
  }

  function handleSectionClick(event: MouseEvent): void {
    if (shouldIgnoreNotebookSectionClick(event.target, event.currentTarget)) {
      return;
    }

    selectCell();
  }

  function handleCollapsedSectionKeydown(
    event: KeyboardEvent,
    section: "code" | "output",
  ): void {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    if (section === "code") {
      void toggleCodeSection();
      return;
    }

    void toggleOutputSection();
  }

  function formatDuration(value: number): string {
    if (value < 1000) {
      return `${(value / 1000).toFixed(1)}s`;
    }

    const seconds = value / 1000;
    return seconds < 10 ? `${seconds.toFixed(1)}s` : `${seconds.toFixed(0)}s`;
  }

  function summarizeSetupPhases(
    phases: NotebookExecutionPhase[],
  ): string | undefined {
    if (phases.length === 0) {
      return undefined;
    }

    return phases
      .map(
        (phase) =>
          `${phase.label}${phase.durationMs !== undefined ? ` ${formatDuration(phase.durationMs)}` : ""}`,
      )
      .join(" • ");
  }

  function startEditingSource(): void {
    if (editingSource || executionState === "running") {
      return;
    }

    selectCell();
    editingSource = true;
  }

  async function commitSourceEdit(nextSource: string): Promise<boolean> {
    if (nextSource === localSource) {
      editingSource = false;
      return true;
    }

    const file = app.vault.getFileByPath(sourcePath);
    if (!file) {
      new Notice("Unable to update notebook cell source");
      return false;
    }

    savingSource = true;
    try {
      await app.vault.process(file, (documentSource) =>
        replaceNotebookCellSource(
          documentSource,
          { sourceRange: localSourceRange },
          nextSource,
        ),
      );
      localSource = nextSource;
      localSourceRange = updateNotebookCellSourceRange(
        localSourceRange,
        nextSource,
      );
      editingSource = false;
      return true;
    } catch (saveError) {
      console.error("Failed to update notebook cell source", saveError);
      new Notice("Failed to update notebook cell source");
      return false;
    } finally {
      savingSource = false;
    }
  }

  async function persistCollapseState(nextState: {
    folded: boolean;
    outputFolded: boolean;
  }): Promise<boolean> {
    const file = app.vault.getFileByPath(sourcePath);
    if (!file) {
      new Notice("Unable to update notebook cell state");
      return false;
    }

    const nextAttributes = {
      ...cell.attributes,
      folded: nextState.folded ? true : undefined,
      outputFolded: nextState.outputFolded ? true : undefined,
    } satisfies NotebookCell["attributes"];

    persistingCellAttributes = true;
    try {
      let nextDocumentSource = "";
      await app.vault.process(file, (documentSource) => {
        nextDocumentSource = replaceNotebookCellAttributes(
          documentSource,
          cell,
          nextAttributes,
        );
        return nextDocumentSource;
      });

      const nextDocument = parseNotebookDocument(nextDocumentSource, {
        sourcePath,
      });
      const nextCell = nextDocument.cells.find(
        (candidate) => candidate.id === cell.id,
      );
      if (nextCell) {
        localSourceRange = { ...nextCell.sourceRange };
        syncedCellSignature = [
          nextCell.id,
          nextCell.sourceRange.startOffset,
          nextCell.sourceRange.endOffset,
          nextCell.source,
        ].join(":");
      }

      return true;
    } catch (saveError) {
      console.error("Failed to update notebook cell state", saveError);
      new Notice("Failed to update notebook cell state");
      return false;
    } finally {
      persistingCellAttributes = false;
    }
  }

  function syncLocalCellFromActiveEditor(): void {
    const activeFile = app.workspace.getActiveFile?.();
    const activeEditor = (
      app.workspace.activeLeaf?.view as { editor?: unknown } | undefined
    )?.editor as {
      getValue: () => string;
    } | null;
    if (!activeFile || !activeEditor || activeFile.path !== sourcePath) {
      return;
    }

    const activeDocument = parseNotebookDocument(activeEditor.getValue(), {
      sourcePath,
    });
    const activeCell = activeDocument.cells.find(
      (candidate) => candidate.id === cell.id,
    );
    if (!activeCell) {
      return;
    }

    localSource = activeCell.source;
    localSourceRange = { ...activeCell.sourceRange };
    syncedCellSignature = [
      activeCell.id,
      activeCell.sourceRange.startOffset,
      activeCell.sourceRange.endOffset,
      activeCell.source,
    ].join(":");
  }

  function getActiveNotebookSource(): string {
    const activeFile = app.workspace.getActiveFile?.();
    const activeEditor = (
      app.workspace.activeLeaf?.view as { editor?: unknown } | undefined
    )?.editor as {
      getValue: () => string;
    } | null;
    if (!activeFile || !activeEditor || activeFile.path !== sourcePath) {
      return "";
    }
    return activeEditor.getValue();
  }

  $effect(() => {
    const signature = [
      cell.id,
      cell.sourceRange.startOffset,
      cell.sourceRange.endOffset,
      cell.source,
    ].join(":");
    // Use untrack to read syncedCellSignature without creating a reactive
    // dependency on it. The effect writes to syncedCellSignature (both directly
    // and via syncLocalCellFromActiveEditor), so making it a tracked read would
    // cause an effect_update_depth_exceeded loop whenever the editor-derived
    // signature diverges from the props-derived one (e.g. when a prior cell's
    // edit shifts this cell's sourceRange offsets before the editor refreshes).
    if (signature === untrack(() => syncedCellSignature)) {
      return;
    }

    syncedCellSignature = signature;
    localSource = cell.source;
    localSourceRange = { ...cell.sourceRange };
    syncLocalCellFromActiveEditor();
  });

  $effect(() => {
    cell.id;
    collapsedCode = Boolean(cell.attributes.folded);
    collapsedOutput = Boolean(cell.attributes.outputFolded);
  });

  $effect(() => {
    if (executionState === "running") {
      startTimer(startedAt);
      return;
    }

    stopTimer();
    if (durationMs !== undefined) {
      runningElapsedMs = durationMs;
    }
  });
</script>

<section
  bind:this={sectionElement}
  class="notebook-cell"
  data-notebook-cell={cell.id}
>
  <!-- Code section -->
  <div
    class={`notebook-cell__row notebook-cell__row--code ${sectionRowClass}`}
    class:notebook-cell__row--unselected={!cellSelected}
    onfocusin={selectCell}
  >
    <!-- Left rail: accent strip plus the empty rail space under the action button toggle collapse -->
    <div
      class="notebook-cell__rail notebook-cell__rail--code"
    >
      <button
        type="button"
        class="notebook-cell__rail-toggle notebook-cell__rail-toggle--code"
        style={`background-color: ${codeRailColor}`}
        aria-label={collapsedCode
          ? "Expand code section"
          : "Collapse code section"}
        aria-expanded={!collapsedCode}
        onclick={() => toggleCodeSection()}
      ></button>
      <!-- Run button — sits at top, to the right of the accent strip -->
      <Button
        variant="ghost"
        class={`notebook-cell__action ${
          codeActionState.mode === "stop"
            ? "notebook-cell__action--stop"
            : "notebook-cell__action--run"
        }`.trim()}
        aria-label={codeActionState.ariaLabel}
        disabled={codeActionState.disabled}
        onclick={(event) => {
          event.stopPropagation();
          if (codeActionState.mode === "stop") {
            void onStop?.();
            return;
          }
          void onRun?.();
        }}
      >
        {#if codeActionState.mode === "stop"}
          <Square class="notebook-cell__icon-dot" aria-hidden="true" />
        {:else}
          <Play class="notebook-cell__icon-inline" aria-hidden="true" />
        {/if}
      </Button>
      <button
        type="button"
        class="notebook-cell__rail-spacer-target notebook-cell__rail-spacer-target--code"
        aria-label={collapsedCode
          ? "Expand code section"
          : "Collapse code section"}
        aria-expanded={!collapsedCode}
        onclick={() => toggleCodeSection()}
      ></button>
    </div>

    {#if !collapsedCode}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="notebook-cell__surface notebook-cell__surface--code"
        class:notebook-cell__surface--stale={isStale}
        role={editingSource ? undefined : "button"}
        tabindex={editingSource ? undefined : 0}
        onclick={handleSectionClick}
        onkeydown={(event) => handleSectionKeydown(event, "code")}
        data-notebook-cell-loading={isBusy ? "true" : undefined}
        aria-busy={isBusy ? "true" : undefined}
      >
        <div class="notebook-cell__source" data-notebook-source>
          {#if executionState === "scheduled"}
            <div
              class="notebook-cell__badge notebook-cell__scheduled-badge"
            >
              queued
            </div>
          {/if}

          <div class:opacity-70={isBusy}>
            {#if editingSource}
              <NotebookCellSourceEditor
                value={localSource}
                lang={cell.lang}
                startLine={localSourceRange.startLine}
                {sourcePath}
                cellId={cell.id}
                getDocumentSource={getActiveNotebookSource}
                onCommit={commitSourceEdit}
              />
            {:else}
              <div
                role="button"
                tabindex="0"
                aria-label="Edit notebook cell source"
                onkeydown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") {
                    return;
                  }

                  event.preventDefault();
                  event.stopPropagation();
                  startEditingSource();
                }}
                onclick={(event) => {
                  event.stopPropagation();
                  startEditingSource();
                }}
              >
                <MarkdownEmbed
                  {app}
                  value={sourcePreview}
                  {sourcePath}
                  htmlPolicy="trusted"
                  surface={{ id: "notebook-cell" }}
                />
              </div>
            {/if}
          </div>
        </div>

        <div
          class="notebook-cell__footer"
        >
          <span class={`notebook-cell__status ${statusTone}`.trim()}>
            {#if executionState === "running"}
              <LoaderCircle class="notebook-cell__icon notebook-cell__icon--spin" aria-hidden="true" />
            {:else if executionState === "scheduled"}
              <Clock3 class="notebook-cell__icon" aria-hidden="true" />
            {:else if executionState === "stale"}
              <Clock3 class="notebook-cell__icon" aria-hidden="true" />
            {:else if executionState === "error"}
              <CircleAlert class="notebook-cell__icon" aria-hidden="true" />
            {:else if executionState === "completed"}
              <Check class="notebook-cell__icon" aria-hidden="true" />
            {/if}
            <span class={statusLabelClass}>{statusLabel}</span>
          </span>
          {#if statusDetail}
            <span class="notebook-cell__status-detail">{statusDetail}</span>
          {/if}
          {#if executionState === "error" && error}
            <span class="notebook-cell__error">{error}</span>
          {/if}
        </div>
      </div>
    {:else}
      <!-- Collapsed: show syntax-highlighted first non-blank source line -->
      <div
        class="notebook-cell__collapsed"
        role="button"
        tabindex="0"
        onclick={() => void toggleCodeSection()}
        onkeydown={(event) => handleCollapsedSectionKeydown(event, "code")}
      >
        {#if firstSourceLine}
          <div class="notebook-cell__collapsed-preview">
            <MarkdownEmbed
              {app}
              value={firstSourcePreview}
              {sourcePath}
              htmlPolicy="trusted"
              surface={{ id: "notebook-cell" }}
            />
          </div>
        {:else}
          <div
            class="notebook-cell__collapsed-empty"
          >
            Code is collapsed
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Output section -->
  <div
    class={`notebook-cell__row notebook-cell__row--output ${sectionRowClass}`}
    class:hidden={!hasOutputs}
    onfocusin={selectCell}
  >
    <!-- Left rail: accent strip plus the empty rail space under the menu button toggle collapse -->
    <div
      class="notebook-cell__rail notebook-cell__rail--output"
    >
      <button
        type="button"
        class="notebook-cell__rail-toggle notebook-cell__rail-toggle--output"
        style={`background-color: ${outputRailColor}`}
        aria-label={collapsedOutput
          ? "Expand output section"
          : "Collapse output section"}
        aria-expanded={!collapsedOutput}
        onclick={() => toggleOutputSection()}
      ></button>
      <!-- Output actions menu -->
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          class={menuTriggerClass}
          aria-label="Notebook output options"
          onclick={(event) => event.stopPropagation()}
        >
          <Ellipsis class="notebook-cell__icon" aria-hidden="true" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content side="right" align="start">
          <DropdownMenu.Item
            onclick={() => {
              void onClearOutputs?.();
            }}
          >
            Clear cell outputs
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
      <button
        type="button"
        class="notebook-cell__rail-spacer-target notebook-cell__rail-spacer-target--output"
        aria-label={collapsedOutput
          ? "Expand output section"
          : "Collapse output section"}
        aria-expanded={!collapsedOutput}
        onclick={() => toggleOutputSection()}
      ></button>
    </div>

    {#if !collapsedOutput}
      <div
        class="notebook-cell__output"
        role="button"
        tabindex="0"
        onclick={handleSectionClick}
        onkeydown={(event) => handleSectionKeydown(event, "output")}
      >
        <OutputRenderer {app} {sourcePath} {outputs} />
      </div>
    {:else}
      <div
        class="notebook-cell__output-collapsed"
        role="button"
        tabindex="0"
        onclick={() => void toggleOutputSection()}
        onkeydown={(event) => handleCollapsedSectionKeydown(event, "output")}
      >
        Outputs are collapsed
      </div>
    {/if}
  </div>
</section>
