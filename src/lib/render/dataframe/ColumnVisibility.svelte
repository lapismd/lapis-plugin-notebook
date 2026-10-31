<script lang="ts">
  import { untrack } from "svelte";
  import * as Command from "@lapismd/design-core/shadcn/command";
  import { Checkbox } from "@lapismd/design-core/shadcn/checkbox";
  import Type from "@lucide/svelte/icons/type";
  import Hash from "@lucide/svelte/icons/hash";
  import Calendar from "@lucide/svelte/icons/calendar";
  import ToggleLeft from "@lucide/svelte/icons/toggle-left";
  import Braces from "@lucide/svelte/icons/braces";
  import type { Column } from "./dataframe-types";

  let {
    columns,
    hiddenColumns,
    onToggle,
  }: {
    columns: readonly Column[];
    hiddenColumns: ReadonlySet<string>;
    onToggle: (name: string) => void;
  } = $props();
  const listId = $props.id();
  // Capture visibility order on opening, so toggles do not move under the pointer.
  const initialHidden = untrack(() => new Set(hiddenColumns));
  const ordered = $derived(
    [...columns].sort(
      (a, b) =>
        Number(initialHidden.has(a.name)) - Number(initialHidden.has(b.name)),
    ),
  );
  function typeIcon(type: Column["type"]) {
    if (
      ["integer", "bigint", "float", "double", "decimal", "number"].includes(
        type,
      )
    )
      return Hash;
    if (type === "boolean") return ToggleLeft;
    if (type === "date" || type === "timestamp") return Calendar;
    if (["json", "struct", "list"].includes(type)) return Braces;
    return Type;
  }
</script>

<Command.Root label="Find columns">
  <Command.Input
    aria-label="Find columns"
    placeholder="Find columns"
    aria-controls={listId}
    aria-haspopup="grid"
  />
  <Command.List id={listId}>
    {#snippet child({ props })}
      <div {...props} role="grid" aria-label="Visible columns">
        <Command.Empty>No columns found.</Command.Empty>
        <Command.Group>
          {#snippet child({ props: groupProps })}
            <div {...groupProps} role="rowgroup">
              {#each ordered as column (column.name)}
                {@const Icon = typeIcon(column.type)}
                <Command.Item
                  value={column.name}
                  keywords={[column.label ?? column.name]}
                  onSelect={() => onToggle(column.name)}
                >
                  {#snippet child({ props: itemProps })}
                    <div {...itemProps} role="row">
                      <div
                        role="gridcell"
                        class="notebook-column-picker__choice"
                      >
                        <span
                          onkeydown={(event) => event.stopPropagation()}
                          onclick={(event) => event.stopPropagation()}
                          role="presentation"
                        >
                          <Checkbox
                            checked={!hiddenColumns.has(column.name)}
                            onCheckedChange={() => onToggle(column.name)}
                            aria-label={`Show ${column.label ?? column.name}`}
                          />
                        </span>
                        <Icon
                          class="notebook-column-picker__icon"
                          aria-hidden="true"
                        />
                        <span
                          class="notebook-column-picker__name"
                          data-hidden={hiddenColumns.has(column.name)}
                          >{column.label ?? column.name}</span
                        >
                      </div>
                    </div>
                  {/snippet}
                </Command.Item>
              {/each}
            </div>
          {/snippet}
        </Command.Group>
      </div>
    {/snippet}
  </Command.List>
</Command.Root>

<style>
  .notebook-column-picker__choice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    width: 100%;
  }
  .notebook-column-picker__choice > span:first-child {
    display: flex;
  }
  :global(.notebook-column-picker__icon) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    color: var(--muted-foreground);
  }
  .notebook-column-picker__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .notebook-column-picker__name[data-hidden="true"] {
    color: var(--muted-foreground);
  }
</style>
