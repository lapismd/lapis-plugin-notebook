import { spawn } from "node:child_process";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
if (!args.length) throw Error("Usage: run-turbo.mjs <task> [Turbo options]");
const env = {
  ...process.env,
  LAPIS_NOTEBOOK_CACHE_PLATFORM: `${process.platform}-${process.arch}-${process.version}`,
};
const remoteKeys = [
  "TURBO_API",
  "TURBO_TEAM",
  "TURBO_TOKEN",
  "TURBO_REMOTE_CACHE_SIGNATURE_KEY",
];
const remote = remoteKeys.every((key) => env[key]?.trim());
if (!remote) for (const key of remoteKeys) delete env[key];
console.log(
  `Turbo remote cache: ${remote ? "enabled (signed)" : "unavailable; using local/GitHub Actions task cache"}`,
);
process.exitCode = await new Promise((resolve, reject) => {
  const child = spawn(
    "pnpm",
    ["exec", "turbo", "run", ...args, "--concurrency=2", "--summarize"],
    { env, stdio: "inherit" },
  );
  child.once("error", reject);
  child.once("exit", (code) => resolve(code ?? 1));
});
