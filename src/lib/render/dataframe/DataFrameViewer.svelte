<script lang="ts">
  import { untrack } from "svelte";
  import {
    Alert,
    AlertDescription,
    AlertTitle,
  } from "@lapismd/design-core/shadcn/alert";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import ColumnProfilePanel from "./ColumnProfilePanel.svelte";
  import {
    createFilterState,
    filterConditionCount,
  } from "@lapismd/design-core/shadcn/filter-builder";
  import TableFilters from "../table/TableFilters.svelte";
  import NotebookCanvasTable from "../table/NotebookCanvasTable.svelte";
  import ColumnHeader from "./ColumnHeader.svelte";
  import DataCell from "./DataCell.svelte";
  import ExpandedRowDetail from "./ExpandedRowDetail.svelte";
  import {
    filterTableRows,
    inferTableTypes,
    tableFilterFields,
  } from "../table/table-filter-model";
  import { identifyTableRows } from "../table/table-identity";
  import PaginationBar from "./PaginationBar.svelte";

  import Toolbar from "./Toolbar.svelte";
  import { createViewerState } from "./state.svelte";

  import { keyNav } from "./actions/keyNav";
  import { clientSort } from "./utils/sort";
  import { summarizeColumn } from "./dataframe-utils";
  import type {
    Column,
    ColumnSummary,
    DataFrameProps,
    DataFrameRow,
    FilterState,
  } from "./dataframe-types";

  let {
    schema,
    rows,
    title = undefined,
    options = {},
    onSort,
    onFilter,
    onExport,
    onColumnClick,
    pageSize = 100,
    maxHeight = "600px",
    loading = false,
    error = undefined,
  }: DataFrameProps = $props();

  const viewerState = createViewerState(untrack(() => pageSize));
  const searchInputId = `df-search-${Math.random().toString(36).slice(2)}`;

  function searchRows(
    inputRows: DataFrameRow[],
    columns: Column[],
    query: string,
  ): DataFrameRow[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return inputRows;
    }

    return inputRows.filter((row) =>
      columns.some((column) => {
        const value = row[column.name];
        if (value == null) {
          return false;
        }

        if (typeof value === "object") {
          try {
            return JSON.stringify(value).toLowerCase().includes(normalized);
          } catch {
            return String(value).toLowerCase().includes(normalized);
          }
        }

        return String(value).toLowerCase().includes(normalized);
      }),
    );
  }

  let orderedColumns = $derived.by(() => {
    const preferredOrder = viewerState.colOrder.length
      ? viewerState.colOrder
      : schema.columns.map((column) => column.name);
    const columnByName = new Map(
      schema.columns.map((column) => [column.name, column]),
    );
    const ordered = preferredOrder
      .map((name) => columnByName.get(name))
      .filter((column): column is Column => Boolean(column));

    for (const column of schema.columns) {
      if (!ordered.some((entry) => entry.name === column.name)) {
        ordered.push(column);
      }
    }

    return ordered;
  });

  let visibleColumns = $derived(
    orderedColumns.filter((column) => !viewerState.hiddenCols.has(column.name)),
  );
  let searchedRows = $derived(
    searchRows(rows, visibleColumns, viewerState.searchQuery),
  );
  let inferred = $state<ReturnType<typeof inferTableTypes>>([]);
  const schemaKey = $derived(
    schema.columns.map((c) => c.name + ":" + c.type).join("\0"),
  );
  $effect(() => {
    void schemaKey;
    const source = rows;
    untrack(() => {
      inferred = inferTableTypes(source, schema.columns);
      viewerState.setStructured(createFilterState());
      viewerState.clearSelectedRows();
      viewerState.setExpandedRows([]);
    });
  });
  const fields = $derived(
    tableFilterFields(schema.columns, inferred, viewerState.structured),
  );
  const filterCount = $derived(filterConditionCount(viewerState.structured));
  let filteredRows = $derived(
    filterTableRows(searchedRows, viewerState.structured, fields),
  );
  let sortedRows = $derived(clientSort(filteredRows, viewerState.sortColumns));
  const filteredIds = $derived(identifyTableRows(rows, filteredRows));
  const pageIds = $derived(
    identifyTableRows(rows, sortedRows).slice(
      viewerState.page * viewerState.pageSize,
      (viewerState.page + 1) * viewerState.pageSize,
    ),
  );
  let activeProfileColumn = $derived(
    schema.columns.find(
      (column) => column.name === viewerState.activeProfile,
    ) ?? null,
  );
  let summaryByKey = $derived.by<Record<string, ColumnSummary>>(() => {
    const next: Record<string, ColumnSummary> = {};
    for (const column of visibleColumns) {
      next[column.name] = summarizeColumn(sortedRows, {
        key: column.name,
        label: column.label,
        type: column.type,
        displayType: column.displayType,
        nullable: column.nullable,
      });
    }
    return next;
  });

  $effect(() => {
    if (!viewerState.colOrder.length) {
      viewerState.setColumnOrder(schema.columns.map((column) => column.name));
    }
  });

  $effect(() => {
    const maxPage = Math.max(
      0,
      Math.ceil(sortedRows.length / viewerState.pageSize) - 1,
    );
    if (viewerState.page > maxPage) {
      viewerState.setPage(maxPage);
    }
  });

  function handleToggleSort(column: string, multi: boolean) {
    viewerState.toggleSort(column, multi);
    onSort?.(viewerState.sortColumns);
  }

  function handleFilter(filters: typeof viewerState.structured) {
    viewerState.setStructured(filters);
    onFilter?.(filters);
  }

  function openProfile(columnName: string) {
    viewerState.setProfile(columnName);
    const column = schema.columns.find((entry) => entry.name === columnName);
    if (column) {
      onColumnClick?.(column);
    }
  }
</script>

<div class="notebook-dataframe" style:--df-max-height={maxHeight} use:keyNav={{
  focusSearch: () => document.getElementById(searchInputId)?.focus(),
  toggleFilters: () => viewerState.setFilterBarOpen(!viewerState.filterBarOpen),
  clearOverlay: () => { if (viewerState.activeProfile) viewerState.setProfile(null); else if (viewerState.searchQuery) viewerState.setSearch(""); else viewerState.setFilterBarOpen(false); },
}}>
  <div class="notebook-dataframe__live-region" aria-live="polite">
    {viewerState.sortColumns.length} sort(s), {filterCount} filter(s)
  </div>

  <Toolbar
    {schema}
    columns={orderedColumns}
    state={viewerState}
    {title}
    {options}
    {onExport}
    {searchInputId}
  >
    {#snippet filterControl()}<TableFilters
        {fields}
        value={viewerState.structured}
        onValueChange={handleFilter}
        bind:open={() => viewerState.filterBarOpen, (open) => viewerState.setFilterBarOpen(open)}
      />{/snippet}
  </Toolbar>

  {#if schema.truncated}
    <Alert class="notebook-dataframe__alert notebook-dataframe__alert--flush">
      <AlertDescription>
        Results are limited to {schema.rowCount.toLocaleString()} rows. Refine your
        query to see more.
      </AlertDescription>
    </Alert>
  {/if}

  {#if error}
    <Alert variant="destructive" class="notebook-dataframe__alert">
      <AlertTitle>Query Error</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  {:else if !loading && visibleColumns.length === 0}
    <div class="notebook-dataframe__empty">All columns are hidden.</div>
  {:else if !loading && sortedRows.length === 0}
    <div class="notebook-dataframe__empty notebook-dataframe__empty--column">
      <p class="notebook-dataframe__empty-title">No rows</p>
      {#if filterCount > 0}
        <p class="notebook-dataframe__empty-hint">
          No rows match the active filters.
        </p>
        <Button
          variant="link"
          size="sm"
          onclick={() => {
            viewerState.clearFilters();
            handleFilter(viewerState.structured);
          }}
        >
          Clear filters
        </Button>
      {/if}
    </div>
  {:else if loading}
    <div class="notebook-dataframe__loading">
      {#each Array(8) as _}
        <div
          class="notebook-dataframe__loading-row"
          style:grid-template-columns={`repeat(${Math.max(visibleColumns.length, 1)}, minmax(0, 1fr))`}
        >
          {#each Array(Math.max(visibleColumns.length, 1)) as __}
            <div class="notebook-dataframe__loading-cell"></div>
          {/each}
        </div>
      {/each}
    </div>
  {:else}
    <NotebookCanvasTable
      {rows}
      columns={visibleColumns}
      allColumns={schema.columns}
      visibleRowIds={pageIds}
      selectionRowIds={filteredIds}
      showFilters={false}
      height={maxHeight}
      rowHeight={{ compact: 28, default: 36, relaxed: 48 }[
        viewerState.rowHeight
      ]}
      headerHeight={options.showColumnSummaries === false ? 64 : 112}
      widths={visibleColumns.map(
        (c) => viewerState.colWidths.get(c.name) ?? 192,
      )}
      onWidthsChange={(widths) =>
        visibleColumns.forEach((c, i) =>
          viewerState.setColumnWidth(c.name, widths[i]),
        )}
      expandedRowIds={[...viewerState.expandedRows]}
      onExpandedRowIdsChange={(ids) => viewerState.setExpandedRows(ids)}
      rowSelection
      selectedRowIds={[...viewerState.selectedRows]}
      onSelectedRowIdsChange={(ids) => viewerState.setSelectedRows(ids)}
    >
      {#snippet header(column)}
        <ColumnHeader
          {column}
          summary={summaryByKey[column.name]}
          sortState={viewerState.sortColumns.find(
            (sort) => sort.column === column.name,
          )}
          onToggleSort={(multi) => handleToggleSort(column.name, multi)}
          onOpenProfile={() => openProfile(column.name)}
          showSummary={options.showColumnSummaries !== false}
        />
      {/snippet}
      {#snippet cell({ row, column, context })}
        {#if context.column === 0}<button
            type="button"
            class="notebook-dataframe__expand-button"
            aria-label={"Expand row " + context.rowNumber}
            aria-expanded={context.expanded}
            onclick={context.toggleExpanded}
            >{context.expanded ? "▾" : "▸"}</button
          >{/if}
        <DataCell
          value={row[column.name]}
          column={{ key: column.name, ...column }}
          summary={summaryByKey[column.name]}
          sparkbars={viewerState.sparkbars}
        />
      {/snippet}
      {#snippet details(row)}<ExpandedRowDetail
          {row}
          columns={schema.columns}
        />{/snippet}
    </NotebookCanvasTable>
  {/if}

  <PaginationBar rowCount={sortedRows.length} state={viewerState} />

  <ColumnProfilePanel
    column={activeProfileColumn}
    summary={activeProfileColumn
      ? summaryByKey[activeProfileColumn.name]
      : undefined}
    onClose={() => viewerState.setProfile(null)}
  />
</div>
