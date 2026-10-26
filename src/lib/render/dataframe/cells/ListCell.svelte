<script lang="ts">
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import * as Popover from "@lapismd/design-core/shadcn/popover";

  let { value }: { value: unknown } = $props();
  let items = $derived(Array.isArray(value) ? value : []);
</script>

<Popover.Root>
  <Popover.Trigger
    data-ui-component="button"
    data-slot="button"
    data-variant="ghost"
    data-size="sm"
    class="notebook-dataframe__cell-button notebook-dataframe__cell-button--plain"
  >
    <Badge variant="outline">[{items.length} items]</Badge>
  </Popover.Trigger>
  <Popover.Content class="notebook-dataframe__list-popover">
    <ul class="notebook-dataframe__list-items">
      {#each items as item}
        <li class="notebook-dataframe__list-item">
          {typeof item === "object" ? JSON.stringify(item) : String(item)}
        </li>
      {/each}
    </ul>
  </Popover.Content>
</Popover.Root>
