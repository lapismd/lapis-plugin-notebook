<script lang="ts">
  import { untrack } from "svelte";
  import type { App, TFile } from "@lapis-notes/api";
  import { MarkdownEmbed } from "@lapis-notes/markdown";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import {
    observeNotebookEmbedSource,
    type NotebookEmbedSource,
  } from "./notebook-embed-source";

  let {
    app,
    file,
    recursive = false,
    onError,
  }: {
    app: App;
    file: TFile;
    recursive?: boolean;
    onError: (path: string, error?: string) => void;
  } = $props();
  let state = $state<NotebookEmbedSource>({
    path: untrack(() => file.path),
    source: "",
    status: "loading",
  });
  $effect(() => {
    if (recursive) return;
    const ownerApp = app;
    const ownerFile = file;
    const reportError = onError;
    return untrack(() =>
      observeNotebookEmbedSource(ownerApp, ownerFile, (next) => {
        state = next;
        reportError(next.path, next.error);
      }),
    );
  });
</script>

<div
  role="group"
  class="notebook-embed"
  data-notebook-embed={state.path}
  aria-label={`Notebook ${state.path.split("/").at(-1)}`}
>
  <div class="notebook-embed__actions">
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={`Open notebook ${state.path.split("/").at(-1)}`}
      onclick={() => {
        const current = app.vault.getFileByPath(state.path);
        if (current) void app.openFile(current);
      }}><ExternalLink aria-hidden="true" /></Button
    >
  </div>
  {#if recursive}
    <p class="notebook-embed__notice">
      This notebook is already embedded above.
    </p>
  {:else if state.status === "ready"}
    <MarkdownEmbed
      {app}
      value={state.source}
      sourcePath={state.path}
      surface={{ id: "notebook-embed" }}
    />
  {:else if state.status === "missing"}
    <p class="notebook-embed__notice">Notebook file is unavailable.</p>
  {:else if state.status === "error"}
    <p class="notebook-embed__notice" role="alert">
      Unable to load notebook: {state.error}
    </p>
  {:else}
    <p class="notebook-embed__notice" role="status">Loading notebook…</p>
  {/if}
</div>

<style>
  .notebook-embed {
    width: 100%;
    min-width: 0;
    color: inherit;
  }
  .notebook-embed__actions {
    display: flex;
    justify-content: flex-end;
  }
  .notebook-embed__notice {
    margin-block: 0.5rem;
    color: var(--muted-foreground);
  }
</style>
