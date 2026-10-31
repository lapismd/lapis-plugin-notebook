<script lang="ts">
  import { onMount } from "svelte";
  import type { App, TFile } from "@lapis-notes/api";
  import * as Popover from "@lapismd/design-core/shadcn/popover";
  import { Progress } from "@lapismd/design-core/shadcn/progress";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import {
    NotebookRunCoordinator,
    type NotebookRunSummary,
  } from "../runtime/notebook-run-coordinator";
  import Square from "@lucide/svelte/icons/square";
  import RotateCw from "@lucide/svelte/icons/rotate-cw";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";
  import NotebookRunAllIcon from "../notebook-run-all-icon.svelte";
  import type {
    NotebookRuntimeStatusPresentation,
    NotebookOutputStatusPresentation,
  } from "../runtime/notebook-runtime-status";
  import NotebookIcon from "../render/notebook-icon.svelte";
  import "./notebook-execution-status.css";

  let {
    app,
    runs,
    run,
    stop,
    revealCell,
    describeNotebook,
    rerunStale,
    clearOutputs,
  }: {
    app: App;
    runs: NotebookRunCoordinator;
    run: () => Promise<void>;
    stop: (path: string) => Promise<unknown>;
    revealCell: (path: string, cellId: string) => Promise<void>;
    describeNotebook: (path: string) => Promise<{
      runtime: NotebookRuntimeStatusPresentation;
      outputs: NotebookOutputStatusPresentation | null;
    }>;
    rerunStale: () => Promise<void>;
    clearOutputs: () => Promise<void>;
  } = $props();
  let path = $state("");
  let summary = $state<NotebookRunSummary>();
  let now = $state(Date.now());
  const disabled = $derived(
    app.contextKeys.get("safeMode.notebookExecutionDisabled") === true ||
      app.safeMode.disableNotebookExecution,
  );
  let presentation = $state<Awaited<ReturnType<typeof describeNotebook>>>();
  let detailError = $state("");
  const outcome = $derived(summary?.outcome);
  let open = $state(false);
  const running = $derived(summary?.outcome === "running");
  const total = $derived(summary?.plannedCellIds.length ?? 0);
  const completed = $derived(summary?.completedCellIds.length ?? 0);
  const percent = $derived(total ? Math.round((completed / total) * 100) : 0);
  const elapsed = $derived(
    summary ? Math.max(0, (summary.endedAt ?? now) - summary.startedAt) : 0,
  );
  const label = $derived(
    summary
      ? {
          running: "Running",
          succeeded: "Completed",
          failed: "Failed",
          cancelled: "Cancelled",
        }[summary.outcome]
      : "Ready",
  );
  const outcomeIcon = $derived(
    disabled && !running
      ? "shield-alert"
      : outcome === "failed"
        ? "circle-alert"
        : outcome === "cancelled"
          ? "circle-slash"
          : outcome === "succeeded"
            ? "circle-check"
            : running
              ? "loader-circle"
              : "notebook",
  );
  function duration(ms: number) {
    return ms < 60_000
      ? `${(ms / 1000).toFixed(1)}s`
      : `${Math.floor(ms / 60_000)}m ${Math.floor(ms / 1000) % 60}s`;
  }
  function syncContext() {
    const view = app.workspace.activeLeaf?.view as
      | { file?: TFile; getViewType?: () => string }
      | undefined;
    const next =
      view?.getViewType?.() === "notebook" ? (view.file?.path ?? "") : "";
    if (path !== next) open = false;
    path = next;
    summary = runs.get(path);
    now = Date.now();
  }
  onMount(() => {
    const fileRef = app.workspace.on("file-open", syncContext);
    const leafRef = app.workspace.on("active-leaf-change", syncContext);
    const unsubscribe = runs.subscribe(syncContext);
    syncContext();
    return () => {
      unsubscribe();
      app.workspace.offref(fileRef);
      app.workspace.offref(leafRef);
    };
  });
  $effect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      now = Date.now();
    }, 100);
    return () => clearInterval(timer);
  });
  $effect(() => {
    if (!open || !path) return;
    outcome;
    const currentPath = path;
    let cancelled = false;
    void describeNotebook(currentPath)
      .then((next) => {
        if (!cancelled) {
          presentation = next;
          detailError = "";
        }
      })
      .catch((error) => {
        if (!cancelled)
          detailError = error instanceof Error ? error.message : String(error);
      });
    return () => {
      cancelled = true;
    };
  });
  async function toggleRun() {
    // Execution errors are retained by the coordinator, rather than toasted.
    await (running ? stop(path) : run()).catch(() => undefined);
    syncContext();
  }
</script>

{#if path}
  <div
    class="notebook-execution-status"
    data-testid="notebook-execution-status"
    role="group"
    aria-label="Notebook execution controls"
    data-outcome={summary?.outcome ?? "idle"}
    class:notebook-execution-status--running={running}
  >
    <button
      type="button"
      class="notebook-execution-status__action"
      aria-label={running ? "Stop notebook execution" : "Run notebook"}
      title={running ? "Stop notebook execution" : "Run notebook"}
      disabled={!running && disabled}
      onclick={toggleRun}
    >
      {#if running}<Square aria-hidden="true" />{:else}<NotebookRunAllIcon
          aria-hidden="true"
        />{/if}
    </button>
    <Popover.Root bind:open>
      <Popover.Trigger
        class="notebook-execution-status__details"
        aria-label={`Notebook run details · ${disabled && !running ? "Execution disabled" : label}${summary ? ` ${duration(elapsed)}` : ""}`}
        title={`Notebook · ${disabled && !running ? "Execution disabled" : label}${summary ? ` · ${duration(elapsed)}` : ""}`}
      >
        <span aria-hidden="true"
          ><NotebookIcon
            name={outcomeIcon}
            class="notebook-execution-status__outcome"
          /></span
        >
        {#if summary}<span class="notebook-execution-status__duration"
            >{duration(elapsed)}</span
          >{/if}
      </Popover.Trigger>
      <Popover.Content
        side="top"
        align="end"
        class="notebook-execution-status__popover"
        role="dialog"
        aria-label="Notebook run details"
        data-outcome={summary?.outcome ?? "idle"}
      >
        <Popover.Header class="notebook-execution-status__heading">
          <span
            class="notebook-execution-status__summary-icon"
            aria-hidden="true"
          >
            <NotebookIcon name={outcomeIcon} />
          </span>
          <div class="notebook-execution-status__heading-copy">
            <Popover.Title>Notebook run</Popover.Title>
            <Popover.Description title={path}>{path}</Popover.Description>
          </div>
          <span class="notebook-execution-status__label"
            >{disabled && !running ? "Safe Mode" : label}</span
          >
        </Popover.Header>
        <div class="notebook-execution-status__body">
          {#if summary}
            <div class="notebook-execution-status__summary">
              <strong>{completed}/{total} cells</strong>
              <span
                class="notebook-execution-status__elapsed"
                aria-label="Run duration">{duration(elapsed)}</span
              >
            </div>
            <Progress
              value={percent}
              aria-label="Notebook run detail progress"
            />
            <div class="notebook-execution-status__progress-caption">
              <span>{percent}%</span>
              <span
                >{summary.runningCellId
                  ? `Running ${summary.runningCellId}`
                  : label}</span
              >
            </div>
          {:else}
            <p class="notebook-execution-status__empty">
              {disabled
                ? "Notebook execution is disabled in Safe Mode."
                : "Run this notebook to see progress and results here."}
            </p>
          {/if}
          {#if detailError}<p class="notebook-execution-status__error-message">
              {detailError}
            </p>{/if}
          {#if presentation}
            <dl class="notebook-execution-status__metadata">
              <dt>Runtime</dt>
              <dd title={presentation.runtime.detail}>
                {presentation.runtime.label}
              </dd>
              <dt>Outputs</dt>
              <dd>{presentation.outputs?.label ?? "No generated outputs"}</dd>
            </dl>
          {/if}
          {#if summary?.phases.length}
            <details class="notebook-execution-status__setup">
              <summary
                >Setup phases <span>{summary.phases.length}</span></summary
              >
              <ul class="notebook-execution-status__phases">
                {#each summary.phases as phase (phase.key)}
                  <li>
                    <span>{phase.label}</span><span
                      >{phase.status}{phase.durationMs !== undefined
                        ? ` · ${duration(phase.durationMs)}`
                        : ""}</span
                    >
                  </li>
                {/each}
              </ul>
            </details>
          {/if}
          {#each summary?.errors ?? [] as error, i (i)}
            <div class="notebook-execution-status__error">
              <strong
                >{error.cellId
                  ? `Cell ${error.cellId} failed`
                  : "Execution failed"}</strong
              >
              <p>{error.message}</p>
              {#if error.cellId}
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => {
                    open = false;
                    void revealCell(path, error.cellId!);
                  }}
                  ><ArrowUpRight
                    aria-hidden="true"
                    data-icon="inline-start"
                  />Reveal {error.cellId}</Button
                >
              {/if}
            </div>
          {/each}
        </div>
        <div class="notebook-execution-status__commands">
          <Button
            variant="outline"
            size="sm"
            disabled={running || disabled}
            onclick={() => {
              open = false;
              void rerunStale().catch(() => undefined);
            }}
            ><RotateCw aria-hidden="true" data-icon="inline-start" />Run stale
            cells</Button
          >
          <Button
            variant="ghost"
            size="sm"
            disabled={running}
            onclick={() => {
              open = false;
              void clearOutputs().catch(() => undefined);
            }}
            ><Trash2 aria-hidden="true" data-icon="inline-start" />Clear outputs</Button
          >
        </div>
      </Popover.Content>
    </Popover.Root>
  </div>
{/if}
