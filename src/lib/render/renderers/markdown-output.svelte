<script lang="ts">
  import { MarkdownEmbed } from "@lapis-notes/markdown";
  import type { App } from "@lapis-notes/api";
  import type { NotebookMarkdownOutput } from "../../output";

  type Props = {
    app: App;
    sourcePath: string;
    output: NotebookMarkdownOutput;
  };

  let { app, sourcePath, output }: Props = $props();
</script>

<div class="notebook-output__markdown">
  <div class="notebook-output__markdown-body">
    <MarkdownEmbed
      {app}
      value={output.markdown}
      {sourcePath}
      htmlPolicy="trusted"
      surface={{ id: "notebook-output" }}
    />
  </div>
</div>
