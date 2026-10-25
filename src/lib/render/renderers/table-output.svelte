<script lang="ts">
  import type { NotebookTableOutput } from "../../output";
  import DataFrameViewer from "../dataframe/DataFrameViewer.svelte";
  import {
    downloadTextFile,
    exportRowsAsCsv,
    exportRowsAsJson,
  } from "../dataframe/dataframe-export";
  import { normalizeColumnarRows } from "../dataframe/dataframe-utils";

  type Props = {
    output: NotebookTableOutput;
  };

  let { output }: Props = $props();
  let rows = $derived(normalizeColumnarRows(output.columns, output.rows));
  let schema = $derived.by(() => {
    const columns = output.columnMeta?.length
      ? output.columnMeta.map((column) => ({
          name: column.key,
          label: column.label,
          type: column.type ?? "unknown",
          displayType: column.displayType,
          nullable: column.nullable,
        }))
      : output.columns.map((column) => ({
          name: column,
          label: column,
          type: "unknown" as const,
        }));

    return {
      columns,
      rowCount: output.schema?.rowCount ?? rows.length,
      truncated: output.schema?.truncated,
      queryTimeMs: output.schema?.queryTimeMs,
      sourceSql: output.schema?.sourceSql,
    };
  });

  function handleExport(format: "csv" | "json" | "parquet") {
    if (format === "csv") {
      downloadTextFile(
        "dataframe.csv",
        exportRowsAsCsv(rows),
        "text/csv;charset=utf-8",
      );
      return;
    }

    if (format === "json") {
      downloadTextFile(
        "dataframe.json",
        exportRowsAsJson(rows),
        "application/json;charset=utf-8",
      );
    }
  }
</script>

<div class="notebook-output__table">
  <DataFrameViewer
    {schema}
    {rows}
    title={output.title}
    options={{
      searchable: true,
      sortable: true,
      filterable: true,
      showColumnSummaries: true,
      ...output.options,
    }}
    onExport={output.options?.downloadable === false ? undefined : handleExport}
  />
</div>
