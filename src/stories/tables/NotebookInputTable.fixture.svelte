<script lang="ts">
  import { onMount } from "svelte";
  import FixtureControls from "../FixtureControls.svelte";
  import { loadUiBackedNotebookInputs } from "../../../packages/input/src/ui-runtime";
  let {
    single = false,
    required = false,
    disabled = false,
  }: { single?: boolean; required?: boolean; disabled?: boolean } = $props();
  const rows = [
    {
      name: "Ada",
      score: 7,
      notes:
        "Completed the analysis and reviewing the detailed findings with the research team before the next planning meeting.",
    },
    { name: "Grace", score: 9 },
    { name: "Katherine", score: 8 },
  ];
  let target = $state<HTMLDivElement>();
  let host = $state<
    | (HTMLElement & {
        value: unknown;
        __lapisNotebookInputDispose?: () => void;
      })
    | null
  >(null);
  let selected = $state("Waiting");
  let events = $state(0);
  function read() {
    const value = host?.value;
    selected = Array.isArray(value)
      ? value.map((row) => row.name).join(", ")
      : value && typeof value === "object"
        ? (value as { name: string }).name
        : "None";
  }
  onMount(() => {
    let disposed = false;
    let control: typeof host = null;
    void loadUiBackedNotebookInputs().then((runtime) => {
      if (disposed || !target) return;
      control = (
        runtime.inputs.table as (
          data: unknown,
          options: unknown,
        ) => NonNullable<typeof host>
      )(rows, {
        multiple: !single,
        required,
        disabled,
        value: single ? undefined : [rows[0]],
        rows: 6,
      });
      host = control;
      control.addEventListener("input", changed);
      target.append(control);
      read();
    });
    function changed() {
      events++;
      read();
    }
    return () => {
      disposed = true;
      control?.removeEventListener("input", changed);
      control?.__lapisNotebookInputDispose?.();
      host = null;
    };
  });
</script>

<div class="notebook-input-table-review">
  <FixtureControls placement="inline"
    ><button
      type="button"
      disabled={!host}
      onclick={() => {
        if (host) {
          host.value = single ? rows[2] : [rows[2]];
          read();
        }
      }}>Replace selection</button
    ></FixtureControls
  >
  <output aria-label="Selected input rows">{selected}</output><output
    aria-label="Input events">{events}</output
  >
  <div bind:this={target}></div>
</div>

<style>
  .notebook-input-table-review {
    padding: 1rem;
    display: grid;
    gap: 0.75rem;
  }
</style>
