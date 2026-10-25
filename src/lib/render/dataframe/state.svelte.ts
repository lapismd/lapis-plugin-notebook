import type { FilterState, SortDirection, SortState } from "./dataframe-types";

function nextSortDirection(
  direction: SortDirection | undefined,
): SortDirection | undefined {
  if (direction == null) {
    return "asc";
  }
  if (direction === "asc") {
    return "desc";
  }
  return undefined;
}

function withUpdatedPriorities(sorts: SortState[]): SortState[] {
  return sorts.map((sort, index) => ({
    ...sort,
    priority: index + 1,
  }));
}

export function createViewerState(initialPageSize = 100) {
  let sortColumns = $state<SortState[]>([]);
  let filters = $state<FilterState[]>([]);
  let hiddenCols = $state<Set<string>>(new Set());
  let colWidths = $state<Map<string, number>>(new Map());
  let colOrder = $state<string[]>([]);
  let expandedRows = $state<Set<number>>(new Set());
  let selectedRows = $state<Set<number>>(new Set());
  let activeProfile = $state<string | null>(null);
  let filterBarOpen = $state(false);
  let searchQuery = $state("");
  let rowHeight = $state<"compact" | "default" | "relaxed">("default");
  let sparkbars = $state(false);
  let page = $state(0);
  let pageSize = $state(initialPageSize);

  return {
    get sortColumns() {
      return sortColumns;
    },
    get filters() {
      return filters;
    },
    get hiddenCols() {
      return hiddenCols;
    },
    get colWidths() {
      return colWidths;
    },
    get colOrder() {
      return colOrder;
    },
    get expandedRows() {
      return expandedRows;
    },
    get selectedRows() {
      return selectedRows;
    },
    get activeProfile() {
      return activeProfile;
    },
    get filterBarOpen() {
      return filterBarOpen;
    },
    get searchQuery() {
      return searchQuery;
    },
    get rowHeight() {
      return rowHeight;
    },
    get sparkbars() {
      return sparkbars;
    },
    get page() {
      return page;
    },
    get pageSize() {
      return pageSize;
    },

    toggleSort(column: string, multi: boolean) {
      const existing = sortColumns.find((sort) => sort.column === column);
      const nextDirection = nextSortDirection(existing?.direction);

      if (!multi) {
        sortColumns = nextDirection
          ? [{ column, direction: nextDirection, priority: 1 }]
          : [];
        return;
      }

      const nextSorts = sortColumns.filter((sort) => sort.column !== column);
      if (nextDirection) {
        nextSorts.push({
          column,
          direction: nextDirection,
          priority: nextSorts.length + 1,
        });
      }

      sortColumns = withUpdatedPriorities(nextSorts);
    },

    clearSort() {
      sortColumns = [];
    },

    addFilter(filter: FilterState) {
      filters = [
        ...filters.filter((entry) => entry.column !== filter.column),
        filter,
      ];
      page = 0;
    },

    removeFilter(column: string) {
      filters = filters.filter((filter) => filter.column !== column);
      page = 0;
    },

    clearFilters() {
      filters = [];
      page = 0;
    },

    toggleColumn(column: string) {
      const next = new Set(hiddenCols);
      if (next.has(column)) {
        next.delete(column);
      } else {
        next.add(column);
      }
      hiddenCols = next;
    },

    setColumnWidth(column: string, width: number) {
      const next = new Map(colWidths);
      next.set(column, width);
      colWidths = next;
    },

    setColumnOrder(order: string[]) {
      colOrder = [...order];
    },

    toggleRow(index: number) {
      const next = new Set(expandedRows);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      expandedRows = next;
    },

    toggleSelectedRow(index: number) {
      const next = new Set(selectedRows);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      selectedRows = next;
    },

    setSelectedRows(rows: Iterable<number>) {
      selectedRows = new Set(rows);
    },

    clearSelectedRows() {
      selectedRows = new Set();
    },

    setProfile(column: string | null) {
      activeProfile = column;
    },

    setFilterBarOpen(open: boolean) {
      filterBarOpen = open;
    },

    setSearch(query: string) {
      searchQuery = query;
      page = 0;
    },

    setRowHeight(nextHeight: "compact" | "default" | "relaxed") {
      rowHeight = nextHeight;
    },

    setSparkbars(enabled: boolean) {
      sparkbars = enabled;
    },

    setPage(nextPage: number) {
      page = Math.max(0, nextPage);
    },

    nextPage() {
      page += 1;
    },

    prevPage() {
      if (page > 0) {
        page -= 1;
      }
    },

    setPageSize(nextPageSize: number) {
      pageSize = nextPageSize;
      page = 0;
    },
  };
}
