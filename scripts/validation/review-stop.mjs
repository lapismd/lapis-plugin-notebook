import { output, docker } from "./docker.mjs";
import { label, workspace } from "./model.mjs";
export async function stopReview(config, root) {
  const lines = output(config, [
    "ps",
    "--filter",
    `label=${label}=run`,
    "--filter",
    `label=${label}.workspace=${workspace(root)}`,
    "--format",
    "{{.Names}}",
  ]);
  for (const name of lines.split("\n").filter(Boolean)) {
    const request = JSON.parse(
      output(config, ["exec", name, "cat", "/input/request.json"]),
    );
    if (request.lane === "storybook:review")
      await docker(config, ["stop", "--time", "20", name]);
  }
}
