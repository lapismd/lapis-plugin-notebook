<script lang="ts">
  import { formatCellValue } from "../utils/format";

  let {
    value,
    sparkbars = false,
    min = null,
    max = null,
  }: {
    value: unknown;
    sparkbars?: boolean;
    min?: number | null;
    max?: number | null;
  } = $props();

  let formatted = $derived(formatCellValue(value, "number"));
  let percentage = $derived.by(() => {
    if (value == null || min == null || max == null || max === min) {
      return 0;
    }

    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return 0;
    }

    return Math.max(0, Math.min(100, ((numeric - min) / (max - min)) * 100));
  });
</script>

<div class="notebook-dataframe__numeric" title={formatted.title}>
  <span>{formatted.text}</span>
  {#if sparkbars && value != null}
    <div class="notebook-dataframe__sparkbar">
      <div
        class="notebook-dataframe__sparkbar-fill"
        style:width={`${percentage}%`}
      ></div>
    </div>
  {/if}
</div>
