import { createHash } from "node:crypto";
import { join } from "node:path";

export const label = "dev.lapismd.lapis-notebook.validation";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const workspace = (root) => hash(root).slice(0, 16);
export const leaseReleaseAllowed = (active) =>
  Array.isArray(active) && active.length === 0;
export const stoppedRunState = (state) => ["exited", "dead"].includes(state);
export const imageKey = (inputs) =>
  hash(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(inputs).sort(([a], [b]) => a.localeCompare(b)),
      ),
    ),
  ).slice(0, 20);
export function imageInputs({
  recipe,
  installer,
  packageJson,
  lock,
  architecture,
}) {
  const versions = [
    ...new Set(
      [...lock.toString().matchAll(/^  playwright@([0-9][^:]*):$/gm)].map(
        (match) => match[1],
      ),
    ),
  ];
  if (versions.length !== 1 || !/^\d+\.\d+\.\d+$/.test(versions[0]))
    throw Error("Exactly one locked Playwright version is required");
  const packageManager = JSON.parse(packageJson).packageManager;
  if (!/^pnpm@\d+\.\d+\.\d+$/.test(packageManager ?? ""))
    throw Error("Exactly pinned pnpm packageManager is required");
  const toolchain = recipe.toString().match(/^FROM (rust:\S+) AS rust$/m)?.[1];
  if (!toolchain) throw Error("Pinned Rust toolchain recipe is missing");
  return {
    "scripts/validation/Dockerfile": hash(recipe),
    "scripts/validation/install-tools.mjs": hash(installer),
    playwright: versions[0],
    packageManager,
    toolchain,
    architecture,
  };
}
export function cacheKeys({ image, lock, cargoManifest, cargoLock, archives }) {
  return {
    pnpm: imageKey({
      image: imageKey(image),
      lock: hash(lock),
      archives: archives
        .map(({ name, version, sha256 }) => ({ name, version, sha256 }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }),
    rust: imageKey({
      recipe: image["scripts/validation/Dockerfile"],
      toolchain: image.toolchain,
      architecture: image.architecture,
      manifest: hash(cargoManifest ?? ""),
      lock: hash(cargoLock ?? ""),
    }),
  };
}
export function validationConfig(local = {}, env = process.env) {
  const config = {
    runtime: "docker",
    cpus: 4,
    memoryGiB: 12,
    shmGiB: 2,
    ...local,
  };
  config.runtime = env.LAPIS_NOTEBOOK_VALIDATION_RUNTIME ?? config.runtime;
  config.context = env.LAPIS_NOTEBOOK_VALIDATION_CONTEXT ?? config.context;
  config.archives = env.LAPIS_NOTEBOOK_VALIDATION_ARCHIVES ?? config.archives;
  if (!["docker", "native"].includes(config.runtime))
    throw Error("Invalid validation runtime");
  if (
    config.transport !== undefined &&
    !["docker", "ssh-cli"].includes(config.transport)
  )
    throw Error("Invalid Docker transport");
  if (
    config.context !== undefined &&
    (typeof config.context !== "string" || !config.context.trim())
  )
    throw Error("Invalid Docker context");
  for (const key of ["cpus", "memoryGiB", "shmGiB"])
    if (!Number.isFinite(config[key]) || config[key] <= 0)
      throw Error(`Invalid ${key}`);
  return config;
}
export function nativeInvocation(lanes, lane, args, root, env = process.env) {
  if (!Object.hasOwn(lanes, lane))
    throw Error(`Unknown validation lane: ${lane}`);
  return {
    command: "/bin/sh",
    args: ["-c", lanes[lane] + ' "$@"', "validation", ...args],
    env: {
      ...env,
      LAPIS_NOTEBOOK_VALIDATION_RUNTIME: "native",
      PATH: join(root, "node_modules/.bin") + ":" + (env.PATH ?? ""),
    },
  };
}
export function browserInvocations(args, fileCount = Number.POSITIVE_INFINITY) {
  if (args.length) return [[...args]];
  const shards = Math.max(1, Math.min(3, fileCount));
  return shards === 1
    ? [[]]
    : Array.from({ length: shards }, (_, index) => [
        `--shard=${index + 1}/${shards}`,
      ]);
}
export function auditRouting(scripts, lanes) {
  const findings = [];
  const native = {
    storybook:
      "WATCHPACK_POLLING=250 node scripts/storybook-run.mjs --no-open --config-dir .storybook",
    "storybook:stop": "bash scripts/storybook-stop.sh",
    "storybook:restart": "bash scripts/storybook-restart.sh",
    validation: "node scripts/validation.mjs",
    "validation:doctor": "node scripts/validation.mjs doctor",
    "validation:images": "node scripts/validation.mjs images",
    "validation:clean": "node scripts/validation.mjs clean",
  };
  for (const [name, command] of Object.entries(scripts))
    if (!Object.hasOwn(lanes, name) && native[name] !== command)
      findings.push(
        `Script ${name} needs a registered Docker lane or an explicitly reviewed native bootstrap/development exception`,
      );
  for (const name of Object.keys(lanes))
    if (scripts[name] !== `node scripts/validation.mjs run ${name}`)
      findings.push(
        `Portable script ${name} must route through the fail-closed Docker runner`,
      );
  return findings;
}
export async function dispatch(config, native, docker) {
  return config.runtime === "native" ? native() : docker();
}

export function workerArguments(
  config,
  { run, owner, cache, dependencies, image },
) {
  return [
    "create",
    "--name",
    run,
    "--label",
    `${label}=run`,
    "--label",
    `${label}.workspace=${owner}`,
    "--init",
    "--cap-drop=ALL",
    "--cpus",
    String(config.cpus),
    "--memory",
    `${config.memoryGiB}g`,
    "--shm-size",
    `${config.shmGiB}g`,
    "--mount",
    `type=volume,src=${cache},dst=/cache`,
    "--mount",
    `type=volume,src=${dependencies},dst=/cache/pnpm`,
    "--env",
    "NODE_OPTIONS=--max-old-space-size=6144",
    "--entrypoint",
    "node",
    image,
    "/input/worker.mjs",
  ];
}
