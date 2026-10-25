<script lang="ts">
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { buttonVariants } from "@lapismd/design-core/shadcn/button";
  import * as Popover from "@lapismd/design-core/shadcn/popover";

  let { value }: { value: unknown } = $props();
  let items = $derived(Array.isArray(value) ? value : []);

  const triggerClass = `${buttonVariants({ variant: "ghost", size: "sm" })} notebook-dataframe__cell-button notebook-dataframe__cell-button--plain`;
</script>

<Popover.Root>
  <Popover.Trigger class={triggerClass}>
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
