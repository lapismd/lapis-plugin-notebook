<script lang="ts">
  import { formatCellValue } from "../utils/format";

  let { value }: { value: unknown } = $props();
  let formatted = $derived(formatCellValue(value, "text"));
</script>

<div class="notebook-dataframe__cell-truncate" title={formatted.title}>
  {formatted.text}
</div>
