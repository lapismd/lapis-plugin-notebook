<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";

  let {
    rowCount,
    state,
  }: {
    rowCount: number;
    state: {
      page: number;
      pageSize: number;
      setPage: (page: number) => void;
    };
  } = $props();

  let totalPages = $derived(Math.max(1, Math.ceil(rowCount / state.pageSize)));
  let start = $derived(rowCount === 0 ? 0 : state.page * state.pageSize + 1);
  let end = $derived(Math.min((state.page + 1) * state.pageSize, rowCount));
</script>

<div class="notebook-dataframe__pagination">
  <span class="notebook-dataframe__pagination-summary"
    >Rows {start}-{end} of {rowCount.toLocaleString()}</span
  >
  <div class="notebook-dataframe__pagination-actions">
    <Button
      variant="outline"
      size="sm"
      disabled={state.page === 0}
      onclick={() => state.setPage(state.page - 1)}
    >
      Previous
    </Button>
    <span class="notebook-dataframe__pagination-current"
      >{state.page + 1}/{totalPages}</span
    >
    <Button
      variant="outline"
      size="sm"
      disabled={state.page >= totalPages - 1}
      onclick={() => state.setPage(state.page + 1)}
    >
      Next
    </Button>
  </div>
</div>
