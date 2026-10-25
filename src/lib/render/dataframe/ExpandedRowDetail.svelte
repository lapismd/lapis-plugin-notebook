<script lang="ts">
  import type { Column, DataFrameRow } from "./dataframe-types";

  let {
    row,
    columns,
  }: {
    row: DataFrameRow;
    columns: Column[];
  } = $props();
</script>

<div class="notebook-dataframe__expanded">
  <dl class="notebook-dataframe__expanded-grid">
    {#each columns as column}
      <div>
        <dt class="notebook-dataframe__expanded-term">
          {column.label ?? column.name}
        </dt>
        <dd class="notebook-dataframe__expanded-value">
          {row[column.name] == null
            ? "null"
            : typeof row[column.name] === "object"
              ? JSON.stringify(row[column.name])
              : String(row[column.name])}
        </dd>
      </div>
    {/each}
  </dl>
</div>
