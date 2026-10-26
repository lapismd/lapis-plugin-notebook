<script lang="ts">
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
</script>

<Popover.Root>
  <Popover.Trigger
    data-ui-component="button"
    data-slot="button"
    data-variant="ghost"
    data-size="sm"
    class="notebook-dataframe__cell-button"
  >
    {preview}
  </Popover.Trigger>
  <Popover.Content class="notebook-dataframe__json-popover">
    <pre class="notebook-dataframe__json-pre">{stringify(value)}</pre>
  </Popover.Content>
</Popover.Root>
