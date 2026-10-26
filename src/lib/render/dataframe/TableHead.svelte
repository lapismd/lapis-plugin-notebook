<script lang="ts">
  import ColumnHeader from "./ColumnHeader.svelte";
  import type { Column, ColumnSummary, SortState } from "./dataframe-types";

  let {
    columns,
    summaryByKey,
    activeFilterColumns = [],
    sorts,
    gridTemplate,
    onToggleSort,
    onOpenProfile,
    showSummaries = true,
  }: {
    columns: Column[];
    summaryByKey: Record<string, ColumnSummary>;
    // The legacy port derived this from summary presence, which mislabelled
    // every summarized column as filtered; real filter state is threaded now.
    activeFilterColumns?: string[];
    sorts: SortState[];
    gridTemplate: string;
    onToggleSort: (column: string, multi: boolean) => void;
    onOpenProfile: (column: string) => void;
    showSummaries?: boolean;
  } = $props();

  function sortFor(name: string): SortState | undefined {
    return sorts.find((sort) => sort.column === name);
  }
</script>

<div class="notebook-dataframe__head">
  <div
    role="row"
    class="notebook-dataframe__head-row"
    style:grid-template-columns={gridTemplate}
  >
    {#each columns as column}
      <div
        role="columnheader"
        aria-sort={sortFor(column.name)?.direction === "asc"
          ? "ascending"
          : sortFor(column.name)?.direction === "desc"
            ? "descending"
            : "none"}
        class="notebook-dataframe__head-cell"
      >
        <ColumnHeader
          {column}
          summary={summaryByKey[column.name]}
          sortState={sortFor(column.name)}
          filterActive={activeFilterColumns.includes(column.name)}
          onToggleSort={(multi) => onToggleSort(column.name, multi)}
          onOpenProfile={() => onOpenProfile(column.name)}
          showSummary={showSummaries}
        />
      </div>
    {/each}
  </div>
</div>
