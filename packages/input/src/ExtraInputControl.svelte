<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { ButtonGroup } from "@lapismd/design-core/shadcn/button-group";
  import { Checkbox } from "@lapismd/design-core/shadcn/checkbox";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import * as RadioGroup from "@lapismd/design-core/shadcn/radio-group";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import * as InputGroup from "@lapismd/design-core/shadcn/input-group";
  import { MarkdownComposer } from "@lapismd/design-core/chat";
  import { Search } from "@lucide/svelte";
  import { getNotebookInputMetadata } from "./dom-runtime";
  import { getExtraInputModel } from "./extra-model";
  import { getNotebookFileModel } from "./file-model";
  import NodeContent from "./NodeContent.svelte";
  import type { ExtraInputModel } from "./extra-model";

  let { model, revision }: { model: ExtraInputModel; revision: number } =
    $props();
  const id = $props.id();
  const childLabel = (child: Node) =>
    getExtraInputModel(child) || getNotebookFileModel(child)
      ? undefined
      : getNotebookInputMetadata(child)?.label;
  const state = $derived.by(() => {
    revision;
    return {
      ids: [...model.ids],
      text: model.kind === "markdown" ? String(model.value ?? "") : "",
      pending: model.pending,
      query: model.query,
      resultLabel: model.resultLabel,
      count: Array.isArray(model.value) ? model.value.length : 0,
    };
  });
  const name = $derived(
    typeof model.options.label === "string"
      ? model.options.label
      : "Notebook input",
  );
  const disabled = $derived(model.options.disabled === true);
  const choiceText = (value: unknown) =>
    value instanceof Node
      ? (value.textContent ?? "")
      : value == null
        ? "Select…"
        : String(value);
  const selection = $derived(
    model.multiple
      ? `${state.ids.length} selected`
      : choiceText(
          model.choices.find((choice) => choice.id === state.ids[0])?.label,
        ),
  );
</script>

<div
  class="notebook-input-control"
  style:width={model.options.width == null
    ? undefined
    : typeof model.options.width === "number"
      ? `${model.options.width}px`
      : model.options.width}
>
  {#if model.kind === "checkbox" || model.kind === "radio"}
    <Field.Set
      {disabled}
      class="notebook-input-control__options"
      data-labelled={Boolean(model.options.label)}
    >
      {#if model.options.label}<Field.Legend
          class="notebook-input-control__options-label"
          ><NodeContent value={model.options.label} /></Field.Legend
        >{/if}
      <div class="notebook-input-control__options-body">
        {#if model.kind === "checkbox"}
          <Field.Group class="notebook-input-control__choices">
            {#each model.choices as choice (choice.id)}
              <Field.Field
                orientation="horizontal"
                class="notebook-input-control__choice"
                data-disabled={choice.disabled || disabled}
              >
                <Checkbox
                  id={`${id}-${choice.id}`}
                  checked={state.ids.includes(choice.id)}
                  disabled={choice.disabled || disabled}
                  onCheckedChange={(checked) =>
                    model.choose(
                      checked
                        ? [...state.ids, choice.id]
                        : state.ids.filter((value) => value !== choice.id),
                    )}
                />
                <Field.Label for={`${id}-${choice.id}`}
                  ><NodeContent value={choice.label} /></Field.Label
                >
              </Field.Field>
            {/each}
          </Field.Group>
        {:else}
          <RadioGroup.Root
            value={state.ids[0] ?? ""}
            {disabled}
            required={Boolean(model.options.required)}
            aria-label={name}
            onValueChange={(value) => model.choose(value ? [value] : [])}
          >
            {#each model.choices as choice (choice.id)}
              <Field.Field
                orientation="horizontal"
                class="notebook-input-control__choice"
                data-disabled={choice.disabled || disabled}
              >
                <RadioGroup.Item
                  id={`${id}-${choice.id}`}
                  value={choice.id}
                  disabled={choice.disabled || disabled}
                />
                <Field.Label for={`${id}-${choice.id}`}
                  ><NodeContent value={choice.label} /></Field.Label
                >
              </Field.Field>
            {/each}
          </RadioGroup.Root>
        {/if}
      </div>
    </Field.Set>
  {:else if model.kind === "form"}
    <Field.Group class="notebook-input-control__form">
      {#if model.template}<NodeContent value={model.template} />
      {:else}{#each model.children as child}<Field.Field
            class="notebook-input-control__form-field"
            data-labelled={Boolean(childLabel(child))}
          >
            {#if childLabel(child)}<Field.Title>{childLabel(child)}</Field.Title
              >{/if}
            <NodeContent value={child} />
          </Field.Field>{/each}{/if}
    </Field.Group>
  {:else}
    <Field.Field
      class="notebook-input-control__field"
      data-labelled={Boolean(model.options.label && model.kind !== "markdown")}
    >
      {#if model.options.label && model.kind !== "markdown"}<Field.Label
          for={model.kind === "button" ? undefined : id}
          ><NodeContent value={model.options.label} /></Field.Label
        >{/if}
      {#if model.kind === "markdown"}
        <MarkdownComposer
          value={state.text}
          onChange={(value) => model.setText(value)}
          onSubmit={(value) => model.setText(value)}
          label={name}
          inputLabel={name}
          placeholder={model.options.placeholder ?? "Write Markdown…"}
          {disabled}
          showSendButton={false}
          showHint={false}
          submitOnEnter={false}
        />
      {:else if model.kind === "button"}
        <ButtonGroup aria-label={name}>
          {#each model.actions as action, index}
            <Button
              id={index === 0 ? id : undefined}
              variant="outline"
              disabled={action.disabled || state.pending}
              aria-busy={state.pending}
              onclick={() => model.activate(index)}
              ><NodeContent value={action.content} /></Button
            >
          {/each}
        </ButtonGroup>
      {:else if model.kind === "select"}
        {#if model.multiple}
          <Select.Root
            type="multiple"
            value={state.ids}
            {disabled}
            onValueChange={(ids) => model.choose(ids)}
          >
            <Select.Trigger
              {id}
              aria-label={name}
              class="notebook-input-control__select"
              ><NodeContent value={selection} /></Select.Trigger
            >
            <Select.Content
              ><Select.Group>
                {#each model.choices as choice (choice.id)}<Select.Item
                    value={choice.id}
                    label={String(choice.label)}
                    disabled={choice.disabled}
                    ><NodeContent value={choice.label} /></Select.Item
                  >{/each}
              </Select.Group></Select.Content
            >
          </Select.Root>
        {:else}
          <Select.Root
            type="single"
            value={state.ids[0] ?? ""}
            {disabled}
            onValueChange={(value) => model.choose(value ? [value] : [])}
          >
            <Select.Trigger
              {id}
              aria-label={name}
              class="notebook-input-control__select"
              ><NodeContent value={selection} /></Select.Trigger
            >
            <Select.Content
              ><Select.Group>
                {#each model.choices as choice (choice.id)}<Select.Item
                    value={choice.id}
                    label={String(choice.label)}
                    disabled={choice.disabled}
                    ><NodeContent value={choice.label} /></Select.Item
                  >{/each}
              </Select.Group></Select.Content
            >
          </Select.Root>
        {/if}
      {:else if model.kind === "search"}
        <InputGroup.Root>
          <InputGroup.Input
            {id}
            type="search"
            aria-label={name}
            value={state.query}
            {disabled}
            placeholder={model.options.placeholder ?? "Search"}
            spellcheck={model.options.spellcheck}
            autocomplete={model.options.autocomplete === true
              ? "on"
              : model.options.autocomplete === false
                ? "off"
                : model.options.autocomplete}
            autocapitalize={model.options.autocapitalize === true
              ? "on"
              : model.options.autocapitalize === false
                ? "off"
                : model.options.autocapitalize}
            list={model.options.datalist ? `${id}-suggestions` : undefined}
            oninput={(event) => {
              event.stopPropagation();
              model.setQuery(event.currentTarget.value);
            }}
          />
          <InputGroup.Addon align="inline-start"
            ><Search aria-hidden="true" /></InputGroup.Addon
          >
        </InputGroup.Root>
        {#if model.options.datalist}<datalist id={`${id}-suggestions`}
            >{#each Array.from(model.options.datalist) as item}<option
                value={String(item)}
              ></option>{/each}</datalist
          >{/if}
        <output class="notebook-input-control__count" aria-live="polite"
          ><NodeContent value={state.resultLabel} /></output
        >
      {/if}
    </Field.Field>
  {/if}
</div>
