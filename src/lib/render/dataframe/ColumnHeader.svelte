<script lang="ts">
  import ArrowDownWideNarrow from "@lucide/svelte/icons/arrow-down-wide-narrow";
  import ArrowUpNarrowWide from "@lucide/svelte/icons/arrow-up-narrow-wide";
  import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";
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
  }: {
    column: Column;
    summary?: ColumnSummary;
    sortState?: SortState;
    filterActive?: boolean;
    onToggleSort: (multi: boolean) => void;
    onOpenProfile: () => void;
    showSummary?: boolean;
  } = $props();
</script>

<div class="notebook-dataframe__column">
  <div class="notebook-dataframe__column-head">
    <button
      type="button"
      class="notebook-dataframe__column-sort"
      onclick={(event: MouseEvent) => onToggleSort(event.shiftKey)}
    >
      <span class="notebook-dataframe__column-title">
        <span class="notebook-dataframe__column-label"
          >{column.label ?? column.name}</span
        >
        {#if sortState?.direction === "asc"}
          <ArrowUpNarrowWide class="notebook-dataframe__column-sort-icon" />
        {:else if sortState?.direction === "desc"}
          <ArrowDownWideNarrow class="notebook-dataframe__column-sort-icon" />
        {:else}
          <ChevronsUpDown
            class="notebook-dataframe__column-sort-icon notebook-dataframe__column-sort-icon--idle"
          />
        {/if}
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
    >
      <Ellipsis class="notebook-dataframe__column-profile-icon" />
    </Button>
  </div>

  {#if showSummary && summary}
    <DataFrameColumnSummary {summary} variant="compact" />
  {/if}
</div>
