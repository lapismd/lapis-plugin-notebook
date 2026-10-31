<script lang="ts">
  import Funnel from "@lucide/svelte/icons/funnel";
  import { Button } from "@lapismd/design-core/shadcn/button";
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
  const count = $derived(filterConditionCount(value));
</script>

<Popover.Root bind:open>
  <Popover.Trigger
    aria-description={`${count} active conditions`}
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
    aria-label="Table filters"
  >
    <FilterBuilder {fields} {value} {onValueChange} />
  </Popover.Content>
</Popover.Root>

<style>
  :global(.notebook-table-filter-panel) {
    --ui-popover-width: var(
      --ui-filter-builder-width,
      min(48rem, calc(100svw - 1rem))
    );
    max-width: calc(100svw - 1rem);
    max-height: min(75svh, 42rem);
    overflow: auto;
  }
  .notebook-table-filter-count {
    font-size: 0.6875rem;
  }
</style>
