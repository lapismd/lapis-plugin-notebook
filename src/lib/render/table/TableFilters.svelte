<script lang="ts">
  import Funnel from "@lucide/svelte/icons/funnel";
  import * as Popover from "@lapismd/design-core/shadcn/popover";
  import {
    FilterBuilder,
    filterConditionCount,
    type FilterField,
    type StructuredFilterState,
  } from "@lapismd/design-core/shadcn/filter-builder";
  let {
    fields,
    value,
    onValueChange,
    open = $bindable(false),
  }: {
    fields: readonly FilterField[];
    value: StructuredFilterState;
    onValueChange: (next: StructuredFilterState) => void;
    open?: boolean;
  } = $props();
  const descriptionId = $props.id();
  const count = $derived(filterConditionCount(value));
</script>

<span id={descriptionId} class="notebook-table-filter-description"
  >{count} active conditions</span
>
<Popover.Root bind:open>
  <Popover.Trigger
    aria-describedby={descriptionId}
    data-ui-component="button"
    data-slot="button"
    data-variant={count ? "secondary" : "ghost"}
    data-size="sm"
  >
    <Funnel aria-hidden="true" /><span>Filters</span>{#if count}<span
        class="notebook-table-filter-count">{count}</span
      >{/if}
  </Popover.Trigger>
  <Popover.Content
    class="notebook-table-filter-panel"
    align="end"
    collisionPadding={12}
    role="dialog"
    aria-label="Table filters"
  >
    <FilterBuilder {fields} {value} {onValueChange} />
  </Popover.Content>
</Popover.Root>

<style>
  .notebook-table-filter-description {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  :global(.notebook-table-filter-panel) {
    --ui-popover-width: var(
      --ui-filter-builder-width,
      min(48rem, calc(100svw - 1.5rem))
    );
    max-width: calc(100svw - 1.5rem);
    max-height: min(75svh, 42rem);
    overflow: auto;
  }
  .notebook-table-filter-count {
    font-size: 0.6875rem;
  }
</style>
