<script lang="ts">
  import * as Sheet from "@lapismd/design-core/shadcn/sheet";
  import DataFrameColumnSummary from "./DataFrameColumnSummary.svelte";
  import type { Column, ColumnSummary } from "./dataframe-types";

  let {
    column,
    summary,
    onClose,
  }: {
    column: Column | null;
    summary?: ColumnSummary;
    onClose: () => void;
  } = $props();
</script>

<Sheet.Root open={column != null} onOpenChange={(open) => !open && onClose()}>
  <Sheet.Content side="right" class="notebook-dataframe__profile-sheet">
    {#snippet children()}
      {#if column}
        <Sheet.Header class="notebook-dataframe__profile-header">
          <Sheet.Title>{column.label ?? column.name}</Sheet.Title>
          <div class="notebook-dataframe__profile-kind">
            {column.displayType ?? column.type}{#if column.nullable}
              · nullable{/if}
          </div>
        </Sheet.Header>

        <div class="notebook-dataframe__profile-body">
          {#if summary}
            <DataFrameColumnSummary {summary} variant="detail" />
          {/if}
        </div>
      {/if}
    {/snippet}
  </Sheet.Content>
</Sheet.Root>
<!-- TODO: Add a transform builder and chart builder inspired by Marimo dataframe panels. -->
