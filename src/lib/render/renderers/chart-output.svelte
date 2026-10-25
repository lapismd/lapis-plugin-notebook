<script lang="ts">
  import { onMount } from "svelte";
  import vegaEmbed from "vega-embed";
  import type { NotebookChartOutput } from "../../output";

  type Props = {
    output: NotebookChartOutput;
  };

  let { output }: Props = $props();
  let container = $state<HTMLDivElement | null>(null);
  let error = $state<string | null>(null);

  onMount(() => {
    if (!container) {
      return;
    }

    // output.spec may be a Svelte $state Proxy; structuredClone (called by
    // Vega-Lite internally) cannot clone Proxy objects. $state.snapshot()
    // returns a plain, non-proxied copy that is safe to pass to vegaEmbed.
    const spec = $state.snapshot(output.spec);
    void vegaEmbed(container, spec as any, { actions: false }).catch(
      (reason) => {
        error = reason instanceof Error ? reason.message : String(reason);
      },
    );
  });
</script>

{#if error}
  <pre
    class="notebook-output__chart-error">{error}</pre>
{:else}
  <div
    bind:this={container}
    class="notebook-output__chart"
  ></div>
{/if}
