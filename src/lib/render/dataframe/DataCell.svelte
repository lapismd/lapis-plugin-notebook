<script lang="ts">
  import BlobCell from "./cells/BlobCell.svelte";
  import BooleanCell from "./cells/BooleanCell.svelte";
  import DateCell from "./cells/DateCell.svelte";
  import JsonCell from "./cells/JsonCell.svelte";
  import ListCell from "./cells/ListCell.svelte";
  import NullCell from "./cells/NullCell.svelte";
  import NumericCell from "./cells/NumericCell.svelte";
  import TextCell from "./cells/TextCell.svelte";
  import type { ColumnSummary, DataFrameColumn } from "./dataframe-types";

  const NUMERIC_TYPES = new Set([
    "integer",
    "bigint",
    "float",
    "double",
    "decimal",
    "number",
  ]);

  let {
    value,
    column,
    summary,
    sparkbars = false,
  }: {
    value: unknown;
    column: DataFrameColumn;
    summary?: ColumnSummary;
    sparkbars?: boolean;
  } = $props();

  let type = $derived.by(() => {
    if (value == null) {
      return "null";
    }

    if (column.type === "json" && Array.isArray(value)) {
      return "list";
    }

    if (column.type === "json" && typeof value === "object") {
      return "struct";
    }

    return column.type ?? "unknown";
  });

  let numericSummary = $derived(summary?.type === "number" ? summary : null);
</script>

{#if type === "null"}
  <NullCell />
{:else if NUMERIC_TYPES.has(type)}
  <NumericCell
    {value}
    {sparkbars}
    min={numericSummary?.min ?? null}
    max={numericSummary?.max ?? null}
  />
{:else if type === "boolean"}
  <BooleanCell {value} />
{:else if type === "date" || type === "timestamp"}
  <DateCell {value} type={type === "timestamp" ? "timestamp" : "date"} />
{:else if type === "json" || type === "struct"}
  <JsonCell {value} />
{:else if type === "list"}
  <ListCell {value} />
{:else if type === "blob"}
  <BlobCell {value} />
{:else}
  <TextCell {value} />
{/if}
