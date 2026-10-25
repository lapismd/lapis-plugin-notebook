import { describe, expect, test } from "vitest";
import {
  hasUnsupportedNotebookWorkerRuntimeDependency,
  shouldUseNotebookWorkerRuntime,
} from "..";

describe("notebook worker runtime policy", () => {
  test("allows workers only when execution features are worker-safe", () => {
    expect(
      shouldUseNotebookWorkerRuntime({
        workerAvailable: true,
        usesDuckDb: false,
        requiresDom: false,
        requiresLiveDom: false,
      }),
    ).toBe(true);

    expect(
      shouldUseNotebookWorkerRuntime({
        workerAvailable: false,
        usesDuckDb: false,
        requiresDom: false,
        requiresLiveDom: false,
      }),
    ).toBe(false);
    expect(
      shouldUseNotebookWorkerRuntime({
        workerAvailable: true,
        usesDuckDb: true,
        requiresDom: false,
        requiresLiveDom: false,
      }),
    ).toBe(false);
    expect(
      shouldUseNotebookWorkerRuntime({
        workerAvailable: true,
        usesDuckDb: false,
        requiresDom: true,
        requiresLiveDom: false,
      }),
    ).toBe(true);
    expect(
      shouldUseNotebookWorkerRuntime({
        workerAvailable: true,
        usesDuckDb: false,
        requiresDom: true,
        requiresLiveDom: true,
      }),
    ).toBe(false);
    expect(
      shouldUseNotebookWorkerRuntime({
        workerAvailable: true,
        usesDuckDb: false,
        requiresDom: false,
        requiresLiveDom: false,
        hasRuntimeDependencyLoader: true,
      }),
    ).toBe(false);
    expect(
      shouldUseNotebookWorkerRuntime({
        workerAvailable: true,
        usesDuckDb: false,
        requiresDom: false,
        requiresLiveDom: false,
        hasUnsupportedRuntimeDependency: true,
      }),
    ).toBe(false);
    expect(
      shouldUseNotebookWorkerRuntime({
        workerAvailable: true,
        usesDuckDb: false,
        requiresDom: false,
        requiresLiveDom: false,
        hasHostOnlyProvider: true,
      }),
    ).toBe(false);
  });

  test("treats only remote ESM dependencies as worker-serializable", () => {
    expect(hasUnsupportedNotebookWorkerRuntimeDependency(undefined)).toBe(
      false,
    );
    expect(
      hasUnsupportedNotebookWorkerRuntimeDependency([
        { resolver: { kind: "remote-esm" } },
      ]),
    ).toBe(false);
    expect(
      hasUnsupportedNotebookWorkerRuntimeDependency([
        { resolver: { kind: "host" } },
      ]),
    ).toBe(true);
  });
});
