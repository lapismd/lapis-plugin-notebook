<script lang="ts">
  let { value }: { value: unknown } = $props();
  function content(element: HTMLElement, node: Node) {
    element.replaceChildren(node);
    return {
      destroy() {
        if (node.parentNode === element) element.removeChild(node);
      },
    };
  }
</script>

{#if value instanceof Node}
  <span use:content={value}></span>
{:else}
  {value == null ? "" : String(value)}
{/if}
