<script lang="ts">
  import { formatCellValue } from "../utils/format";

  let {
    value,
    type = "date",
  }: { value: unknown; type?: "date" | "timestamp" } = $props();
  let formatted = $derived(formatCellValue(value, type));
</script>

<div class="notebook-dataframe__cell-mono" title={formatted.title}>
  {formatted.text}
</div>
