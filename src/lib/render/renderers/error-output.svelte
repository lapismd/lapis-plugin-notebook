<script lang="ts">
  import type { NotebookErrorOutput } from "../../output";

  type Props = {
    output: NotebookErrorOutput;
  };

  let { output }: Props = $props();
</script>

<div
  class="notebook-output__error"
  data-notebook-output="error"
>
  <div class="notebook-output__error-title">Execution error</div>
  <div class="notebook-output__error-message">
    {output.message}
  </div>
  {#if output.stack}
    <pre
      class="notebook-output__error-stack">{output.stack}</pre>
  {/if}
</div>
