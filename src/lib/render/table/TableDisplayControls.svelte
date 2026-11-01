<script lang="ts">
  import WrapText from "@lucide/svelte/icons/wrap-text";
  import Palette from "@lucide/svelte/icons/palette";
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";
  let {
    wrapText,
    columnColours,
    onWrapTextChange,
    onColumnColoursChange,
  }: {
    wrapText: boolean;
    columnColours: boolean;
    onWrapTextChange: (value: boolean) => void;
    onColumnColoursChange: (value: boolean) => void;
  } = $props();
  const value = $derived([
    ...(wrapText ? ["wrap"] : []),
    ...(columnColours ? ["colours"] : []),
  ]);
</script>

<ToggleGroup.Root
  type="multiple"
  size="sm"
  aria-label="Table display"
  {value}
  onValueChange={(next) => {
    const wrap = next.includes("wrap"),
      colours = next.includes("colours");
    if (wrap !== wrapText) onWrapTextChange(wrap);
    if (colours !== columnColours) onColumnColoursChange(colours);
  }}
>
  <ToggleGroup.Item value="wrap" aria-label="Wrap text" title="Wrap text"
    ><WrapText /></ToggleGroup.Item
  >
  <ToggleGroup.Item
    value="colours"
    aria-label="Column colours"
    title="Column colours"><Palette /></ToggleGroup.Item
  >
</ToggleGroup.Root>
