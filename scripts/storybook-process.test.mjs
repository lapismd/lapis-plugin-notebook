import { describe, expect, it } from "vitest";
import {
  DEFAULT_STORYBOOK_PORT,
  applyStorybookLocalEnv,
  descendantPids,
  parseStorybookLocalEnv,
  partitionCheckoutListeners,
  resolveStorybookLane,
} from "./storybook-process.mjs";

describe("Storybook process ownership", () => {
  it("parses checkout-local Storybook settings", () => {
    expect(
      parseStorybookLocalEnv(`
        # checkout-specific lane
        STORYBOOK_PORT=7120
        export WATCHPACK_POLLING="500"
        INVALID-KEY=ignored
      `),
    ).toEqual({ STORYBOOK_PORT: "7120", WATCHPACK_POLLING: "500" });
  });

  it("preserves explicit shell values while loading missing settings", () => {
    const env = { STORYBOOK_PORT: "7040" };
    expect(
      applyStorybookLocalEnv(
        { STORYBOOK_PORT: "7120", WATCHPACK_POLLING: "500" },
        env,
      ),
    ).toEqual(["WATCHPACK_POLLING"]);
    expect(env).toEqual({ STORYBOOK_PORT: "7040", WATCHPACK_POLLING: "500" });
  });

  it("defaults to the Notebook plugin lane and validates overrides", () => {
    expect(resolveStorybookLane({ root: process.cwd(), env: {} }).port).toBe(
      DEFAULT_STORYBOOK_PORT,
    );
    expect(
      resolveStorybookLane({
        root: process.cwd(),
        env: { STORYBOOK_PORT: "7120" },
      }).port,
    ).toBe("7120");
    expect(() =>
      resolveStorybookLane({
        root: process.cwd(),
        env: { STORYBOOK_PORT: "invalid" },
      }),
    ).toThrow("Invalid STORYBOOK_PORT");
  });

  it("separates this checkout's listeners from foreign processes", () => {
    const lane = resolveStorybookLane({ root: process.cwd(), env: {} });
    expect(
      partitionCheckoutListeners(lane, [10, 20], (pid) =>
        pid === 10 ? lane.root : "/tmp/another-checkout",
      ),
    ).toEqual({
      owned: [{ pid: 10, cwd: lane.root }],
      foreign: [{ pid: 20, cwd: "/tmp/another-checkout" }],
    });
  });

  it("collects complete process trees for supervised shutdown", () => {
    expect(
      descendantPids(
        [
          { pid: 11, ppid: 10, command: "child" },
          { pid: 12, ppid: 11, command: "grandchild" },
          { pid: 20, ppid: 1, command: "foreign" },
        ],
        [10],
      ),
    ).toEqual([10, 11, 12]);
  });
});
