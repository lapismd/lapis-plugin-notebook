import { describe, expect, test, vi } from "vitest";
import {
  registerNotebookVaultFile,
  resolveNotebookVaultPath,
  type NotebookVaultFileRegistrar,
} from "..";

describe("notebook vault file registration", () => {
  test("resolves notebook-relative vault paths", () => {
    expect(
      resolveNotebookVaultPath("/Data/sales.csv", "Notes/Report.notebook.md"),
    ).toBe("Data/sales.csv");
    expect(
      resolveNotebookVaultPath(
        "./assets/sales.csv",
        "Notes/Report.notebook.md",
      ),
    ).toBe("Notes/assets/sales.csv");
    expect(
      resolveNotebookVaultPath(
        "../Data/sales.csv",
        "Notes/Reports/Report.notebook.md",
      ),
    ).toBe("Notes/Data/sales.csv");
    expect(resolveNotebookVaultPath("Data/./sales.csv")).toBe("Data/sales.csv");
  });

  test("reads the resolved path and registers the buffer", async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const readVaultFile = vi.fn(async () => bytes);
    const service = {
      registerFileBuffer: vi.fn(async () => {}),
    } satisfies NotebookVaultFileRegistrar;

    await registerNotebookVaultFile(
      service,
      readVaultFile,
      "sales_csv",
      "./assets/sales.csv",
      "Notes/Report.notebook.md",
    );

    expect(readVaultFile).toHaveBeenCalledWith(
      "Notes/assets/sales.csv",
      "Notes/Report.notebook.md",
    );
    expect(service.registerFileBuffer).toHaveBeenCalledWith("sales_csv", bytes);
  });

  test("uses native vault-file registration when available", async () => {
    const readVaultFile = vi.fn(async () => new ArrayBuffer(0));
    const service = {
      registerFileBuffer: vi.fn(async () => {}),
      registerVaultFile: vi.fn(async () => {}),
    } satisfies NotebookVaultFileRegistrar;

    await registerNotebookVaultFile(
      service,
      readVaultFile,
      "sales_csv",
      "./assets/sales.csv",
      "Notes/Report.notebook.md",
    );

    expect(readVaultFile).not.toHaveBeenCalled();
    expect(service.registerFileBuffer).not.toHaveBeenCalled();
    expect(service.registerVaultFile).toHaveBeenCalledWith(
      "sales_csv",
      "Notes/assets/sales.csv",
      "Notes/Report.notebook.md",
    );
  });
});
