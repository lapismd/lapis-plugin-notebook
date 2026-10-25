<script lang="ts">
  import { onDestroy } from "svelte";
  import "@lapis-notes/notebook-input/styles.css";
  import type { NotebookDomOutput } from "../../output";
  import { getNotebookRenderService } from "../notebook-render-service";

  type Props = {
    output: NotebookDomOutput;
  };

  let { output }: Props = $props();
  let containerElement: HTMLElement | undefined;
  let attachedNode: Node | null = null;
  let attachedOutputId: string | null = null;
  let hasMountedNode = $state(false);

  function detachAttachedNode(): void {
    const node = attachedNode;
    if (node && node.parentNode === containerElement) {
      containerElement?.removeChild(node);
    }
    attachedNode = null;
    attachedOutputId = null;
  }

  $effect(() => {
    const outputId = output.outputId;
    const container = containerElement;
    if (!container || attachedOutputId === outputId) {
      return;
    }

    detachAttachedNode();
    const node = getNotebookRenderService()?.claimDomOutput(outputId) ?? null;
    if (!node) {
      hasMountedNode = false;
      return;
    }

    attachedNode = node;
    attachedOutputId = outputId;
    hasMountedNode = true;
    container.replaceChildren(node);
  });

  onDestroy(() => {
    detachAttachedNode();
  });
</script>

<div
  class="notebook-output__dom"
  data-notebook-output="dom"
  data-notebook-dom-role={output.role}
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
