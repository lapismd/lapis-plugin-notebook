import { afterAll, afterEach } from "vitest";
import { installFatalStorybookRuntimeWarningGuard } from "../scripts/storybook-runtime-warnings.mjs";

// Install before story hooks; caught unmount diagnostics must still fail.
const runtimeGuard = installFatalStorybookRuntimeWarningGuard();
afterEach(() => runtimeGuard.assertClean());
afterAll(() => {
  try {
    runtimeGuard.assertClean();
  } finally {
    runtimeGuard.dispose();
  }
});
