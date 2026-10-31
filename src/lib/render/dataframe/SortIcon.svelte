<script lang="ts">
  import ArrowDownWideNarrow from "@lucide/svelte/icons/arrow-down-wide-narrow";
  import ArrowUpNarrowWide from "@lucide/svelte/icons/arrow-up-narrow-wide";
  import ChevronsUpDown from "@lucide/svelte/icons/chevrons-up-down";
  import type { SortDirection } from "./dataframe-types";
  let { direction }: { direction?: SortDirection } = $props();
</script>

{#if direction === "asc"}
  <ArrowUpNarrowWide
    class="notebook-dataframe__column-sort-icon"
    aria-hidden="true"
  />
{:else if direction === "desc"}
  <ArrowDownWideNarrow
    class="notebook-dataframe__column-sort-icon"
    aria-hidden="true"
  />
{:else}
  <ChevronsUpDown
    class="notebook-dataframe__column-sort-icon notebook-dataframe__column-sort-icon--idle"
    aria-hidden="true"
  />
{/if}
