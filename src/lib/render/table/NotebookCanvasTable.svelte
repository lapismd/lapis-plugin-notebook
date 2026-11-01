<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import {
    CanvasTable,
    type CanvasTableCellContext,
    type CanvasTableRowId,
    type CanvasTableSelection,
  } from "@lapismd/design-core/shadcn/canvas-table";
  import { createFilterState } from "@lapismd/design-core/shadcn/filter-builder";
  import type { Column, DataFrameRow } from "../dataframe/dataframe-types";
  import { clientSort } from "../dataframe/utils/sort";
  import {
    filterTableRows,
    inferTableTypes,
    tableFilterFields,
  } from "./table-filter-model";
  import { identifyTableRows } from "./table-identity";
  import { tableText } from "./table-values";
  import "./notebook-table.css";
  import SortIcon from "../dataframe/SortIcon.svelte";
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { createViewerState } from "../dataframe/state.svelte";
  import TableDisplayControls from "./TableDisplayControls.svelte";
  import TableFilters from "./TableFilters.svelte";
  let {
    rows,
    resultIdentity,
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
    wrapText = $bindable(false),
    columnColours = $bindable(false),
    framed = true,
    label = "Notebook data table",
    height = "320px",
  }: {
    rows: readonly DataFrameRow[];
    resultIdentity?: unknown;
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
    wrapText?: boolean;
    columnColours?: boolean;
    framed?: boolean;
    label?: string;
    height?: string;
  } = $props();
  let root: HTMLDivElement;
  const instanceId = $props.id();
  const generation = $derived(
    resultIdentity === undefined ? rows : resultIdentity,
  );
  let previousGeneration = untrack(() => generation);
  $effect.pre(() => {
    if (
      generation !== previousGeneration &&
      root?.contains(root.ownerDocument.activeElement)
    )
      root
        .querySelector<HTMLButtonElement>(
          "[data-notebook-table-filter-trigger]",
        )
        ?.focus();
    previousGeneration = generation;
  });
  let filter = $state(createFilterState());
  const viewState = createViewerState();
  const sort = $derived(viewState.sortColumns);
  let localWidths = $state<Record<string, number>>({});
  const schemaKey = $derived(
    allColumns.map((c) => c.name + ":" + c.type).join("\0"),
  );
  let inferred = $state<ReturnType<typeof inferTableTypes>>([]);
  $effect(() => {
    void schemaKey;
    void generation;
    untrack(() => {
      inferred = inferTableTypes(rows, allColumns);
      filter = createFilterState();
      viewState.clearSort();
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
  function numbers(ids: CanvasTableRowId[]) {
    return ids.filter((id): id is number => typeof id === "number");
  }
</script>

{#snippet renderHeader(context: { column: number })}
  {@const column = columns[context.column]}
  {#if column}
    {#if header}{@render header(column)}{:else}
      {@const currentSort = sort.find((entry) => entry.column === column.name)}
      <button
        type="button"
        class="notebook-canvas-heading"
        onclick={(event) => viewState.toggleSort(column.name, event.shiftKey)}
        data-sort-direction={currentSort?.direction ?? "none"}
        aria-label={"Sort " +
          (column.label ?? column.name) +
          (currentSort && currentSort.priority > 1
            ? " " + currentSort.priority
            : "")}
        aria-describedby={instanceId + "-sort-" + context.column}
      >
        <span>{column.label ?? column.name}</span>
        <span class="notebook-canvas-sort-indicator"
          ><SortIcon direction={currentSort?.direction} />
          {#if currentSort && currentSort.priority > 1}<Badge
              variant="outline"
              class="notebook-dataframe__column-badge"
              >{currentSort.priority}</Badge
            >{/if}
        </span>
      </button>
      <span
        id={instanceId + "-sort-" + context.column}
        class="notebook-canvas-sort-status"
        >{currentSort
          ? `${currentSort.direction === "asc" ? "Ascending" : "Descending"}, sort priority ${currentSort.priority}.`
          : "Unsorted."} Shift-click to sort by multiple columns.</span
      >
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
  bind:this={root}
  class="notebook-canvas-table"
  data-framed={framed}
  style:--notebook-table-white-space={wrapText ? "pre-wrap" : "nowrap"}
  style:height
  data-notebook-canvas-table
>
  {#if showFilters}<div class="notebook-canvas-tools">
      <div class="notebook-canvas-tool-actions">
        <TableFilters
          {fields}
          value={filter}
          onValueChange={(next) => {
            filter = next;
          }}
        />
        <TableDisplayControls
          {wrapText}
          {columnColours}
          onWrapTextChange={(value) => (wrapText = value)}
          onColumnColoursChange={(value) => (columnColours = value)}
        />
      </div>
      <span aria-live="polite">{matched.length} of {rows.length} rows</span>
    </div>{/if}
  <div class="notebook-canvas-grid">
    {#key generation}<CanvasTable
        rows={canvasRows}
        columns={descriptors}
        columnWidths={widths ??
          columns.map((column) => localWidths[column.name] ?? 192)}
        fillWidth
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
        {wrapText}
        {columnColours}
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
      />{/key}
  </div>
</div>
