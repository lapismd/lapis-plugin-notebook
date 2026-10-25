<script lang="ts">
  import { Badge } from "@lapismd/design-core/shadcn/badge";

  let { value }: { value: unknown } = $props();
</script>

{#if value == null}
  <Badge variant="outline" class="notebook-dataframe__null">null</Badge>
{:else if value === true}
  <Badge variant="default">true</Badge>
{:else}
  <Badge variant="secondary">false</Badge>
{/if}
