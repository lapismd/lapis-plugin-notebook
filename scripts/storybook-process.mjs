#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_STORYBOOK_PORT = "7040";
export const STORYBOOK_LOCAL_ENV_FILE = ".env.storybook.local";

function normalizedRoot(root) {
  const resolved = path.resolve(root);
  return existsSync(resolved) ? realpathSync(resolved) : resolved;
}

function unquote(value) {
  if (value.length < 2) return value;
  const quote = value[0];
  if ((quote !== '"' && quote !== "'") || value.at(-1) !== quote) return value;
  const inner = value.slice(1, -1);
  if (quote === "'") return inner;
  return inner
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "\r")
    .replaceAll("\\t", "\t")
    .replaceAll('\\"', '"')
    .replaceAll("\\\\", "\\");
}

export function parseStorybookLocalEnv(contents) {
  const values = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const assignment = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separator = assignment.indexOf("=");
    if (separator < 1) continue;
    const key = assignment.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    values[key] = unquote(assignment.slice(separator + 1).trim());
  }
  return values;
}

export function applyStorybookLocalEnv(values, env = process.env) {
  const loaded = [];
  for (const [key, value] of Object.entries(values)) {
    if (Object.hasOwn(env, key)) continue;
    env[key] = value;
    loaded.push(key);
  }
  return loaded;
}

export function loadStorybookLocalEnv({
  root = process.cwd(),
  env = process.env,
} = {}) {
  const filePath = path.join(root, STORYBOOK_LOCAL_ENV_FILE);
  if (!existsSync(filePath)) return [];
  return applyStorybookLocalEnv(
    parseStorybookLocalEnv(readFileSync(filePath, "utf8")),
    env,
  );
}

export function resolveStorybookLane({ root, env = process.env } = {}) {
  const checkoutRoot = normalizedRoot(
    root ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  );
  const port = String(env.STORYBOOK_PORT ?? DEFAULT_STORYBOOK_PORT);
  const portNumber = Number(port);
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65_535) {
    throw new Error(`Invalid STORYBOOK_PORT: ${port}`);
  }
  return {
    root: checkoutRoot,
    port,
    ownerPath: path.join(
      checkoutRoot,
      ".cache",
      "storybook",
      "supervisors",
      `${port}.json`,
    ),
  };
}

export function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function processCwd(pid) {
  try {
    const output = execFileSync(
      "lsof",
      ["-a", "-p", String(pid), "-d", "cwd", "-Fn"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      },
    );
    const cwd = output
      .split("\n")
      .find((line) => line.startsWith("n"))
      ?.slice(1);
    return cwd ? normalizedRoot(cwd) : null;
  } catch {
    return null;
  }
}

export function parseProcessTable(output) {
  return output
    .split("\n")
    .map((line) => line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/))
    .filter(Boolean)
    .map((match) => ({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      command: match[3],
    }));
}

export function listProcesses() {
  try {
    return parseProcessTable(
      execFileSync("ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8" }),
    );
  } catch {
    return [];
  }
}

export function descendantPids(processes, parentPids) {
  const found = new Set(parentPids);
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of processes) {
      if (found.has(entry.ppid) && !found.has(entry.pid)) {
        found.add(entry.pid);
        changed = true;
      }
    }
  }
  return [...found];
}

export function listenerPids(port) {
  try {
    return execFileSync("lsof", [`-tiTCP:${port}`, "-sTCP:LISTEN"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(Number);
  } catch {
    return [];
  }
}

export function partitionCheckoutListeners(lane, pids, cwdForPid = processCwd) {
  const owned = [];
  const foreign = [];
  for (const pid of pids) {
    const cwd = cwdForPid(pid);
    (cwd === lane.root ? owned : foreign).push({ pid, cwd });
  }
  return { owned, foreign };
}

function readOwner(lane) {
  try {
    const owner = JSON.parse(readFileSync(lane.ownerPath, "utf8"));
    if (
      owner?.version !== 1 ||
      owner.root !== lane.root ||
      owner.port !== lane.port
    ) {
      return null;
    }
    return owner;
  } catch {
    return null;
  }
}

export function readStorybookOwner(lane) {
  return readOwner(lane);
}

export function writeStorybookOwner(lane, owner, { exclusive = false } = {}) {
  mkdirSync(path.dirname(lane.ownerPath), { recursive: true });
  const fd = openSync(lane.ownerPath, exclusive ? "wx" : "w");
  try {
    writeFileSync(fd, `${JSON.stringify(owner, null, 2)}\n`);
  } finally {
    closeSync(fd);
  }
}

export function releaseStorybookOwner(lane, supervisorPid) {
  const owner = readOwner(lane);
  if (owner && owner.supervisorPid !== supervisorPid) return false;
  try {
    unlinkSync(lane.ownerPath);
    return true;
  } catch {
    return false;
  }
}

export async function terminateProcessTrees(
  roots,
  { processes = listProcesses(), graceMs = 700 } = {},
) {
  const targets = descendantPids(processes, roots)
    .filter((pid) => pid !== process.pid)
    .reverse();
  for (const pid of targets) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // The process already exited.
    }
  }
  if (targets.length === 0) return;
  await new Promise((resolve) => setTimeout(resolve, graceMs));
  for (const pid of targets) {
    if (!processIsAlive(pid)) continue;
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // The process exited during the grace period.
    }
  }
}

export async function stopStorybookLane(lane = resolveStorybookLane()) {
  const listeners = partitionCheckoutListeners(lane, listenerPids(lane.port));
  if (listeners.foreign.length > 0) {
    const details = listeners.foreign
      .map(
        ({ pid, cwd }) => `pid ${pid}${cwd ? ` (${cwd})` : " (unknown cwd)"}`,
      )
      .join(", ");
    throw new Error(
      `Refusing to stop another checkout's listener on :${lane.port}: ${details}`,
    );
  }

  const owner = readOwner(lane);
  const roots = new Set(listeners.owned.map(({ pid }) => pid));
  if (
    owner?.supervisorPid &&
    processIsAlive(owner.supervisorPid) &&
    processCwd(owner.supervisorPid) === lane.root
  ) {
    roots.add(owner.supervisorPid);
  }
  await terminateProcessTrees([...roots]);
  releaseStorybookOwner(lane, owner?.supervisorPid);
  if (roots.size > 0) {
    console.log(`[storybook-stop] stopped ${lane.root} :${lane.port}`);
  } else {
    console.log(
      `[storybook-stop] nothing running for ${lane.root} :${lane.port}`,
    );
  }
}

if (
  process.argv[1] === fileURLToPath(import.meta.url) &&
  process.argv[2] === "stop"
) {
  loadStorybookLocalEnv({
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  });
  await stopStorybookLane();
}
