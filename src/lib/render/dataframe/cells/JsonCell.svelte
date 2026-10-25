<script lang="ts">
  import { buttonVariants } from "@lapismd/design-core/shadcn/button";
  import * as Popover from "@lapismd/design-core/shadcn/popover";

  let { value }: { value: unknown } = $props();

  function stringify(value: unknown): string {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  let preview = $derived.by(() => {
    const text = stringify(value);
    return text.length > 36 ? `${text.slice(0, 36)}...` : text;
  });

  const triggerClass = `${buttonVariants({ variant: "ghost", size: "sm" })} notebook-dataframe__cell-button`;
</script>

<Popover.Root>
  <Popover.Trigger class={triggerClass}>
    {preview}
  </Popover.Trigger>
  <Popover.Content class="notebook-dataframe__json-popover">
    <pre class="notebook-dataframe__json-pre">{stringify(value)}</pre>
  </Popover.Content>
</Popover.Root>
