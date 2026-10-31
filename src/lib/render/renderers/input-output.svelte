<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import "@lapis-notes/notebook-input/styles.css";
  import type { NotebookInputOutput } from "../../output";
  import { getNotebookRenderService } from "../notebook-render-service";
  import { formatNotebookDisplayValue } from "../../runtime/notebook-display-value";

  type Props = {
    sourcePath: string;
    output: NotebookInputOutput;
    embedded?: boolean;
  };

  let { sourcePath, output, embedded = false }: Props = $props();
  const labelledControls = new Set([
    "button",
    "checkbox",
    "radio",
    "select",
    "search",
    "file",
  ]);
  const hasControlLabel = $derived(
    output.source?.library === "@lapis-notes/notebook-input" &&
      labelledControls.has(output.inputType),
  );
  let containerElement: HTMLElement | undefined;
  let attachedNode: Node | null = null;
  let hasMountedNode = $state(false);
  // Re-polling a cell may replace its metadata object without changing it.
  const outputKey = $derived(formatNotebookDisplayValue(output));

  function detachAttachedNode(): void {
    const node = attachedNode;
    if (node && node.parentNode === containerElement) {
      containerElement?.removeChild(node);
    }
    attachedNode = null;
  }

  $effect(() => {
    const container = containerElement;
    // Copies retain their owner across equivalent polled metadata. The main
    // notebook must reclaim its canonical node after a reactive rerun.
    if (embedded) outputKey;
    const nextOutput = embedded ? untrack(() => output) : output;
    if (!container) return;

    let cancelled = false;
    const controller = new AbortController();
    let owned: { node: Node; dispose: () => void } | null = null;
    void (async () => {
      const service = getNotebookRenderService();
      if (embedded)
        owned =
          (await service?.createEmbeddedInputOutput(
            sourcePath,
            nextOutput,
            controller.signal,
          )) ?? null;
      const node = embedded
        ? (owned?.node ?? null)
        : ((await service?.getOrCreateInputOutput(sourcePath, nextOutput)) ??
          null);
      if (cancelled || container !== containerElement) {
        owned?.dispose();
        return;
      }
      if (!node) {
        detachAttachedNode();
        hasMountedNode = false;
        return;
      }

      if (node !== attachedNode) {
        detachAttachedNode();
        container.replaceChildren(node);
      }
      attachedNode = node;
      hasMountedNode = true;
    })();

    return () => {
      cancelled = true;
      controller.abort();
      owned?.dispose();
    };
  });

  onDestroy(() => {
    detachAttachedNode();
  });
</script>

<div
  class="notebook-output__dom"
  class:notebook-output__dom--labelled={Boolean(
    output.label && !hasControlLabel,
  )}
  data-notebook-output="input"
  data-notebook-input-type={output.inputType}
>
  {#if output.label && !hasControlLabel}
    <div class="notebook-output__dom-label">
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
