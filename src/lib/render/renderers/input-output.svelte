<script lang="ts">
  import { onDestroy } from "svelte";
  import "@lapis-notes/notebook-input/styles.css";
  import type { NotebookInputOutput } from "../../output";
  import { getNotebookRenderService } from "../notebook-render-service";

  type Props = {
    sourcePath: string;
    output: NotebookInputOutput;
  };

  let { sourcePath, output }: Props = $props();
  let containerElement: HTMLElement | undefined;
  let attachedNode: Node | null = null;
  let attachedKey: string | null = null;
  let hasMountedNode = $state(false);

  function detachAttachedNode(): void {
    const node = attachedNode;
    if (node && node.parentNode === containerElement) {
      containerElement?.removeChild(node);
    }
    attachedNode = null;
    attachedKey = null;
  }

  $effect(() => {
    const container = containerElement;
    const key = `${sourcePath}:${output.cellId}:${output.variableName}`;
    if (!container || attachedKey === key) {
      return;
    }

    detachAttachedNode();
    let cancelled = false;
    void (async () => {
      const node =
        (await getNotebookRenderService()?.getOrCreateInputOutput(
          sourcePath,
          output,
        )) ?? null;
      if (cancelled || container !== containerElement) {
        return;
      }
      if (!node) {
        hasMountedNode = false;
        return;
      }

      attachedNode = node;
      attachedKey = key;
      hasMountedNode = true;
      container.replaceChildren(node);
    })();

    return () => {
      cancelled = true;
    };
  });

  onDestroy(() => {
    detachAttachedNode();
  });
</script>

<div
  class="notebook-output__dom"
  data-notebook-output="input"
  data-notebook-input-type={output.inputType}
>
  {#if output.label}
    <div
      class="notebook-output__dom-label"
    >
      {output.label}
    </div>
  {/if}
  <div bind:this={containerElement} class="notebook-output__dom-mount">
    {#if !hasMountedNode}
      <span class="notebook-output__dom-missing"
        >Run the cell to recreate this interactive output.</span
      >
    {/if}
  </div>
</div>
