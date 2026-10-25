<script lang="ts">
  import { slide } from "svelte/transition";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import type {
    Column,
    DataFrameOptions,
    FilterState,
  } from "./dataframe-types";

  const NUMERIC_TYPES = new Set([
    "integer",
    "bigint",
    "float",
    "double",
    "decimal",
    "number",
  ]);

  let {
    columns,
    state,
    options = {},
    onFilter,
  }: {
    columns: Column[];
    state: {
      filters: FilterState[];
      clearFilters: () => void;
      addFilter: (filter: FilterState) => void;
      removeFilter: (column: string) => void;
    };
    options?: DataFrameOptions;
    onFilter?: (filters: FilterState[]) => void;
  } = $props();

  function currentFilter(column: string): FilterState | undefined {
    return state.filters.find((filter) => filter.column === column);
  }

  function syncFilters() {
    onFilter?.(state.filters);
  }

  function updateTextFilter(
    column: string,
    operator: FilterState["operator"],
    value: string,
  ) {
    if (!value) {
      state.removeFilter(column);
      syncFilters();
      return;
    }

    state.addFilter({ column, operator, value });
    syncFilters();
  }

  function updateRangeFilter(
    column: string,
    value: string | undefined,
    valueTo: string | undefined,
  ) {
    if (!value && !valueTo) {
      state.removeFilter(column);
      syncFilters();
      return;
    }

    state.addFilter({
      column,
      operator: value && valueTo ? "between" : value ? "gte" : "lte",
      value,
      valueTo,
    });
    syncFilters();
  }

  function updateBooleanFilter(column: string, value: string) {
    if (value === "all") {
      state.removeFilter(column);
      syncFilters();
      return;
    }

    state.addFilter({ column, operator: "equals", value: value === "true" });
    syncFilters();
  }
</script>

{#if options.filterable !== false}
  <div
    transition:slide
    class="notebook-dataframe__filters"
  >
    <div
      class="notebook-dataframe__filters-header"
    >
      <div
        class="notebook-dataframe__filters-title"
      >
        Column filters
      </div>
      <Button
        variant="ghost"
        size="sm"
        onclick={() => {
          state.clearFilters();
          syncFilters();
        }}>Clear filters</Button
      >
    </div>

    <div
      class="notebook-dataframe__filters-grid"
    >
      {#each columns as column}
        {@const filter = currentFilter(column.name)}
        <div
          class="notebook-dataframe__filter"
        >
          <div
            class="notebook-dataframe__filter-title"
          >
            {column.label ?? column.name}
          </div>

          {#if NUMERIC_TYPES.has(column.type)}
            <div class="notebook-dataframe__filter-range">
              <Input
                type="number"
                placeholder="Min"
                value={filter?.operator === "between" ||
                filter?.operator === "gte"
                  ? String(filter.value ?? "")
                  : ""}
                oninput={(event: Event) =>
                  updateRangeFilter(
                    column.name,
                    (event.currentTarget as HTMLInputElement).value ||
                      undefined,
                    filter?.operator === "between"
                      ? String(filter.valueTo ?? "")
                      : undefined,
                  )}
              />
              <Input
                type="number"
                placeholder="Max"
                value={filter?.operator === "between" ||
                filter?.operator === "lte"
                  ? String(
                      filter.operator === "between"
                        ? (filter.valueTo ?? "")
                        : (filter.value ?? ""),
                    )
                  : ""}
                oninput={(event: Event) =>
                  updateRangeFilter(
                    column.name,
                    filter?.operator === "between" || filter?.operator === "gte"
                      ? String(filter.value ?? "")
                      : undefined,
                    (event.currentTarget as HTMLInputElement).value ||
                      undefined,
                  )}
              />
            </div>
          {:else if column.type === "boolean"}
            <div class="notebook-dataframe__filter-boolean">
              <Button
                variant={!filter ? "secondary" : "outline"}
                size="sm"
                onclick={() => updateBooleanFilter(column.name, "all")}
                >All</Button
              >
              <Button
                variant={filter?.value === true ? "secondary" : "outline"}
                size="sm"
                onclick={() => updateBooleanFilter(column.name, "true")}
                >True</Button
              >
              <Button
                variant={filter?.value === false ? "secondary" : "outline"}
                size="sm"
                onclick={() => updateBooleanFilter(column.name, "false")}
                >False</Button
              >
            </div>
          {:else if column.type === "date" || column.type === "timestamp"}
            <div class="notebook-dataframe__filter-range">
              <Input
                type="date"
                value={filter?.operator === "between" ||
                filter?.operator === "gte"
                  ? String(filter.value ?? "")
                  : ""}
                oninput={(event: Event) =>
                  updateRangeFilter(
                    column.name,
                    (event.currentTarget as HTMLInputElement).value ||
                      undefined,
                    filter?.operator === "between"
                      ? String(filter.valueTo ?? "")
                      : undefined,
                  )}
              />
              <Input
                type="date"
                value={filter?.operator === "between" ||
                filter?.operator === "lte"
                  ? String(
                      filter.operator === "between"
                        ? (filter.valueTo ?? "")
                        : (filter.value ?? ""),
                    )
                  : ""}
                oninput={(event: Event) =>
                  updateRangeFilter(
                    column.name,
                    filter?.operator === "between" || filter?.operator === "gte"
                      ? String(filter.value ?? "")
                      : undefined,
                    (event.currentTarget as HTMLInputElement).value ||
                      undefined,
                  )}
              />
            </div>
          {:else}
            <div class="notebook-dataframe__filter-text">
              <select
                class="notebook-dataframe__filter-select"
                value={filter?.operator ?? "contains"}
                onchange={(event: Event) =>
                  updateTextFilter(
                    column.name,
                    (event.currentTarget as HTMLSelectElement)
                      .value as FilterState["operator"],
                    String(filter?.value ?? ""),
                  )}
              >
                <option value="contains">Contains</option>
                <option value="starts_with">Starts with</option>
                <option value="ends_with">Ends with</option>
                <option value="equals">Equals</option>
                <option value="regex">Regex</option>
                <option value="is_null">Is null</option>
                <option value="is_not_null">Is not null</option>
              </select>
              <Input
                placeholder="Filter value"
                value={String(filter?.value ?? "")}
                oninput={(event: Event) =>
                  updateTextFilter(
                    column.name,
                    filter?.operator ?? "contains",
                    (event.currentTarget as HTMLInputElement).value,
                  )}
              />
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}
