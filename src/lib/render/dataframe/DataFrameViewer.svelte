<script lang="ts">
  import { untrack } from "svelte";
  import {
    Alert,
    AlertDescription,
    AlertTitle,
  } from "@lapismd/design-core/shadcn/alert";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import ColumnProfilePanel from "./ColumnProfilePanel.svelte";
  import FilterBar from "./FilterBar.svelte";
  import PaginationBar from "./PaginationBar.svelte";
  import TableContainer from "./TableContainer.svelte";
  import Toolbar from "./Toolbar.svelte";
  import { createViewerState } from "./state.svelte";
  import { clientFilter } from "./utils/filter";
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

  const state = createViewerState(untrack(() => pageSize));
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
    const preferredOrder = state.colOrder.length
      ? state.colOrder
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
    orderedColumns.filter((column) => !state.hiddenCols.has(column.name)),
  );
  let searchedRows = $derived(
    searchRows(rows, visibleColumns, state.searchQuery),
  );
  let filteredRows = $derived(clientFilter(searchedRows, state.filters));
  let sortedRows = $derived(clientSort(filteredRows, state.sortColumns));
  let pageRows = $derived(
    sortedRows.slice(
      state.page * state.pageSize,
      (state.page + 1) * state.pageSize,
    ),
  );
  let activeProfileColumn = $derived(
    schema.columns.find((column) => column.name === state.activeProfile) ??
      null,
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
    if (!state.colOrder.length) {
      state.setColumnOrder(schema.columns.map((column) => column.name));
    }
  });

  $effect(() => {
    const maxPage = Math.max(
      0,
      Math.ceil(sortedRows.length / state.pageSize) - 1,
    );
    if (state.page > maxPage) {
      state.setPage(maxPage);
    }
  });

  function handleToggleSort(column: string, multi: boolean) {
    state.toggleSort(column, multi);
    onSort?.(state.sortColumns);
  }

  function handleFilter(filters: FilterState[]) {
    onFilter?.(filters);
  }

  function openProfile(columnName: string) {
    state.setProfile(columnName);
    const column = schema.columns.find((entry) => entry.name === columnName);
    if (column) {
      onColumnClick?.(column);
    }
  }
</script>

<div
  class="notebook-dataframe"
  style:--df-max-height={maxHeight}
>
  <div class="notebook-dataframe__live-region" aria-live="polite">
    {state.sortColumns.length} sort(s), {state.filters.length} filter(s)
  </div>

  <Toolbar
    {schema}
    columns={orderedColumns}
    {state}
    {title}
    {options}
    {onExport}
    {searchInputId}
  />

  {#if schema.truncated}
    <Alert class="notebook-dataframe__alert notebook-dataframe__alert--flush">
      <AlertDescription>
        Results are limited to {schema.rowCount.toLocaleString()} rows. Refine your
        query to see more.
      </AlertDescription>
    </Alert>
  {/if}

  {#if state.filterBarOpen}
    <FilterBar
      columns={visibleColumns}
      {state}
      {options}
      onFilter={handleFilter}
    />
  {/if}

  {#if error}
    <Alert variant="destructive" class="notebook-dataframe__alert">
      <AlertTitle>Query Error</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  {:else if !loading && visibleColumns.length === 0}
    <div
      class="notebook-dataframe__empty"
    >
      All columns are hidden.
    </div>
  {:else if !loading && sortedRows.length === 0}
    <div
      class="notebook-dataframe__empty notebook-dataframe__empty--column"
    >
      <p class="notebook-dataframe__empty-title">No rows</p>
      {#if state.filters.length > 0}
        <p class="notebook-dataframe__empty-hint">No rows match the active filters.</p>
        <Button
          variant="link"
          size="sm"
          onclick={() => {
            state.clearFilters();
            handleFilter(state.filters);
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
    <TableContainer
      {schema}
      columns={visibleColumns}
      rows={pageRows}
      {state}
      {summaryByKey}
      {options}
      onToggleSort={handleToggleSort}
      onOpenProfile={openProfile}
      {searchInputId}
    />
  {/if}

  <PaginationBar rowCount={sortedRows.length} {state} />

  <ColumnProfilePanel
    column={activeProfileColumn}
    summary={activeProfileColumn
      ? summaryByKey[activeProfileColumn.name]
      : undefined}
    onClose={() => state.setProfile(null)}
  />
</div>
