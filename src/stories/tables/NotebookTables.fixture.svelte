<script lang="ts">
  import DataFrameViewer from "../../lib/render/dataframe/DataFrameViewer.svelte";
  import NotebookCanvasTable from "../../lib/render/table/NotebookCanvasTable.svelte";
  import NotebookPreviewTable from "../../lib/render/table/NotebookPreviewTable.svelte";
  import FixtureControls from "../FixtureControls.svelte";
  let {
    setup = true,
    preview = false,
    large = false,
    simple = false,
  }: {
    setup?: boolean;
    preview?: boolean;
    large?: boolean;
    simple?: boolean;
  } = $props();
  const rows = $derived(
    Array.from({ length: large ? 10000 : 45 }, (_, i) => ({
      name: ["Ada", "Grace", "Katherine"][i % 3] + " " + i,
      score: i,
      enabled: i % 2 === 0,
      created: "2026-03-01",
      details: { index: i, tags: ["analysis", "review"] },
    })),
  );
  const columns = [
    { name: "name", type: "text" as const },
    { name: "score", type: "number" as const },
    { name: "enabled", type: "boolean" as const },
    { name: "created", type: "date" as const },
    { name: "details", type: "json" as const },
  ];
</script>

<div class="notebook-table-review">
  {#if setup}<FixtureControls placement="inline"
      ><span>Shared canvas migration — in-memory typed rows</span
      ></FixtureControls
    >{/if}
  {#if preview}<NotebookPreviewTable
      preview={{
        columns: columns.map((c) => c.name),
        rows: rows
          .slice(0, 5)
          .map((row) => columns.map((c) => row[c.name as keyof typeof row])),
      }}
    />
  {:else if simple}<NotebookCanvasTable {rows} {columns} />
  {:else}<DataFrameViewer
      {rows}
      schema={{ columns, rowCount: rows.length }}
      pageSize={large ? 10000 : 25}
      maxHeight="500px"
    />{/if}
</div>

<style>
  .notebook-table-review {
    padding: 1rem;
    min-width: 0;
  }
</style>
