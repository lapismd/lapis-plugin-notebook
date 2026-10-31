<script lang="ts">
  import type { App } from "@lapis-notes/api";
  import type { NotebookOutput } from "../output";
  import CodeOutput from "./renderers/code-output.svelte";
  import TableOutput from "./renderers/table-output.svelte";
  import ChartOutput from "./renderers/chart-output.svelte";
  import MarkdownOutput from "./renderers/markdown-output.svelte";
  import HtmlOutput from "./renderers/html-output.svelte";
  import InputOutput from "./renderers/input-output.svelte";
  import DomOutput from "./renderers/dom-output.svelte";
  import ErrorOutput from "./renderers/error-output.svelte";
  import { stringifyNotebookValue } from "./stringify-notebook-value";

  type Props = {
    app: App;
    sourcePath: string;
    outputs: NotebookOutput[];
    embedded?: boolean;
  };

  let { app, sourcePath, outputs, embedded = false }: Props = $props();
</script>

<div class="notebook-output" data-notebook-output-root>
  {#each outputs as output, index (output.kind === "input" ? `${output.cellId}:${output.variableName}` : output.kind === "dom" ? output.outputId : index)}
    {#if output.kind === "code"}
      <CodeOutput {output} />
    {:else if output.kind === "table"}
      <TableOutput {output} />
    {:else if output.kind === "chart"}
      <ChartOutput {output} />
    {:else if output.kind === "markdown"}
      <MarkdownOutput {app} {sourcePath} {output} />
    {:else if output.kind === "html"}
      <HtmlOutput {output} />
    {:else if output.kind === "input"}
      <InputOutput {sourcePath} {output} {embedded} />
    {:else if output.kind === "dom"}
      <DomOutput {output} />
    {:else if output.kind === "error"}
      <ErrorOutput {output} />
    {:else if output.kind === "image"}
      <img
        alt="Notebook output"
        class="notebook-output__image"
        src={`data:${output.mime};base64,${output.data}`}
      />
    {:else if output.kind === "text"}
      <div class="notebook-output__text">{output.text}</div>
    {:else}
      <pre class="notebook-output__fallback">{stringifyNotebookValue(
          output,
        )}</pre>
    {/if}
  {/each}
</div>
