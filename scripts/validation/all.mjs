import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runNative } from "../validation.mjs";

export const aggregateLanes = Object.freeze([
  "check",
  "test",
  "build",
  "publint",
  "build-storybook",
  "test:storybook",
  "spec:check",
]);

/** The outer Docker runner owns the one snapshot, lease and installation. */
export async function runAll(executeLane = runNative, args = []) {
  if (args.length)
    throw Error("validation:all accepts no selectors; use an individual lane");
  for (const lane of aggregateLanes) await executeLane(lane);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    if (process.env.LAPIS_NOTEBOOK_VALIDATION_RUNTIME !== "native")
      throw Error("Use pnpm validation:all; direct native execution is explicit");
    await runAll(runNative, process.argv.slice(2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
