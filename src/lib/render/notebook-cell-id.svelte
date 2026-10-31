<script lang="ts">
  import { tick } from "svelte";
  import type { App } from "@lapis-notes/api";
  import { renameNotebookCellId } from "./notebook-cell-source";

  let {
    app,
    cellId,
    sourcePath,
    disabled = false,
    onRename,
  }: {
    app: App;
    cellId: string;
    sourcePath: string;
    disabled?: boolean;
    onRename?: (id: string) => void;
  } = $props();
  let editing = $state(false);
  let value = $state("");
  let error = $state("");
  let saving = $state(false);
  let input = $state<HTMLInputElement>();
  let button = $state<HTMLButtonElement>();
  const errorId = $props.id();

  async function edit() {
    value = cellId;
    error = "";
    editing = true;
    await tick();
    input?.focus();
    input?.select();
  }

  async function cancel() {
    editing = false;
    error = "";
    await tick();
    button?.focus();
  }

  async function save() {
    if (!editing || saving) return;
    if (value === cellId) {
      await cancel();
      return;
    }
    saving = true;
    error = "";
    try {
      const file = app.vault.getFileByPath(sourcePath);
      if (!file) throw new Error("The notebook is no longer available.");
      await app.vault.process(file, (source) =>
        renameNotebookCellId(source, cellId, value),
      );
      editing = false;
      onRename?.(value);
    } catch (cause) {
      error =
        cause instanceof Error ? cause.message : "Unable to update cell ID.";
    } finally {
      saving = false;
    }
  }
</script>

<div class="notebook-cell__id" class:notebook-cell__id--editing={editing}>
  {#if editing}
    <input
      bind:this={input}
      bind:value
      class="notebook-cell__id-input"
      aria-label="Cell ID"
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      disabled={saving}
      autocomplete="off"
      spellcheck="false"
      onblur={() => void save()}
      onkeydown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          void save();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          void cancel();
        }
      }}
    />
    {#if error}<span id={errorId} class="notebook-cell__id-error" role="alert"
        >{error}</span
      >{/if}
  {:else}
    <button
      bind:this={button}
      type="button"
      class="notebook-cell__id-button"
      {disabled}
      aria-label={`Rename cell ${cellId}`}
      title={`Rename cell ${cellId}`}
      onclick={(event) => {
        event.stopPropagation();
        void edit();
      }}>{cellId}</button
    >
  {/if}
</div>
