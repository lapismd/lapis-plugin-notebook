import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  label,
  workspace,
  leaseReleaseAllowed,
  stoppedRunState,
} from "./model.mjs";
import { output, docker, saveLogs, receiveDirectory } from "./docker.mjs";

export const activeOwnedRuns = (config, root) =>
  output(config, [
    "ps",
    "-q",
    "--filter",
    `label=${label}=run`,
    "--filter",
    `label=${label}.workspace=${workspace(root)}`,
  ])
    .split("\n")
    .filter(Boolean);

export async function collect(config, root, run) {
  if (
    !/^lapis-notebook-run-[a-f0-9-]{36}$/.test(run) ||
    output(config, [
      "inspect",
      run,
      "--format",
      `{{index .Config.Labels "${label}.workspace"}}`,
    ]) !== workspace(root)
  )
    throw Error("Refusing a validation run owned by another checkout");
  const directory = join(root, ".local/validation/runs", run);
  await mkdir(directory, { recursive: true });
  await receiveDirectory(config, ["cp", `${run}:/results/.`, "-"], directory);
  await saveLogs(config, run, join(directory, "console.log"));
  const result = JSON.parse(
    await readFile(join(directory, "result.json"), "utf8"),
  );
  if (result.schema !== 1 || result.run !== run)
    throw Error("Collected report identity mismatch");
  if (result.collectionError) throw Error(result.collectionError);
  return result;
}
export async function clean(config, root, apply = false) {
  const ids = output(config, [
    "ps",
    "-aq",
    "--filter",
    `label=${label}=run`,
    "--filter",
    `label=${label}.workspace=${workspace(root)}`,
  ])
    .split("\n")
    .filter(Boolean);
  const stopped = ids.filter((id) =>
    stoppedRunState(
      output(config, ["inspect", id, "--format", "{{.State.Status}}"]),
    ),
  );
  const names = new Map(
    stopped.map((id) => [
      id,
      output(config, ["inspect", id, "--format", "{{.Name}}"]).replace(
        /^\//,
        "",
      ),
    ]),
  );
  const leases = output(config, [
    "ps",
    "-aq",
    "--filter",
    `label=${label}=lease`,
    "--filter",
    `label=${label}.workspace=${workspace(root)}`,
  ])
    .split("\n")
    .filter(Boolean);
  const releasable = [];
  if (leaseReleaseAllowed(activeOwnedRuns(config, root)))
    for (const id of leases) {
      const run = output(config, [
        "inspect",
        id,
        "--format",
        `{{index .Config.Labels "${label}.run"}}`,
      ]);
      if (!/^lapis-notebook-run-[a-f0-9-]{36}$/.test(run)) continue;
      let finished = [...names.values()].includes(run);
      if (!finished) {
        try {
          const result = JSON.parse(
            await readFile(
              join(root, ".local/validation/runs", run, "result.json"),
              "utf8",
            ),
          );
          finished =
            result.schema === 1 &&
            result.run === run &&
            result.finished &&
            ["passed", "failed"].includes(result.status);
        } catch (error) {
          if (error.code !== "ENOENT") throw error;
        }
      }
      if (finished) releasable.push(id);
    }
  console.log({ stoppedRuns: stopped, releasableLeases: releasable, apply });
  if (apply) {
    for (const [id, run] of names) {
      await collect(config, root, run);
      await docker(config, ["rm", id]);
    }
    if (leaseReleaseAllowed(activeOwnedRuns(config, root)))
      for (const id of releasable) await docker(config, ["rm", id]);
  }
}
