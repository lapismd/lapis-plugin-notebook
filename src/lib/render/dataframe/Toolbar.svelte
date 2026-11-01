<script lang="ts">
  import type { Snippet } from "svelte";
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
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";
  import ColumnVisibility from "./ColumnVisibility.svelte";
  import { Switch } from "@lapismd/design-core/shadcn/switch";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import type {
    Column,
    DataFrameOptions,
    DataFrameSchema,
  } from "./dataframe-types";

  let {
    schema,
    columns,
    state: tableState,
    title = undefined,
    options = {},
    onExport,
    searchInputId,
    filterControl,
  }: {
    filterControl?: Snippet;
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

  let activeFilterCount = $derived(tableState.filters.length);
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
            value={tableState.searchQuery}
            oninput={(event: Event) =>
              tableState.setSearch(
                (event.currentTarget as HTMLInputElement).value,
              )}
          />
        </label>
      {/if}
    </div>

    <Tooltip.Provider>
      <div class="notebook-dataframe__toolbar-actions">
        {#if options.filterable !== false && filterControl}{@render filterControl()}{/if}

        <Popover.Root>
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Popover.Trigger
                  {...props}
                  data-ui-component="button"
                  data-slot="button"
                  data-variant="ghost"
                  data-size="icon-sm"
                  class="notebook-dataframe__toolbar-button"
                  aria-label="Columns"
                >
                  <Columns3 class="notebook-dataframe__toolbar-icon" />
                </Popover.Trigger>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>Columns</Tooltip.Content>
          </Tooltip.Root>
          <Popover.Content
            align="start"
            class="notebook-dataframe__columns-popover"
          >
            <ColumnVisibility
              {columns}
              hiddenColumns={tableState.hiddenCols}
              onToggle={tableState.toggleColumn}
            />
          </Popover.Content>
        </Popover.Root>

        {#if downloadable}
          <Popover.Root>
            <Tooltip.Root>
              <Tooltip.Trigger>
                {#snippet child({ props })}
                  <Popover.Trigger
                    {...props}
                    data-ui-component="button"
                    data-slot="button"
                    data-variant="ghost"
                    data-size="icon-sm"
                    class="notebook-dataframe__toolbar-button"
                    aria-label="Export"
                  >
                    <Download class="notebook-dataframe__toolbar-icon" />
                  </Popover.Trigger>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Content>Export</Tooltip.Content>
            </Tooltip.Root>
            <Popover.Content
              align="start"
              class="notebook-dataframe__export-popover"
            >
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
          <Tooltip.Root>
            <Tooltip.Trigger>
              {#snippet child({ props })}
                <Popover.Trigger
                  {...props}
                  data-ui-component="button"
                  data-slot="button"
                  data-variant="ghost"
                  data-size="icon-sm"
                  class="notebook-dataframe__toolbar-button"
                  aria-label="Settings"
                >
                  <Settings2 class="notebook-dataframe__toolbar-icon" />
                </Popover.Trigger>
              {/snippet}
            </Tooltip.Trigger>
            <Tooltip.Content>Settings</Tooltip.Content>
          </Tooltip.Root>
          <Popover.Content
            align="end"
            class="notebook-dataframe__settings-popover"
          >
            <div class="notebook-dataframe__settings-group">
              <div class="notebook-dataframe__popover-title">Row density</div>
              <ToggleGroup.Root
                type="single"
                variant="outline"
                size="sm"
                aria-label="Row density"
                bind:value={
                  () => tableState.rowHeight,
                  (value) => {
                    if (
                      value === "compact" ||
                      value === "default" ||
                      value === "relaxed"
                    )
                      tableState.setRowHeight(value);
                  }
                }
              >
                <ToggleGroup.Item value="compact">Compact</ToggleGroup.Item>
                <ToggleGroup.Item value="default">Default</ToggleGroup.Item>
                <ToggleGroup.Item value="relaxed">Relaxed</ToggleGroup.Item>
              </ToggleGroup.Root>
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
                aria-label="Numeric sparkbars"
                checked={tableState.sparkbars}
                onclick={() => tableState.setSparkbars(!tableState.sparkbars)}
              />
            </div>
          </Popover.Content>
        </Popover.Root>
      </div>
    </Tooltip.Provider>
  </div>

  {#if schema.queryTimeMs != null}
    <div class="notebook-dataframe__toolbar-meta">{schema.queryTimeMs}ms</div>
  {/if}
</div>
