<script lang="ts">
  import Columns3 from "@lucide/svelte/icons/columns-3";
  import Download from "@lucide/svelte/icons/download";
  import Funnel from "@lucide/svelte/icons/funnel";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import SearchIcon from "@lucide/svelte/icons/search";
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import * as ButtonGroup from "@lapismd/design-core/shadcn/button-group";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Popover from "@lapismd/design-core/shadcn/popover";
  import { Separator } from "@lapismd/design-core/shadcn/separator";
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

  let activeFilterCount = $derived(tableState.filters.length);
  let searchable = $derived(options.searchable !== false);
  let downloadable = $derived(
    options.downloadable !== false && onExport != null,
  );
  let densityMenuOpen = $state(false);

  const DENSITY_LABELS: Record<"compact" | "default" | "relaxed", string> = {
    compact: "Compact",
    default: "Default",
    relaxed: "Relaxed",
  };
  let densityLabel = $derived(DENSITY_LABELS[tableState.rowHeight]);
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
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <button
                {...props}
                type="button"
                data-ui-component="button"
                data-slot="button"
                data-variant={activeFilterCount > 0 ? "secondary" : "ghost"}
                data-size="icon-sm"
                class="notebook-dataframe__toolbar-button"
                aria-label={activeFilterCount > 0
                  ? `Filters (${activeFilterCount} active)`
                  : "Filters"}
                onclick={() => tableState.setFilterBarOpen(!tableState.filterBarOpen)}
              >
                <Funnel class="notebook-dataframe__toolbar-icon" />
                {#if activeFilterCount > 0}
                  <Badge class="notebook-dataframe__toolbar-count"
                    >{activeFilterCount}</Badge
                  >
                {/if}
              </button>
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content>Filters</Tooltip.Content>
        </Tooltip.Root>

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
            <div class="notebook-dataframe__popover-title">Visible columns</div>
            <div class="notebook-dataframe__column-list">
              {#each columns as column}
                <button
                  type="button"
                  class="notebook-dataframe__column-toggle"
                  onclick={() => tableState.toggleColumn(column.name)}
                >
                  <span class="notebook-dataframe__column-toggle-label"
                    >{column.label ?? column.name}</span
                  >
                  <span class="notebook-dataframe__column-toggle-state"
                    >{tableState.hiddenCols.has(column.name)
                      ? "Hidden"
                      : "Shown"}</span
                  >
                </button>
              {/each}
            </div>
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
              <ButtonGroup.Root>
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => (densityMenuOpen = true)}
                >
                  {densityLabel}
                </Button>
                <ButtonGroup.Separator />
                <DropdownMenu.Root bind:open={densityMenuOpen}>
                  <DropdownMenu.Trigger
                    data-ui-component="button"
                    data-slot="button"
                    data-variant="outline"
                    data-size="icon-sm"
                    aria-label="Choose row density"
                  >
                    <ChevronDown class="notebook-dataframe__toolbar-icon" />
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content
                    align="start"
                    class="notebook-dataframe__density-menu"
                  >
                    <DropdownMenu.RadioGroup
                      value={tableState.rowHeight}
                      onValueChange={(value) =>
                        tableState.setRowHeight(
                          value as "compact" | "default" | "relaxed",
                        )}
                    >
                      <DropdownMenu.RadioItem value="compact"
                        >Compact</DropdownMenu.RadioItem
                      >
                      <DropdownMenu.RadioItem value="default"
                        >Default</DropdownMenu.RadioItem
                      >
                      <DropdownMenu.RadioItem value="relaxed"
                        >Relaxed</DropdownMenu.RadioItem
                      >
                    </DropdownMenu.RadioGroup>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </ButtonGroup.Root>
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
                checked={tableState.sparkbars}
                onclick={() => tableState.setSparkbars(!tableState.sparkbars)}
              />
            </div>
          </Popover.Content>
        </Popover.Root>
      </div>
    </Tooltip.Provider>
  </div>

  <div class="notebook-dataframe__toolbar-meta">
    {schema.rowCount.toLocaleString()} rows
    {#if schema.queryTimeMs != null}
      · {schema.queryTimeMs}ms
    {/if}
  </div>
</div>
