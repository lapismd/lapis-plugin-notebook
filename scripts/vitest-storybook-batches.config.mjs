import config from "../vite.config.ts";

// Apply the bound to the browser project itself. Root CLI worker options are
// insufficient for this nested Storybook project on the current Vitest version.
const storybook = config.test.projects.find(
  (project) => project.test.name === "storybook",
);
storybook.test.maxWorkers = 1;
storybook.test.fileParallelism = false;

export default config;
