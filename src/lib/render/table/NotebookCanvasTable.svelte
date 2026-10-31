<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import {
    CanvasTable,
    type CanvasTableCellContext,
    type CanvasTableRowId,
    type CanvasTableSelection,
  } from "@lapismd/design-core/shadcn/canvas-table";
  import { createFilterState } from "@lapismd/design-core/shadcn/filter-builder";
  import type {
    Column,
    DataFrameRow,
    SortState,
  } from "../dataframe/dataframe-types";
  import { clientSort } from "../dataframe/utils/sort";
  import {
    filterTableRows,
    inferTableTypes,
    tableFilterFields,
  } from "./table-filter-model";
  import { identifyTableRows } from "./table-identity";
  import { tableText } from "./table-values";
  import TableFilters from "./TableFilters.svelte";
  let {
    rows,
    columns,
    allColumns = columns,
    visibleRowIds,
    selectionRowIds,
    rowSelection = false,
    selectedRowIds = [],
    onSelectedRowIdsChange,
    expandedRowIds = [],
    onExpandedRowIdsChange,
    header,
    cell,
    details,
    widths,
    onWidthsChange,
    rowHeight = 36,
    headerHeight = 48,
    showFilters = true,
    label = "Notebook data table",
    height = "320px",
  }: {
    rows: readonly DataFrameRow[];
    columns: readonly Column[];
    allColumns?: readonly Column[];
    visibleRowIds?: readonly number[];
    selectionRowIds?: readonly number[];
    rowSelection?: boolean | CanvasTableSelection;
    selectedRowIds?: readonly number[];
    onSelectedRowIdsChange?: (ids: number[]) => void;
    expandedRowIds?: readonly number[];
    onExpandedRowIdsChange?: (ids: number[]) => void;
    header?: Snippet<[Column]>;
    cell?: Snippet<
      [{ row: DataFrameRow; column: Column; context: CanvasTableCellContext }]
    >;
    details?: Snippet<[DataFrameRow]>;
    widths?: readonly number[];
    onWidthsChange?: (widths: number[]) => void;
    rowHeight?: number;
    headerHeight?: number;
    showFilters?: boolean;
    label?: string;
    height?: string;
  } = $props();
  let filter = $state(createFilterState());
  let sort = $state<SortState[]>([]);
  let localWidths = $state<Record<string, number>>({});
  const schemaKey = $derived(
    allColumns.map((c) => c.name + ":" + c.type).join("\0"),
  );
  let inferred = $state<ReturnType<typeof inferTableTypes>>([]);
  $effect(() => {
    void schemaKey;
    const source = rows;
    untrack(() => {
      inferred = inferTableTypes(source, allColumns);
      filter = createFilterState();
      sort = [];
    });
  });
  const fields = $derived(tableFilterFields(allColumns, inferred, filter));
  const matched = $derived(filterTableRows(rows, filter, fields));
  const displayIds = $derived(
    visibleRowIds ?? identifyTableRows(rows, clientSort(matched, sort)),
  );
  const scopeIds = $derived(
    selectionRowIds ?? identifyTableRows(rows, matched),
  );
  const canvasRows = $derived(
    rows.map((row, id) => ({
      id,
      cells: columns.map((column) => tableText(row[column.name])),
    })),
  );
  const descriptors = $derived(
    columns.map((column) => ({
      id: column.name,
      label: column.label ?? column.name,
      header: renderHeader,
      cell: renderCell,
    })),
  );
  function nextSort(column: string) {
    const current = sort.find((entry) => entry.column === column);
    sort = !current
      ? [{ column, direction: "asc", priority: 1 }]
      : current.direction === "asc"
        ? [{ column, direction: "desc", priority: 1 }]
        : [];
  }
  function numbers(ids: CanvasTableRowId[]) {
    return ids.filter((id): id is number => typeof id === "number");
  }
</script>

{#snippet renderHeader(context: { column: number })}
  {@const column = columns[context.column]}
  {#if column}
    {#if header}{@render header(column)}{:else}
      <button
        type="button"
        class="notebook-canvas-heading"
        onclick={() => nextSort(column.name)}
        aria-label={"Sort " + (column.label ?? column.name)}
      >
        {column.label ?? column.name}{#if sort[0]?.column === column.name}<span
            >{sort[0].direction === "asc" ? "↑" : "↓"}</span
          >{/if}
      </button>
    {/if}
  {/if}
{/snippet}
{#snippet renderCell(context: CanvasTableCellContext)}
  {@const row = rows[Number(context.row.id)]}
  {@const column = columns[context.column]}
  {#if row && column}
    {#if cell}{@render cell({ row, column, context })}{:else}<span
        class="notebook-canvas-value">{context.value}</span
      >{/if}
  {/if}
{/snippet}
{#snippet renderDetails(context: { row: { id: CanvasTableRowId } })}
  {@const row = rows[Number(context.row.id)]}
  {#if details && row}{@render details(row)}{/if}
{/snippet}
<div
  class="notebook-canvas-table"
  style:height
  data-notebook-canvas-table
 
>
  {#if showFilters}<div class="notebook-canvas-tools">
      <TableFilters
        {fields}
        value={filter}
        onValueChange={(next) => {
          filter = next;
        }}
      /><span aria-live="polite">{matched.length} of {rows.length} rows</span>
    </div>{/if}
  <div class="notebook-canvas-grid">
    <CanvasTable
      rows={canvasRows}
      columns={descriptors}
      columnWidths={widths ?? columns.map(column => localWidths[column.name] ?? 192)} fillWidth
      onColumnWidthsChange={(next) => {
        if (onWidthsChange) onWidthsChange(next);
        else
          localWidths = Object.fromEntries(
            columns.map((c, i) => [c.name, next[i]]),
          );
      }}
      headerRow={false}
      rowNumbers
      {rowHeight}
      columnHeaderHeight={headerHeight}
      toolbar={false}
      contextMenu={false}
      visibleRowIds={displayIds}
      selectionRowIds={scopeIds}
      {rowSelection}
      {selectedRowIds}
      onSelectedRowIdsChange={onSelectedRowIdsChange
        ? (ids) => onSelectedRowIdsChange?.(numbers(ids))
        : undefined}
      {expandedRowIds}
      onExpandedRowIdsChange={onExpandedRowIdsChange
        ? (ids) => onExpandedRowIdsChange?.(numbers(ids))
        : undefined}
      rowDetails={details ? renderDetails : undefined}
      aria-label={label}
    />
  </div>
</div>

<style>
  .notebook-canvas-table {
    display: flex;
    flex-direction: column;
    min-height: 100px;
    min-width: 0;
    width: 100%;
    font-family: var(--font-sans, system-ui);
  }
  .notebook-canvas-tools {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.25rem;
    font-size: 0.75rem;
  }
  .notebook-canvas-grid {
    flex: 1;
    min-height: 0;
  }
  .notebook-canvas-heading {
    border: 0;
    background: transparent;
    color: inherit;
    width: 100%;
    height: 100%;
    text-align: start;
    padding: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font: inherit;
    font-weight: 600;
  }
  .notebook-canvas-value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
