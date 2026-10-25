#!/usr/bin/env node
import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  listenerPids,
  loadStorybookLocalEnv,
  partitionCheckoutListeners,
  processCwd,
  processIsAlive,
  readStorybookOwner,
  releaseStorybookOwner,
  resolveStorybookLane,
  stopStorybookLane,
  terminateProcessTrees,
  writeStorybookOwner,
} from "./storybook-process.mjs";

loadStorybookLocalEnv({
  root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
});
const lane = resolveStorybookLane();

if (process.env.STORYBOOK_REPLACE === "1") {
  await stopStorybookLane(lane);
}

const existing = readStorybookOwner(lane);
if (
  existing?.supervisorPid &&
  processIsAlive(existing.supervisorPid) &&
  processCwd(existing.supervisorPid) === lane.root
) {
  const child = existing.childPid ? ` (Storybook ${existing.childPid})` : "";
  console.log(
    `[storybook-run] already running for ${lane.root} :${lane.port} as supervisor ${existing.supervisorPid}${child}`,
  );
  process.exit(0);
}

const listeners = partitionCheckoutListeners(lane, listenerPids(lane.port));
if (listeners.foreign.length > 0) {
  const details = listeners.foreign
    .map(({ pid, cwd }) => `pid ${pid}${cwd ? ` (${cwd})` : " (unknown cwd)"}`)
    .join(", ");
  throw new Error(
    `Refusing to replace another checkout's listener on :${lane.port}: ${details}`,
  );
}
if (listeners.owned.length > 0) {
  await terminateProcessTrees(listeners.owned.map(({ pid }) => pid));
}
releaseStorybookOwner(lane, existing?.supervisorPid);

const owner = {
  version: 1,
  root: lane.root,
  port: lane.port,
  supervisorPid: process.pid,
  childPid: null,
  startedAt: Date.now(),
};
try {
  writeStorybookOwner(lane, owner, { exclusive: true });
} catch (error) {
  if (error?.code === "EEXIST") {
    console.error(
      `[storybook-run] supervisor ownership already exists for :${lane.port}`,
    );
    process.exit(1);
  }
  throw error;
}

const require = createRequire(import.meta.url);
const storybookRoot = realpathSync(
  path.dirname(require.resolve("storybook/package.json")),
);
const dispatcher = path.join(storybookRoot, "dist", "bin", "dispatcher.js");
const child = spawn(
  process.execPath,
  [
    dispatcher,
    "dev",
    "-p",
    lane.port,
    "--exact-port",
    ...process.argv.slice(2),
  ],
  {
    cwd: lane.root,
    env: {
      ...process.env,
      STORYBOOK_PORT: lane.port,
      WATCHPACK_POLLING: process.env.WATCHPACK_POLLING ?? "250",
    },
    stdio: "inherit",
  },
);
writeStorybookOwner(lane, { ...owner, childPid: child.pid });

let stopping = false;
async function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  try {
    child.kill(signal);
  } catch {
    // The child already exited.
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => void stop(signal));
}

console.log(
  `[storybook-run] supervisor ${process.pid} owns ${lane.root} :${lane.port}`,
);

child.once("error", (error) => {
  console.error(`[storybook-run] could not start Storybook: ${error.message}`);
});

const result = await new Promise((resolve) => {
  child.once("exit", (code, signal) => resolve({ code, signal }));
});
releaseStorybookOwner(lane, process.pid);
process.exitCode = result.code ?? (result.signal && !stopping ? 1 : 0);
