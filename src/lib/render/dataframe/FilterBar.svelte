<script lang="ts">
  import { slide } from "svelte/transition";
  import { SvelteMap } from "svelte/reactivity";
  import { Funnel, RotateCcw, X } from "@lucide/svelte";
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Select from "@lapismd/design-core/shadcn/select";
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
  const TEXT_OPERATORS = [
    { value: "contains", label: "Contains" },
    { value: "starts_with", label: "Starts with" },
    { value: "ends_with", label: "Ends with" },
    { value: "equals", label: "Equals" },
    { value: "regex", label: "Regex" },
    { value: "is_null", label: "Is null" },
    { value: "is_not_null", label: "Is not null" },
  ] as const;
  const BOOLEAN_VALUES = [
    { value: "all", label: "Any value" },
    { value: "true", label: "True" },
    { value: "false", label: "False" },
  ];

  let {
    columns,
    state: filterState,
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

  // An operator can be chosen before a value without creating an active filter.
  const operators = new SvelteMap<string, FilterState["operator"]>();

  function currentFilter(column: string) {
    return filterState.filters.find((filter) => filter.column === column);
  }

  function syncFilters() {
    onFilter?.(filterState.filters);
  }

  function clearFilter(column: string) {
    operators.delete(column);
    filterState.removeFilter(column);
    syncFilters();
  }

  function updateTextFilter(
    column: string,
    operator: FilterState["operator"],
    value: string,
  ) {
    operators.set(column, operator);
    if (operator === "is_null" || operator === "is_not_null") {
      filterState.addFilter({ column, operator });
    } else if (value) {
      filterState.addFilter({ column, operator, value });
    } else {
      filterState.removeFilter(column);
    }
    syncFilters();
  }

  function updateRangeFilter(
    column: string,
    value: string | undefined,
    valueTo: string | undefined,
  ) {
    if (!value && !valueTo) {
      filterState.removeFilter(column);
    } else {
      filterState.addFilter({
        column,
        operator: value && valueTo ? "between" : value ? "gte" : "lte",
        value: value ?? valueTo,
        valueTo,
      });
    }
    syncFilters();
  }

  function updateBooleanFilter(column: string, value: string) {
    if (value === "all") filterState.removeFilter(column);
    else
      filterState.addFilter({
        column,
        operator: "equals",
        value: value === "true",
      });
    syncFilters();
  }
</script>

{#if options.filterable !== false}
  <section
    transition:slide
    class="notebook-dataframe__filters"
    aria-label="Column filters"
  >
    <div class="notebook-dataframe__filters-header">
      <div class="notebook-dataframe__filters-heading">
        <Funnel class="notebook-dataframe__filters-icon" aria-hidden="true" />
        <span class="notebook-dataframe__filters-title">Column filters</span>
        {#if filterState.filters.length}
          <Badge variant="secondary">{filterState.filters.length} active</Badge>
        {/if}
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled={!filterState.filters.length && !operators.size}
        onclick={() => {
          operators.clear();
          filterState.clearFilters();
          syncFilters();
        }}
      >
        <RotateCcw data-icon="inline-start" aria-hidden="true" />
        Clear filters
      </Button>
    </div>

    <Field.Group class="notebook-dataframe__filters-grid">
      {#each columns as column (column.name)}
        {@const filter = currentFilter(column.name)}
        {@const operator =
          filter?.operator ?? operators.get(column.name) ?? "contains"}
        {@const label = column.label ?? column.name}
        {@const range =
          NUMERIC_TYPES.has(column.type) ||
          column.type === "date" ||
          column.type === "timestamp"}
        {@const minimum =
          filter?.operator === "between" || filter?.operator === "gte"
            ? String(filter.value ?? "")
            : ""}
        {@const maximum =
          filter?.operator === "between"
            ? String(filter.valueTo ?? "")
            : filter?.operator === "lte"
              ? String(filter.value ?? "")
              : ""}
        <Field.Field
          class="notebook-dataframe__filter"
          aria-label={`${label} column filter`}
          data-active={Boolean(filter)}
        >
          <Field.Title class="notebook-dataframe__filter-title"
            >{label}</Field.Title
          >
          {#if range}
            <div class="notebook-dataframe__filter-range">
              <Input
                type={NUMERIC_TYPES.has(column.type) ? "number" : "date"}
                aria-label={`${label} minimum`}
                placeholder="Minimum"
                value={minimum}
                oninput={(event) =>
                  updateRangeFilter(
                    column.name,
                    event.currentTarget.value || undefined,
                    maximum || undefined,
                  )}
              />
              <span
                class="notebook-dataframe__filter-range-separator"
                aria-hidden="true">–</span
              >
              <Input
                type={NUMERIC_TYPES.has(column.type) ? "number" : "date"}
                aria-label={`${label} maximum`}
                placeholder="Maximum"
                value={maximum}
                oninput={(event) =>
                  updateRangeFilter(
                    column.name,
                    minimum || undefined,
                    event.currentTarget.value || undefined,
                  )}
              />
            </div>
          {:else if column.type === "boolean"}
            <div class="notebook-dataframe__filter-boolean">
              <Select.Root
                type="single"
                value={filter ? String(filter.value) : "all"}
                onValueChange={(value) =>
                  updateBooleanFilter(column.name, value)}
              >
                <Select.Trigger
                  class="notebook-dataframe__filter-select"
                  aria-label={`${label} filter value`}
                >
                  {BOOLEAN_VALUES.find(
                    (item) =>
                      item.value === (filter ? String(filter.value) : "all"),
                  )?.label}
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each BOOLEAN_VALUES as item}
                      <Select.Item value={item.value} label={item.label}
                        >{item.label}</Select.Item
                      >
                    {/each}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </div>
          {:else}
            <div class="notebook-dataframe__filter-text">
              <Select.Root
                type="single"
                value={operator}
                onValueChange={(value) =>
                  updateTextFilter(
                    column.name,
                    value as FilterState["operator"],
                    String(filter?.value ?? ""),
                  )}
              >
                <Select.Trigger
                  class="notebook-dataframe__filter-select"
                  aria-label={`${label} filter operator`}
                >
                  {TEXT_OPERATORS.find((item) => item.value === operator)
                    ?.label}
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each TEXT_OPERATORS as item}
                      <Select.Item value={item.value} label={item.label}
                        >{item.label}</Select.Item
                      >
                    {/each}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
              <Input
                aria-label={`${label} filter value`}
                placeholder={operator === "is_null" ||
                operator === "is_not_null"
                  ? "No value needed"
                  : "Filter value…"}
                disabled={operator === "is_null" || operator === "is_not_null"}
                value={String(filter?.value ?? "")}
                oninput={(event) =>
                  updateTextFilter(
                    column.name,
                    operator,
                    event.currentTarget.value,
                  )}
              />
            </div>
          {/if}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Clear ${label} filter`}
            title={`Clear ${label} filter`}
            disabled={!filter && !operators.has(column.name)}
            onclick={() => clearFilter(column.name)}
          >
            <X aria-hidden="true" />
          </Button>
        </Field.Field>
      {/each}
    </Field.Group>
  </section>
{/if}
