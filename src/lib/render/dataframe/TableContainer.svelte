<script lang="ts">
  import { createVirtualizer } from "@tanstack/svelte-virtual";
  import ExpandedRowDetail from "./ExpandedRowDetail.svelte";
  import DataRow from "./DataRow.svelte";
  import TableHead from "./TableHead.svelte";
  import { keyNav } from "./actions/keyNav";
  import type {
    Column,
    ColumnSummary,
    DataFrameOptions,
    DataFrameRow,
    DataFrameSchema,
    SortState,
  } from "./dataframe-types";

  const ROW_HEIGHT_MAP = {
    compact: 28,
    default: 36,
    relaxed: 48,
  } as const;

  let {
    schema,
    columns,
    rows,
    state: viewerState,
    summaryByKey,
    options = {},
    onToggleSort,
    onOpenProfile,
    searchInputId,
  }: {
    schema: DataFrameSchema;
    columns: Column[];
    rows: DataFrameRow[];
    state: {
      sortColumns: SortState[];
      filterBarOpen: boolean;
      searchQuery: string;
      rowHeight: "compact" | "default" | "relaxed";
      expandedRows: Set<number>;
      activeProfile: string | null;
      setFilterBarOpen: (open: boolean) => void;
      setSearch: (value: string) => void;
      setProfile: (value: string | null) => void;
      toggleRow: (index: number) => void;
      sparkbars: boolean;
      colWidths: Map<string, number>;
    };
    summaryByKey: Record<string, ColumnSummary>;
    options?: DataFrameOptions;
    onToggleSort: (column: string, multi: boolean) => void;
    onOpenProfile: (column: string) => void;
    searchInputId: string;
  } = $props();

  let containerEl: HTMLDivElement | null = $state(null);

  let gridTemplate = $derived(
    columns
      .map((column) => {
        const width = viewerState.colWidths.get(column.name);
        return width ? `minmax(${width}px, 1fr)` : "minmax(12rem, 1fr)";
      })
      .join(" "),
  );

  let useVirtualization = $derived(rows.length > 200);

  let virtualizer = createVirtualizer({
    get count() {
      return rows.length;
    },
    getScrollElement: () => containerEl,
    estimateSize: () => ROW_HEIGHT_MAP[viewerState.rowHeight],
    overscan: 10,
  }) as unknown as {
    getVirtualItems: () => Array<{
      key: string | number;
      index: number;
      start: number;
    }>;
    getTotalSize: () => number;
    setOptions: (options: {
      count: number;
      estimateSize?: () => number;
    }) => void;
  };

  let virtualRows = $derived(virtualizer.getVirtualItems());
  let totalSize = $derived(virtualizer.getTotalSize());
</script>

<div
  bind:this={containerEl}
  role="region"
  aria-label="Dataframe rows"
  class="notebook-dataframe__table-container"
  style:max-height="var(--df-max-height)"
  use:keyNav={{
    focusSearch: () =>
      (
        document.getElementById(searchInputId) as HTMLInputElement | null
      )?.focus(),
    toggleFilters: () =>
      viewerState.setFilterBarOpen(!viewerState.filterBarOpen),
    clearOverlay: () => {
      if (viewerState.activeProfile) {
        viewerState.setProfile(null);
      } else if (viewerState.searchQuery) {
        viewerState.setSearch("");
      } else if (viewerState.filterBarOpen) {
        viewerState.setFilterBarOpen(false);
      }
    },
  }}
>
  <div
    role="grid"
    aria-rowcount={rows.length}
    aria-colcount={columns.length}
    class="notebook-dataframe__table"
  >
    <TableHead
      {columns}
      {summaryByKey}
      sorts={viewerState.sortColumns}
      {gridTemplate}
      {onToggleSort}
      {onOpenProfile}
      showSummaries={options.showColumnSummaries !== false}
    />

    {#if !useVirtualization}
      <div role="rowgroup" class="notebook-dataframe__rows">
        {#each rows as row, index}
          <DataRow
            {row}
            {index}
            {columns}
            {summaryByKey}
            state={viewerState}
            {gridTemplate}
          />
          {#if viewerState.expandedRows.has(index)}
            <ExpandedRowDetail {row} {columns} />
          {/if}
        {/each}
      </div>
    {:else}
      <div
        role="rowgroup"
        class="notebook-dataframe__rows notebook-dataframe__rows--virtual"
        style:height={`${totalSize}px`}
      >
        {#each virtualRows as virtualRow (virtualRow.key)}
          <DataRow
            row={rows[virtualRow.index]}
            index={virtualRow.index}
            {columns}
            {summaryByKey}
            state={viewerState}
            {gridTemplate}
            allowExpand={false}
            style={`position:absolute;left:0;right:0;top:0;transform:translateY(${virtualRow.start}px);`}
          />
        {/each}
      </div>
    {/if}
  </div>
</div>
