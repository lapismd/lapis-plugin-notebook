import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { execute } from "./validation/docker.mjs";

// Resolve through the actual browser provider, never a globally installed CLI.
const require = createRequire(
  import.meta.resolve("@vitest/browser-playwright/package.json"),
);
const cli = join(dirname(require.resolve("playwright/package.json")), "cli.js");
await execute(process.execPath, [cli, "install", "chromium"]);
