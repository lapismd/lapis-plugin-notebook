<script lang="ts">
  import { onDestroy } from "svelte";
  import type { Snippet } from "svelte";
  import type { App } from "@lapis-notes/api";
  import NotebookCellView from "./notebook-cell.svelte";
  import OutputRenderer from "./output-renderer.svelte";
  import {
    getNotebookRenderService,
    type RenderedNotebookCell,
  } from "./notebook-render-service";
  import { getNotebookCellExecutionRevision } from "../runtime/notebook-execution-signal.svelte";

  const logger = {
    debug: (...a: any[]) => console.debug("[notebook.cell]", ...a),
    info: (...a: any[]) => console.log("[notebook.cell]", ...a),
    warn: (...a: any[]) => console.warn("[notebook.cell]", ...a),
    error: (...a: any[]) => console.error("[notebook.cell]", ...a),
  };

  interface Props {
    app: App;
    embedded?: boolean;
    children?: Snippet<[]>;
    tagName?: string;
    sourcePath?: string;
    id: string;
    class?: string;
    ref?: HTMLElement | null;
    [key: string]: unknown;
  }

  let {
    app,
    embedded = false,
    children,
    tagName = "div",
    sourcePath = "",
    id,
    class: className = "",
    ref = $bindable<HTMLElement | null>(null),
    ...restProps
  }: Props = $props();

  let renderedCell = $state<RenderedNotebookCell | null>(null);
  let renamedCellId = $state<string>();
  let loadVersion = 0;
  const loadingLabel = "Loading notebook cell output";
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  const reloadDelayMs = 150;
  const cellId = $derived(renamedCellId ?? (typeof id === "string" ? id : ""));
  const isExecuting = $derived(Boolean(renderedCell?.loading));

  function clearRefreshTimer(): void {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  }

  function scheduleRefresh(version: number): void {
    clearRefreshTimer();
    refreshTimer = setTimeout(() => {
      if (version !== loadVersion) {
        return;
      }
      void loadRenderedCell();
    }, reloadDelayMs);
  }

  async function loadRenderedCell(): Promise<void> {
    const service = getNotebookRenderService();
    const version = ++loadVersion;
    clearRefreshTimer();

    if (!service || !sourcePath || !cellId) {
      renderedCell = null;
      return;
    }

    try {
      const nextCell = await service.getRenderedCell(sourcePath, cellId, {
        recreateInputs: !embedded,
      });
      if (version !== loadVersion) {
        return;
      }
      renderedCell = nextCell;
      if (nextCell?.loading) {
        scheduleRefresh(version);
      }
    } catch (error) {
      if (version !== loadVersion) {
        return;
      }
      console.error("Failed to render notebook cell", error);
    }
  }

  async function runCell(): Promise<void> {
    const service = getNotebookRenderService();
    if (!service || !sourcePath || !cellId || isExecuting) {
      logger.debug("runCell: skipped", {
        cellId,
        reason: !service
          ? "no-service"
          : !sourcePath
            ? "no-sourcePath"
            : !cellId
              ? "no-cellId"
              : "executing",
      });
      return;
    }

    logger.info("runCell: starting", { sourcePath, cellId });
    clearRefreshTimer();

    // Optimistically mark the cell as running so the view timer starts immediately,
    // without waiting for the async execution round-trip to complete.
    if (renderedCell) {
      renderedCell = {
        ...renderedCell,
        state: "scheduled",
        loading: true,
        statusMessage: "Queued 1 notebook cell",
      };
    }

    try {
      await service.runCell(sourcePath, cellId);
      logger.info("runCell: service.runCell complete", { sourcePath, cellId });
    } catch (error) {
      logger.error("runCell: failed", { sourcePath, cellId, error });
      console.error("Failed to run notebook cell", error);
    }

    await loadRenderedCell();
  }

  async function stopCell(): Promise<void> {
    const service = getNotebookRenderService();
    if (!service || !sourcePath || !cellId || !isExecuting) {
      return;
    }

    logger.warn("runCell: cancellation requested", { sourcePath, cellId });
    clearRefreshTimer();
    await service.cancelExecution(sourcePath);
    await loadRenderedCell();
  }

  async function clearCellOutputs(): Promise<void> {
    const service = getNotebookRenderService();
    if (!service || !sourcePath || !cellId || isExecuting) {
      return;
    }

    await service.clearCellOutput(sourcePath, cellId);
    await loadRenderedCell();
  }

  $effect(() => {
    sourcePath;
    id;
    renamedCellId = undefined;
  });

  $effect(() => {
    sourcePath;
    id;
    getNotebookCellExecutionRevision(sourcePath, cellId); // re-poll when this cell is queued or starts running
    void loadRenderedCell();
  });

  onDestroy(() => {
    loadVersion += 1;
    clearRefreshTimer();
  });
</script>

{#if renderedCell}
  <div
    bind:this={ref}
    class={`notebook-cell-host ${className}`.trim()}
    data-notebook-cell={cellId || undefined}
    {...restProps}
  >
    {#if embedded}
      <div class="notebook-embedded-cell">
        {#if renderedCell.error}
          <p role="alert">{renderedCell.error}</p>
        {:else if renderedCell.outputs.length}
          <OutputRenderer
            {app}
            {sourcePath}
            outputs={renderedCell.outputs}
            embedded
          />
        {:else if renderedCell.loading}
          <p role="status">Running notebook cell…</p>
        {:else if renderedCell.state !== "completed"}
          <p>Open the notebook and run it to display this cell’s output.</p>
        {/if}
      </div>
    {:else}
      <NotebookCellView
        {app}
        cell={renderedCell.cell}
        {sourcePath}
        outputs={renderedCell.outputs}
        executionState={renderedCell.state}
        error={renderedCell.error}
        durationMs={renderedCell.durationMs}
        startedAt={renderedCell.startedAt}
        statusMessage={renderedCell.statusMessage}
        setupPhases={renderedCell.setupPhases ?? []}
        canRun={true}
        onRun={runCell}
        onStop={stopCell}
        onClearOutputs={clearCellOutputs}
        onRename={(id) => {
          renamedCellId = id;
        }}
      />
    {/if}
  </div>
{:else}
  <svelte:element
    this={tagName}
    bind:this={ref}
    class={className}
    data-notebook-cell={cellId || undefined}
    {...restProps}
  >
    {@render children?.()}
  </svelte:element>
{/if}

<style>
  .notebook-embedded-cell {
    padding-block: 0.5rem;
  }
  .notebook-embedded-cell > p {
    margin: 0;
    color: var(--muted-foreground);
  }
</style>
