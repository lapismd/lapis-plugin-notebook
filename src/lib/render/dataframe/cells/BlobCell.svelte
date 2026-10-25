<script lang="ts">
  import { formatCellValue } from "../utils/format";

  let { value }: { value: unknown } = $props();
  let formatted = $derived(formatCellValue(value, "blob"));
</script>

<div class="notebook-dataframe__cell-mono" title={formatted.title}>
  {formatted.text}
</div>
