import { describe, expect, it, vi } from "vitest";
import { aggregateLanes, runAll } from "./all.mjs";
import { dispatch, nativeInvocation, validationConfig } from "./model.mjs";

describe("aggregate Docker validation", () => {
  it("runs every existing gate once and waits before starting its successor", async () => {
    const events = [];
    await runAll(async (lane) => {
      events.push(`start:${lane}`);
      await Promise.resolve();
      events.push(`finish:${lane}`);
    });
    const gates = [
      "check",
      "test",
      "build",
      "publint",
      "packages:pack",
      "build-storybook",
      "test:storybook",
      "spec:check",
    ];
    expect(aggregateLanes).toEqual(gates);
    expect(events).toEqual(
      gates.flatMap((lane) => [`start:${lane}`, `finish:${lane}`]),
    );
  });

  it("propagates the original failure and never starts later gates", async () => {
    const failure = Error("a gate failed");
    const execute = vi.fn(async (lane) => {
      if (lane === "test") throw failure;
    });
    await expect(runAll(execute)).rejects.toBe(failure);
    expect(execute.mock.calls.map(([lane]) => lane)).toEqual(["check", "test"]);
  });

  it("refuses aggregate selectors before executing any gate", async () => {
    const execute = vi.fn();
    await expect(runAll(execute, ["--shard=1/3"])).rejects.toThrow(
      "accepts no selectors",
    );
    expect(execute).not.toHaveBeenCalled();
  });

  it("admits the aggregate once through the outer Docker dispatch", async () => {
    const execute = vi.fn();
    const native = vi.fn();
    const nestedDocker = vi.fn();
    const lanes = Object.fromEntries(
      aggregateLanes.map((lane) => [lane, lane]),
    );
    const docker = vi.fn(async () => {
      await runAll(async (lane) => {
        const invocation = nativeInvocation(lanes, lane, [], "/worker", {});
        await dispatch(
          validationConfig({}, invocation.env),
          () => execute(lane),
          nestedDocker,
        );
      });
    });
    await dispatch(validationConfig({}, {}), native, docker);
    expect(docker).toHaveBeenCalledTimes(1);
    expect(native).not.toHaveBeenCalled();
    expect(nestedDocker).not.toHaveBeenCalled();
    expect(execute).toHaveBeenCalledTimes(aggregateLanes.length);
  });
});
