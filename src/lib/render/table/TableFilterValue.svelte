<script lang="ts">
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { Checkbox } from "@lapismd/design-core/shadcn/checkbox";
  import { Textarea } from "@lapismd/design-core/shadcn/textarea";
  import type { FilterValueEditorProps } from "@lapismd/design-core/shadcn/filter-builder";
  let {
    value,
    field,
    operator,
    disabled,
    invalid,
    describedBy,
    onValueChange,
  }: FilterValueEditorProps = $props();
  const label = $derived(field.label + " filter value");
  const inputType = $derived(
    field.type === "date"
      ? "date"
      : field.type === "datetime"
        ? "datetime-local"
        : "text",
  );
  function display(input: unknown) {
    return field.type === "datetime" && typeof input === "string"
      ? input.slice(0, 16)
      : String(input ?? "");
  }
  function parse(input: string) {
    return field.type === "datetime" &&
      input &&
      Number.isFinite(Date.parse(input))
      ? new Date(input).toISOString()
      : input;
  }
</script>

{#if operator.id === "between"}
  <div class="notebook-table-filter-range">
    <Input
      type={inputType}
      aria-label={field.label + " lower bound"}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      {disabled}
      value={display(Array.isArray(value) ? value[0] : "")}
      oninput={(e) =>
        onValueChange([
          parse(e.currentTarget.value),
          Array.isArray(value) ? (value[1] ?? "") : "",
        ])}
    />
    <span>and</span>
    <Input
      type={inputType}
      aria-label={field.label + " upper bound"}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      {disabled}
      value={display(Array.isArray(value) ? value[1] : "")}
      oninput={(e) =>
        onValueChange([
          Array.isArray(value) ? (value[0] ?? "") : "",
          parse(e.currentTarget.value),
        ])}
    />
  </div>
{:else if operator.value === "multiple"}
  <Textarea
    aria-label={label}
    aria-invalid={invalid || undefined}
    aria-describedby={describedBy}
    placeholder="One value per line"
    {disabled}
    value={Array.isArray(value) ? value.join("\n") : ""}
    oninput={(e) => onValueChange(e.currentTarget.value.split("\n"))}
  />
{:else if field.type === "boolean"}
  <Checkbox
    aria-label={label}
    aria-invalid={invalid || undefined}
    aria-describedby={describedBy}
    {disabled}
    checked={value === true || value === "true"}
    onCheckedChange={(checked) => onValueChange(checked === true)}
  />
{:else}
  <Input
    type={inputType}
    inputmode={field.type === "number" ? "decimal" : undefined}
    aria-label={label}
    aria-invalid={invalid || undefined}
    aria-describedby={describedBy}
    {disabled}
    value={display(value)}
    oninput={(e) => onValueChange(parse(e.currentTarget.value))}
  />
{/if}

<style>
  .notebook-table-filter-range {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }
</style>
