<script lang="ts">
  import { CodeBlock } from "@lapismd/design-core/shadcn/code-block";
  import type { NotebookCodeOutput } from "../../output";
  let { output }: { output: NotebookCodeOutput } = $props();
</script>

<div class="notebook-output__code">
  <CodeBlock
    code={output.code}
    language={output.language}
    title={output.title}
    width="100%"
    highlightMode="spans"
  />
</div>
