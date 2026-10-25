import { describe, expect, it, vi } from "vitest";
import {
  assertNoFatalStorybookRuntimeWarning,
  installFatalStorybookRuntimeWarningGuard,
} from "./storybook-runtime-warnings.mjs";

describe("fatal Storybook runtime diagnostics", () => {
  it.each(["warn", "error"])(
    "retains %s diagnostics without interrupting teardown",
    (method) => {
      const target = { warn: vi.fn(), error: vi.fn() };
      const original = target[method];
      const guard = installFatalStorybookRuntimeWarningGuard(target);
      let cleanupFinished = false;
      expect(() => {
        target[method]("[svelte] derived_inert");
        cleanupFinished = true;
      }).not.toThrow();
      expect(cleanupFinished).toBe(true);
      expect(original).toHaveBeenCalledWith("[svelte] derived_inert");
      expect(() => guard.assertClean()).toThrow("derived_inert");
      expect(() => guard.assertClean()).not.toThrow();
      guard.dispose();
    },
  );

  it("forwards ordinary diagnostics and restores its own wrappers", () => {
    const warn = vi.fn(),
      error = vi.fn();
    const target = { warn, error };
    const guard = installFatalStorybookRuntimeWarningGuard(target);
    target.warn("ordinary warning", 42);
    target.error("ordinary error");
    expect(warn).toHaveBeenCalledWith("ordinary warning", 42);
    expect(error).toHaveBeenCalledWith("ordinary error");
    expect(() => guard.assertClean()).not.toThrow();
    guard.dispose();
    expect(target.warn).toBe(warn);
    expect(target.error).toBe(error);
  });

  it("retains a deep origin while restoring the caller's stack limit", () => {
    const target = { warn: vi.fn(), error: vi.fn() };
    const guard = installFatalStorybookRuntimeWarningGuard(target);
    const previousLimit = Error.stackTraceLimit;
    function descend(depth) {
      if (depth) return descend(depth - 1);
      target.warn("[svelte] derived_inert");
    }
    function diagnosticOrigin() {
      descend(20);
    }
    try {
      Error.stackTraceLimit = 3;
      diagnosticOrigin();
      expect(Error.stackTraceLimit).toBe(3);
      expect(() => guard.assertClean()).toThrow("diagnosticOrigin");
    } finally {
      Error.stackTraceLimit = previousLimit;
      guard.dispose();
    }
  });

  it("recognizes error stacks and formatted Svelte diagnostic URLs", () => {
    expect(() =>
      assertNoFatalStorybookRuntimeWarning([
        new Error("https://svelte.dev/e/derived_inert"),
      ]),
    ).toThrow("derived_inert");
    expect(() =>
      assertNoFatalStorybookRuntimeWarning([
        "%c[svelte] %cderived_inert",
        "color: red",
        "",
      ]),
    ).toThrow("derived_inert");
  });

  it("does not replace a newer console wrapper on disposal", () => {
    const target = { warn: vi.fn(), error: vi.fn() };
    const guard = installFatalStorybookRuntimeWarningGuard(target);
    const newerWarn = vi.fn(),
      newerError = vi.fn();
    target.warn = newerWarn;
    target.error = newerError;
    guard.dispose();
    expect(target.warn).toBe(newerWarn);
    expect(target.error).toBe(newerError);
  });
});
