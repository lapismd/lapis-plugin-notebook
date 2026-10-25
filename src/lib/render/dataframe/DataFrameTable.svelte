<script lang="ts">
  import DataFrameViewer from "./DataFrameViewer.svelte";
  import {
    downloadTextFile,
    exportRowsAsCsv,
    exportRowsAsJson,
  } from "./dataframe-export";
  import {
    humanizeColumnName,
    inferColumns,
    inferDisplayType,
    summarizeColumn,
  } from "./dataframe-utils";
  import type {
    ColumnSummary,
    DataFrameColumn,
    DataFrameColumnType,
    DataFrameOptions,
    DataFrameRow,
  } from "./dataframe-types";

  type Props = {
    rows?: DataFrameRow[];
    columns?: DataFrameColumn[];
    options?: DataFrameOptions;
    title?: string;
  };

  const DEFAULT_PAGE_SIZE = 25;
  type ResolvedDataFrameColumn = {
    key: string;
    label: string;
    type: DataFrameColumnType;
    displayType: string;
    nullable: boolean;
  };

  let {
    rows = [],
    columns = undefined,
    options = {},
    title = undefined,
  }: Props = $props();

  let resolvedOptions = $derived({
    pageSize: DEFAULT_PAGE_SIZE,
    searchable: true,
    sortable: true,
    filterable: true,
    downloadable: true,
    showColumnSummaries: true,
    ...options,
  });

  let inferredColumns = $derived(inferColumns(rows));
  let resolvedColumns = $derived.by(() => {
    if (!columns?.length) {
      return inferredColumns;
    }

    const inferredByKey = new Map(
      inferredColumns.map((column) => [column.key, column]),
    );
    const seen = new Set<string>();
    const merged = columns.map((column) => {
      const inferred = inferredByKey.get(column.key);
      seen.add(column.key);
      return {
        key: column.key,
        label:
          column.label ?? inferred?.label ?? humanizeColumnName(column.key),
        type: column.type ?? inferred?.type ?? "unknown",
        displayType:
          column.displayType ??
          inferred?.displayType ??
          inferDisplayType(rows.map((row) => row[column.key])),
        nullable: column.nullable ?? inferred?.nullable ?? true,
      } satisfies ResolvedDataFrameColumn;
    });

    for (const inferred of inferredColumns) {
      if (!seen.has(inferred.key)) {
        merged.push({
          key: inferred.key,
          label: inferred.label ?? humanizeColumnName(inferred.key),
          type: inferred.type ?? "unknown",
          displayType: inferred.displayType ?? inferred.type ?? "unknown",
          nullable: inferred.nullable ?? true,
        });
      }
    }

    return merged;
  });

  let schema = $derived({
    columns: resolvedColumns.map((column) => ({
      name: column.key,
      label: column.label,
      type: column.type ?? "unknown",
      displayType: column.displayType,
      nullable: column.nullable,
    })),
    rowCount: rows.length,
  });

  function handleExport(format: "csv" | "json" | "parquet"): void {
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

<DataFrameViewer
  {schema}
  {rows}
  {title}
  options={resolvedOptions}
  pageSize={resolvedOptions.pageSize ?? DEFAULT_PAGE_SIZE}
  onExport={resolvedOptions.downloadable === false ? undefined : handleExport}
/>
<!-- TODO: Add a transform builder and chart builder inspired by Marimo dataframe panels. -->
