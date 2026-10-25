<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    children,
    placement = "overlay",
  }: {
    children: Snippet;
    placement?: "overlay" | "inline";
  } = $props();
</script>

<aside
  class="fixture-controls"
  class:fixture-controls--inline={placement === "inline"}
  data-story-fixture-controls="true"
  aria-label="Story setup"
>
  <span class="fixture-controls__label">Story setup</span>
  {@render children()}
</aside>

<style>
  .fixture-controls {
    position: absolute;
    inset-block-start: 0.5rem;
    inset-inline-end: 0.5rem;
    z-index: 100;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border: 2px dotted var(--muted-foreground);
    border-radius: 0.25rem;
    color: var(--foreground);
    background: var(--background);
  }
  .fixture-controls--inline {
    position: static;
    margin-block-end: 0.5rem;
  }
  .fixture-controls__label {
    font-size: 0.75rem;
    font-weight: 600;
  }
</style>
