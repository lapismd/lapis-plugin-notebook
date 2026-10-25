import type { NotebookChartOutput, NotebookOutput } from "../output";

export function resolveOutputRenderer(output: NotebookOutput): string {
  if (output.kind === "chart") {
    return resolveChartRenderer(output);
  }

  if (output.kind === "dom") {
    return "dom";
  }

  return output.kind;
}

function resolveChartRenderer(output: NotebookChartOutput): string {
  return output.library === "vega-lite" ? "chart" : "text";
}
