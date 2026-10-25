import { describe, expect, test, vi } from "vitest";
import { NotebookRuntimeRegistry } from "../notebook-runtime-registry";

describe("NotebookRuntimeRegistry", () => {
  test("reuses runtimes per notebook path and isolates different notebooks", async () => {
    const createRuntime = vi.fn(async () => ({
      terminate: vi.fn(async () => undefined),
    }));
    const registry = new NotebookRuntimeRegistry(createRuntime);

    const firstA = await registry.get("A.notebook.md");
    const secondA = await registry.get("A.notebook.md");
    const firstB = await registry.get("B.notebook.md");

    expect(firstA).toBe(secondA);
    expect(firstA).not.toBe(firstB);
    expect(createRuntime).toHaveBeenCalledTimes(2);
  });

  test("terminates only the targeted notebook runtime", async () => {
    const terminateA = vi.fn(async () => undefined);
    const terminateB = vi.fn(async () => undefined);
    const createRuntime = vi
      .fn<() => Promise<{ terminate: () => Promise<void> }>>()
      .mockResolvedValueOnce({ terminate: terminateA })
      .mockResolvedValueOnce({ terminate: terminateB });
    const registry = new NotebookRuntimeRegistry(createRuntime);

    await registry.get("A.notebook.md");
    await registry.get("B.notebook.md");
    await registry.terminate("A.notebook.md");

    expect(terminateA).toHaveBeenCalledTimes(1);
    expect(terminateB).not.toHaveBeenCalled();

    await registry.terminateAll();

    expect(terminateB).toHaveBeenCalledTimes(1);
  });
});
