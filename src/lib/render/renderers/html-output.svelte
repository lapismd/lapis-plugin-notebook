<script lang="ts">
  import type { NotebookHtmlOutput } from "../../output";

  type Props = {
    output: NotebookHtmlOutput;
  };

  let { output }: Props = $props();
</script>

<div
  class="notebook-output__html"
  data-notebook-output="html"
>
  {@html output.html}
</div>
