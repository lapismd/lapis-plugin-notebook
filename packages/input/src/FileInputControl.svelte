<script lang="ts">
  import { onDestroy } from "svelte";
  import { FolderOpen, Upload, X } from "@lucide/svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { FileTypeIcon } from "@lapismd/design-core/shadcn/file-type-icon";
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Command from "@lapismd/design-core/shadcn/command";
  import type { NotebookFileModel } from "./file-model";
  import type { NotebookVaultFile } from "./host-context";
  import NodeContent from "./NodeContent.svelte";

  let { model, revision }: { model: NotebookFileModel; revision: number } =
    $props();
  const id = $props.id();
  let open = $state(false);
  let available = $state<NotebookVaultFile[]>([]);
  let selectedPaths = $state<string[]>([]);
  let upload = $state<HTMLInputElement | null>(null);
  let chooseButton = $state<HTMLButtonElement | null>(null);
  let disposed = false;
  let request = 0;
  const view = $derived.by(() => {
    revision;
    return {
      selected: [...model.selected],
      error: model.error,
      pending: model.pending,
      needsReselection: model.needsReselection,
    };
  });
  const disabled = $derived(model.options.disabled === true);
  const label = $derived(
    typeof model.options.label === "string" ? model.options.label : "Files",
  );
  async function chooseVault() {
    const token = ++request;
    selectedPaths = [];
    available = [];
    open = true;
    const files = await model.list();
    if (!disposed && token === request && open) available = files;
  }
  function close() {
    open = false;
    request++;
    chooseButton?.focus();
  }
  function commit() {
    if (!disabled && !model.disposed)
      model.addVault(
        selectedPaths
          .map((path) => available.find((file) => file.path === path))
          .filter((file): file is NotebookVaultFile => Boolean(file)),
      );
    close();
  }
  onDestroy(() => {
    disposed = true;
    request++;
  });
</script>

<Field.Field
  class="notebook-input-control notebook-input-control__file"
  data-labelled={Boolean(model.options.label)}
  data-invalid={Boolean(view.error)}
  data-disabled={disabled}
>
  {#if model.options.label}<Field.Label for={id}
      ><NodeContent value={model.options.label} /></Field.Label
    >{/if}
  <div class="notebook-input-control__file-actions">
    <Button
      bind:ref={chooseButton}
      variant="outline"
      disabled={disabled || !model.canChooseVault}
      onclick={chooseVault}
      ><FolderOpen data-icon="inline-start" />Choose from vault</Button
    >
    <Button variant="outline" {disabled} onclick={() => upload?.click()}
      ><Upload data-icon="inline-start" />Upload files</Button
    >
    <span class="notebook-input-control__upload-native">
      <input
        bind:this={upload}
        {id}
        type="file"
        aria-invalid={Boolean(view.error)}
        aria-label={`${label} browser upload`}
        accept={model.options.accept}
        multiple={Boolean(model.options.multiple)}
        required={Boolean(model.options.required && !view.selected.length)}
        capture={model.options.capture}
        {disabled}
        onchange={(event) => {
          event.stopPropagation();
          model.addUploads(Array.from(event.currentTarget.files ?? []));
          event.currentTarget.value = "";
        }}
      />
    </span>
  </div>
  {#if view.selected.length}
    <ul
      class="notebook-input-control__files"
      aria-label={`${label} selected files`}
    >
      {#each view.selected as file, index}
        <li class="notebook-input-control__file-row">
          <FileTypeIcon
            path={file.path ?? file.name}
            size="md"
            class="notebook-input-control__file-icon"
          /><span class="notebook-input-control__file-name"
            >{file.name}<small
              >{file.path ?? `Temporary upload ${index + 1}`}</small
            ></span
          ><Badge
            variant={file.source === "vault" ? "secondary" : "default"}
            data-file-source={file.source}
            >{file.source === "vault" ? "Vault" : "Upload"}</Badge
          ><Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${file.name} (${file.source} ${index + 1})`}
            {disabled}
            onclick={() => model.remove(index)}><X /></Button
          >
        </li>
      {/each}
    </ul>
  {:else}<Field.Description>No file selected.</Field.Description>{/if}
  {#if view.needsReselection && !view.error}<Field.Description
      >Temporary uploads need to be selected again.</Field.Description
    >{/if}
  {#if view.error}<Field.Error>{view.error}</Field.Error>{/if}

  <Dialog.Root
    bind:open
    onOpenChange={(value) => {
      if (!value) request++;
    }}
  >
    <Dialog.Content
      class="notebook-input-control__file-dialog"
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        chooseButton?.focus();
      }}
    >
      <Dialog.Header
        ><Dialog.Title>Choose from vault</Dialog.Title><Dialog.Description
          >Select {model.options.multiple ? "files" : "a file"} for {label}.
          Existing files are referenced, not copied.</Dialog.Description
        ></Dialog.Header
      >
      <Command.Root>
        <Command.Input
          placeholder="Search vault files…"
          aria-label="Search vault files"
        />
        <Command.List>
          <Command.Empty
            >{view.pending
              ? "Loading files…"
              : "No matching files"}</Command.Empty
          >
          <Command.Group heading="Vault files">
            {#each available as file (file.path)}
              <Command.Item
                value={file.path}
                {disabled}
                onSelect={() => {
                  selectedPaths = model.options.multiple
                    ? selectedPaths.includes(file.path)
                      ? selectedPaths.filter((path) => path !== file.path)
                      : [...selectedPaths, file.path]
                    : [file.path];
                }}
              >
                <FileTypeIcon path={file.path} size="md" />
                <span class="notebook-input-control__vault-path"
                  >{file.path}</span
                >{#if selectedPaths.includes(file.path)}<Badge
                    variant="secondary">Selected</Badge
                  >{/if}
              </Command.Item>
            {/each}
          </Command.Group>
        </Command.List>
      </Command.Root>
      <Dialog.Footer
        ><Button variant="outline" onclick={close}>Cancel</Button><Button
          disabled={disabled || !selectedPaths.length}
          onclick={commit}
          >Add {selectedPaths.length === 1 ? "file" : "files"}</Button
        ></Dialog.Footer
      >
    </Dialog.Content>
  </Dialog.Root>
</Field.Field>
