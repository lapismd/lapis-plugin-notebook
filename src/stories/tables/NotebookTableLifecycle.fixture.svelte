<script lang="ts">
  import DataFrameViewer from "../../lib/render/dataframe/DataFrameViewer.svelte";
  import FixtureControls from "../FixtureControls.svelte";
  let { sortable = true }: { sortable?: boolean } = $props();
  let generation = $state(0);
  let rows = $state([{ value: 10 as string | number }, { value: 20 }]);
  const schema = {
    columns: [{ name: "value", label: "Value", type: "unknown" as const }],
    rowCount: 2,
  };
</script>

<div class="notebook-table-review">
  <FixtureControls placement="inline">
    <button
      type="button"
      onclick={() => (rows = [{ value: "changed" }, { value: 20 }])}
      >Update values</button
    >
    <button
      type="button"
      onclick={() => {
        generation++;
        rows = [{ value: 30 }, { value: 40 }];
      }}>Replace result</button
    >
  </FixtureControls>
  <DataFrameViewer
    {rows}
    {schema}
    resultIdentity={generation}
    options={{ sortable }}
  />
</div>

<style>
  .notebook-table-review {
    padding: 1rem;
  }
</style>
