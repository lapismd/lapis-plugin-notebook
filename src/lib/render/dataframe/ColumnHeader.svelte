<script lang="ts">
  import SortIcon from "./SortIcon.svelte";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import DataFrameColumnSummary from "./DataFrameColumnSummary.svelte";
  import type { Column, ColumnSummary, SortState } from "./dataframe-types";

  let {
    column,
    summary,
    sortState = undefined,
    filterActive = false,
    onToggleSort,
    onOpenProfile,
    showSummary = true,
    sortable = true,
  }: {
    column: Column;
    summary?: ColumnSummary;
    sortState?: SortState;
    filterActive?: boolean;
    onToggleSort: (multi: boolean) => void;
    onOpenProfile: () => void;
    showSummary?: boolean;
    sortable?: boolean;
  } = $props();
</script>

<div class="notebook-dataframe__column">
  <div class="notebook-dataframe__column-head">
    <button
      type="button"
      class="notebook-dataframe__column-sort"
      disabled={!sortable}
      onclick={(event: MouseEvent) => sortable && onToggleSort(event.shiftKey)}
    >
      <span class="notebook-dataframe__column-title">
        <span class="notebook-dataframe__column-label"
          >{column.label ?? column.name}</span
        >
        <SortIcon direction={sortState?.direction} />
      </span>
      <span class="notebook-dataframe__column-meta">
        <span>{column.displayType ?? column.type}</span>
        {#if column.nullable}
          <span>nullable</span>
        {/if}
        {#if filterActive}
          <Badge variant="outline" class="notebook-dataframe__column-badge"
            >filtered</Badge
          >
        {/if}
        {#if sortState && sortState.priority > 1}
          <Badge variant="outline" class="notebook-dataframe__column-badge"
            >{sortState.priority}</Badge
          >
        {/if}
      </span>
    </button>

    <Button
      variant="ghost"
      size="sm"
      class="notebook-dataframe__column-profile"
      onclick={onOpenProfile}
      aria-label={`Open profile for ${column.label ?? column.name}`}
      title={`Open profile for ${column.label ?? column.name}`}
    >
      <Ellipsis class="notebook-dataframe__column-profile-icon" />
    </Button>
  </div>

  {#if showSummary && summary}
    <DataFrameColumnSummary {summary} variant="compact" />
  {/if}
</div>
