<script lang="ts">
  import {
    WorkspaceShell,
    type WorkspaceShellProps,
  } from "@lapis-notes/workspace";
  import { onMount } from "svelte";
  import type { App } from "@lapis-notes/api";

  import { bootPanelPlacementDemo } from "./create-panel-demo";
  import type {
    NotebookPanelKind,
    PanelDemoLayout,
  } from "./panel-placements";

  let {
    kind,
    layout,
    displayMode = "desktop",
  }: {
    kind: NotebookPanelKind;
    layout: PanelDemoLayout;
    displayMode?: WorkspaceShellProps["displayMode"];
  } = $props();

  let app = $state<App | null>(null);
  let status = $state<"booting" | "ready" | "error">("booting");
  let errorMessage = $state("");
  let root = $state<HTMLDivElement>();

  $effect(() => {
    if (!root || !app) return;
    const ownedRoot = root as HTMLDivElement & { __lapisApp?: App };
    ownedRoot.__lapisApp = app;
    return () => {
      if (ownedRoot.__lapisApp === app) delete ownedRoot.__lapisApp;
    };
  });

  onMount(() => {
    let cancelled = false;
    const runtimePromise = bootPanelPlacementDemo(kind, layout);
    void runtimePromise
      .then((runtime) => {
        if (cancelled) return;
        app = runtime.app;
        status = "ready";
      })
      .catch((error) => {
        status = "error";
        errorMessage = error instanceof Error ? error.message : String(error);
      });

    return () => {
      cancelled = true;
      void runtimePromise.then((runtime) => runtime.dispose());
    };
  });
</script>

<div
  bind:this={root}
  class="plugin-workspace-demo"
  class:plugin-workspace-demo--mobile={displayMode === "mobile"}
  data-testid="panel-demo"
  data-display-mode={displayMode}
  data-panel-kind={kind}
  data-panel-layout={layout}
  data-status={status}
>
  <span class="plugin-workspace-demo__status" data-testid="panel-demo-status">
    {status}
  </span>
  {#if status === "error"}
    <div class="plugin-workspace-demo__error" role="alert">
      Unable to start the panel workspace: {errorMessage}
    </div>
  {:else if app}
    <WorkspaceShell {app} {displayMode} workspaceLabel="Notebook" />
  {/if}
</div>

<style>
  :global(html:has(body.sb-main-fullscreen .plugin-workspace-demo)),
  :global(body.sb-main-fullscreen:has(.plugin-workspace-demo)) {
    height: 100%;
    height: 100dvh;
    max-height: 100%;
    overflow: hidden;
  }

  /* Canvas/test mode fills the viewport without relying on Storybook body
     classes or #storybook-root sizing; docs pages keep the 700px frame. */
  :global(html:not(:has(.docs-story)) .plugin-workspace-demo) {
    position: fixed;
    inset: 0;
    width: auto;
    height: auto;
    max-height: none;
  }

  :global(
    body.sb-main-fullscreen:has(#storybook-root .plugin-workspace-demo)
      #storybook-root
  ),
  :global(
    body.sb-main-fullscreen #storybook-root:has(.plugin-workspace-demo) > *
  ) {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    min-height: 0;
    overflow: hidden;
    padding: 0 !important;
  }

  .plugin-workspace-demo {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    max-height: 100%;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    color: var(--ui-workspace-foreground, var(--foreground));
    background: var(--ui-workspace-background, var(--background));
  }

  :global(.workspace-shell-docs-canvas) .plugin-workspace-demo {
    height: 700px;
    max-height: 700px;
    min-height: 700px;
  }

  .plugin-workspace-demo
    > :global([data-ui-component="lapis-workspace-shell"]) {
    flex: 1 1 0;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .plugin-workspace-demo__status {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
  }

  .plugin-workspace-demo__error {
    margin: 2rem;
    border: 1px solid var(--ui-border, currentColor);
    border-radius: 0.5rem;
    padding: 1rem;
  }
</style>
