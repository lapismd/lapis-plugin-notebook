<script lang="ts">
  import NotebookCanvasTable from "./NotebookCanvasTable.svelte";
  let { preview }: { preview: { columns: string[]; rows: unknown[][] } } =
    $props();
  const columns = $derived(
    preview.columns.map((name) => ({ name, type: "unknown" as const })),
  );
  const rows = $derived(
    preview.rows
      .slice(0, 5)
      .map((row) =>
        Object.fromEntries(preview.columns.map((name, i) => [name, row[i]])),
      ),
  );
</script>

<p class="notebook-preview-scope">
  Filters apply to this preview (first 5 rows).
</p>
<NotebookCanvasTable
  {rows}
  {columns}
  height="260px"
  label="Data source preview"
/>

<style>
  .notebook-preview-scope {
    color: var(--muted-foreground);
    font-size: 0.75rem;
  }
</style>
