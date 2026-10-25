import { execFileSync } from "node:child_process";
import { writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  imageKey,
  imageInputs,
  cacheKeys,
  workerArguments,
  label,
  workspace,
  leaseReleaseAllowed,
} from "./model.mjs";
import { activeOwnedRuns, collect } from "./reports.mjs";
import { output, docker, sendDirectory } from "./docker.mjs";
import { snapshot } from "./source.mjs";

export const revision = (root) =>
  execFileSync("jj", ["log", "-r", "@", "--no-graph", "-T", "commit_id"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
const snapshotFile = (root, commit, path) =>
  execFileSync("jj", ["file", "show", "-r", commit, "--", path], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
  });
export async function image(
  config,
  root,
  commit = revision(root),
  rebuild = false,
) {
  const files = new Map();
  for (const path of [
    "scripts/validation/Dockerfile",
    "scripts/validation/install-tools.mjs",
    "package.json",
    "pnpm-lock.yaml",
  ]) {
    const bytes = snapshotFile(root, commit, path);
    files.set(path, bytes);
  }
  const inputs = imageInputs({
    recipe: files.get("scripts/validation/Dockerfile"),
    installer: files.get("scripts/validation/install-tools.mjs"),
    packageJson: files.get("package.json"),
    lock: files.get("pnpm-lock.yaml"),
    architecture: output(config, ["info", "--format", "{{.Architecture}}"]),
  });
  const key = imageKey(inputs);
  const tag = `lapis-notebook-validation:${key}`;
  try {
    if (!rebuild)
      return {
        tag,
        key,
        playwright: inputs.playwright,
        id: output(config, ["image", "inspect", tag, "--format", "{{.Id}}"]),
        inputs,
      };
  } catch {
    /* Build a missing immutable fingerprint. Never fall back to the host. */
  }
  const directory = await mkdtemp(join(tmpdir(), "lapis-notebook-image-"));
  try {
    await writeFile(
      join(directory, "Dockerfile"),
      files.get("scripts/validation/Dockerfile"),
    );
    await writeFile(
      join(directory, "install-tools.mjs"),
      files.get("scripts/validation/install-tools.mjs"),
    );
    await sendDirectory(
      config,
      [
        "build",
        "--label",
        `${label}=image`,
        "--build-arg",
        `PLAYWRIGHT_VERSION=${inputs.playwright}`,
        "--build-arg",
        `PNPM_VERSION=${inputs.packageManager.slice("pnpm@".length)}`,
        "-t",
        tag,
        ...(rebuild ? ["--no-cache"] : []),
        "-",
      ],
      directory,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  return {
    tag,
    key,
    playwright: inputs.playwright,
    id: output(config, ["image", "inspect", tag, "--format", "{{.Id}}"]),
    inputs,
  };
}
export async function remoteRun(config, root, lane, args) {
  const directory = await mkdtemp(join(tmpdir(), "lapis-notebook-source-"));
  const run = `lapis-notebook-run-${randomUUID()}`,
    owner = workspace(root),
    lease = `lapis-notebook-lease-${owner}`;
  let leaseId;
  try {
    const source = await snapshot(root, directory, config.archives);
    const selected = await image(config, root, source.revision);
    const caches = cacheKeys({
      image: selected.inputs,
      lock: snapshotFile(root, source.revision, "pnpm-lock.yaml"),
      archives: source.archives,
    });
    const request = {
      run,
      lane,
      args,
      image: selected,
      caches,
      resources: {
        cpus: config.cpus,
        memoryGiB: config.memoryGiB,
        shmGiB: config.shmGiB,
      },
    };
    await writeFile(
      join(directory, "request.json"),
      JSON.stringify(request, null, 2),
    );
    for (const file of ["worker.mjs", "model.mjs", "docker.mjs", "source.mjs"])
      await writeFile(
        join(directory, file),
        snapshotFile(root, source.revision, `scripts/validation/${file}`),
      );
    const report = join(root, ".local/validation/runs", run);
    await mkdir(report, { recursive: true });
    await writeFile(
      join(report, "request.json"),
      JSON.stringify({ ...request, source }, null, 2),
    );
    leaseId = output(config, [
      "create",
      "--name",
      lease,
      "--label",
      `${label}=lease`,
      "--label",
      `${label}.workspace=${owner}`,
      "--label",
      `${label}.run=${run}`,
      "--entrypoint",
      "true",
      selected.tag,
    ]);
    const cache = `lapis-notebook-rust-${caches.rust}`;
    const dependencies = `lapis-notebook-dependencies-${caches.pnpm}`;
    for (const name of [cache, dependencies])
      await docker(config, [
        "volume",
        "create",
        "--label",
        `${label}=cache`,
        name,
      ]);
    await docker(
      config,
      workerArguments(config, {
        run,
        owner,
        cache,
        dependencies,
        image: selected.tag,
      }),
    );
    await sendDirectory(config, ["cp", "-", `${run}:/input`], directory);
    let failure;
    try {
      await docker(config, ["start", "--attach", run]);
    } catch (error) {
      failure = error;
    }
    const result = await collect(config, root, run);
    console.log(`Validation ${result.status}: ${report}`);
    if (failure || result.status !== "passed")
      throw failure ?? Error(`Validation failed: ${result.error ?? run}`);
    await docker(config, ["rm", run]);
    return result;
  } finally {
    try {
      if (leaseId) {
        let active = null;
        try {
          active = activeOwnedRuns(config, root);
        } catch {
          /* A transport failure is not evidence that the worker stopped. */
        }
        if (leaseReleaseAllowed(active)) await docker(config, ["rm", leaseId]);
        else
          console.warn(
            `Retaining ${lease}: worker state is active or unknown; collect and clean it after completion.`,
          );
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}
