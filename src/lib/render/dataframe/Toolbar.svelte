<script lang="ts">
  import Columns3 from "@lucide/svelte/icons/columns-3";
  import Download from "@lucide/svelte/icons/download";
  import Funnel from "@lucide/svelte/icons/funnel";
  import SearchIcon from "@lucide/svelte/icons/search";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Popover from "@lapismd/design-core/shadcn/popover";
  import { Separator } from "@lapismd/design-core/shadcn/separator";
  import { Switch } from "@lapismd/design-core/shadcn/switch";
  import type {
    Column,
    DataFrameOptions,
    DataFrameSchema,
  } from "./dataframe-types";

  let {
    schema,
    columns,
    state,
    title = undefined,
    options = {},
    onExport,
    searchInputId,
  }: {
    schema: DataFrameSchema;
    columns: Column[];
    state: {
      filters: unknown[];
      hiddenCols: Set<string>;
      filterBarOpen: boolean;
      searchQuery: string;
      rowHeight: "compact" | "default" | "relaxed";
      sparkbars: boolean;
      setSearch: (value: string) => void;
      setFilterBarOpen: (open: boolean) => void;
      toggleColumn: (column: string) => void;
      setRowHeight: (height: "compact" | "default" | "relaxed") => void;
      setSparkbars: (enabled: boolean) => void;
    };
    title?: string;
    options?: DataFrameOptions;
    onExport?: (format: "csv" | "json" | "parquet") => void;
    searchInputId: string;
  } = $props();

  let activeFilterCount = $derived(state.filters.length);
  let searchable = $derived(options.searchable !== false);
  let downloadable = $derived(
    options.downloadable !== false && onExport != null,
  );

</script>

<div class="notebook-dataframe__toolbar">
  <div class="notebook-dataframe__toolbar-row">
    <div class="notebook-dataframe__toolbar-primary">
      {#if title}
        <Badge variant="outline" class="notebook-dataframe__toolbar-title"
          >{title}</Badge
        >
      {/if}

      {#if searchable}
        <label class="notebook-dataframe__search">
          <SearchIcon class="notebook-dataframe__search-icon" />
          <Input
            id={searchInputId}
            class="notebook-dataframe__search-input"
            placeholder="Search rows"
            value={state.searchQuery}
            oninput={(event: Event) =>
              state.setSearch((event.currentTarget as HTMLInputElement).value)}
          />
        </label>
      {/if}
    </div>

    <div class="notebook-dataframe__toolbar-actions">
      <Button
        variant={activeFilterCount > 0 ? "secondary" : "ghost"}
        size="sm"
        class="notebook-dataframe__toolbar-button"
        onclick={() => state.setFilterBarOpen(!state.filterBarOpen)}
      >
        <Funnel class="notebook-dataframe__toolbar-icon" />
        Filters
        {#if activeFilterCount > 0}
          <Badge class="notebook-dataframe__toolbar-count"
            >{activeFilterCount}</Badge
          >
        {/if}
      </Button>

      <Popover.Root>
        <Popover.Trigger
          data-ui-component="button"
          data-slot="button"
          data-variant="ghost"
          data-size="sm"
          class="notebook-dataframe__toolbar-button"
        >
          <Columns3 class="notebook-dataframe__toolbar-icon" />
          Columns
        </Popover.Trigger>
        <Popover.Content
          align="start"
          class="notebook-dataframe__columns-popover"
        >
          <div class="notebook-dataframe__popover-title">Visible columns</div>
          <div class="notebook-dataframe__column-list">
            {#each columns as column}
              <button
                type="button"
                class="notebook-dataframe__column-toggle"
                onclick={() => state.toggleColumn(column.name)}
              >
                <span class="notebook-dataframe__column-toggle-label"
                  >{column.label ?? column.name}</span
                >
                <span class="notebook-dataframe__column-toggle-state"
                  >{state.hiddenCols.has(column.name) ? "Hidden" : "Shown"}</span
                >
              </button>
            {/each}
          </div>
        </Popover.Content>
      </Popover.Root>

      {#if downloadable}
        <Popover.Root>
          <Popover.Trigger
          data-ui-component="button"
          data-slot="button"
          data-variant="ghost"
          data-size="sm"
          class="notebook-dataframe__toolbar-button"
        >
            <Download class="notebook-dataframe__toolbar-icon" />
            Export
          </Popover.Trigger>
          <Popover.Content align="start" class="notebook-dataframe__export-popover">
            <div class="notebook-dataframe__column-list">
              <Button
                variant="ghost"
                size="sm"
                class="notebook-dataframe__export-item"
                onclick={() => onExport?.("csv")}>CSV</Button
              >
              <Button
                variant="ghost"
                size="sm"
                class="notebook-dataframe__export-item"
                onclick={() => onExport?.("json")}>JSON</Button
              >
              <Button
                variant="ghost"
                size="sm"
                class="notebook-dataframe__export-item"
                disabled>Parquet</Button
              >
            </div>
          </Popover.Content>
        </Popover.Root>
      {/if}

      <Popover.Root>
        <Popover.Trigger
          data-ui-component="button"
          data-slot="button"
          data-variant="ghost"
          data-size="sm"
          class="notebook-dataframe__toolbar-button"
        >
          <Settings2 class="notebook-dataframe__toolbar-icon" />
          Settings
        </Popover.Trigger>
        <Popover.Content align="end" class="notebook-dataframe__settings-popover">
          <div class="notebook-dataframe__settings-group">
            <div class="notebook-dataframe__popover-title">Row density</div>
            <div class="notebook-dataframe__density-group">
              <Button
                variant={state.rowHeight === "compact"
                  ? "secondary"
                  : "outline"}
                size="sm"
                onclick={() => state.setRowHeight("compact")}>Compact</Button
              >
              <Button
                variant={state.rowHeight === "default"
                  ? "secondary"
                  : "outline"}
                size="sm"
                onclick={() => state.setRowHeight("default")}>Default</Button
              >
              <Button
                variant={state.rowHeight === "relaxed"
                  ? "secondary"
                  : "outline"}
                size="sm"
                onclick={() => state.setRowHeight("relaxed")}>Relaxed</Button
              >
            </div>
          </div>

          <Separator />

          <div class="notebook-dataframe__sparkbar-row">
            <div>
              <div class="notebook-dataframe__settings-label">
                Numeric sparkbars
              </div>
              <div class="notebook-dataframe__settings-desc">
                Show relative bars in numeric cells.
              </div>
            </div>
            <Switch
              checked={state.sparkbars}
              onclick={() => state.setSparkbars(!state.sparkbars)}
            />
          </div>
        </Popover.Content>
      </Popover.Root>
    </div>
  </div>

  <div class="notebook-dataframe__toolbar-meta">
    {schema.rowCount.toLocaleString()} rows
    {#if schema.queryTimeMs != null}
      · {schema.queryTimeMs}ms
    {/if}
  </div>
</div>
