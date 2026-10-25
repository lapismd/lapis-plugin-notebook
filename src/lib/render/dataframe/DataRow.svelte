<script lang="ts">
  import DataCell from "./DataCell.svelte";
  import type { Column, ColumnSummary, DataFrameRow } from "./dataframe-types";

  let {
    row,
    index,
    columns,
    summaryByKey,
    state,
    gridTemplate,
    style = undefined,
    allowExpand = true,
  }: {
    row: DataFrameRow;
    index: number;
    columns: Column[];
    summaryByKey: Record<string, ColumnSummary>;
    state: {
      expandedRows: Set<number>;
      sparkbars: boolean;
      toggleRow: (index: number) => void;
    };
    gridTemplate: string;
    style?: string;
    allowExpand?: boolean;
  } = $props();

  let expanded = $derived(state.expandedRows.has(index));
</script>

<div
  role="row"
  class="notebook-dataframe__row"
  data-expanded={expanded ? "true" : undefined}
  style={`grid-template-columns:${gridTemplate};${style ?? ""}`}
  tabindex={allowExpand ? 0 : undefined}
  onclick={() => allowExpand && state.toggleRow(index)}
  onkeydown={(event: KeyboardEvent) => {
    if (!allowExpand) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      state.toggleRow(index);
    }
  }}
>
  {#each columns as column}
    <div role="gridcell" class="notebook-dataframe__body-cell">
      <DataCell
        value={row[column.name]}
        column={{
          key: column.name,
          label: column.label,
          type: column.type,
          displayType: column.displayType,
          nullable: column.nullable,
        }}
        summary={summaryByKey[column.name]}
        sparkbars={state.sparkbars}
      />
    </div>
  {/each}
</div>
