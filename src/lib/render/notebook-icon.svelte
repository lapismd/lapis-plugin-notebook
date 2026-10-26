<script lang="ts">
  // Thin adapter over the public API icon registry: the legacy panels used an
  // `Icon` component from a non-exported API subpath; `getSvg` is public and
  // supports the same name-fallback arrays.
  import { getSvg } from "@lapis-notes/api";

  let {
    name,
    class: className = "",
  }: {
    name: string | string[];
    class?: string;
  } = $props();

  let svgMarkup = $state("");

  $effect(() => {
    const requested = name;
    let cancelled = false;
    void getSvg(requested)
      .then((result) => {
        if (!cancelled) svgMarkup = result ?? "";
      })
      .catch(() => {
        if (!cancelled) svgMarkup = "";
      });
    return () => {
      cancelled = true;
    };
  });
</script>

<span class={className}>{@html svgMarkup}</span>
