import { describe, expect, test } from "vitest";
import {
  shouldHandleNotebookSectionKeydown,
  shouldIgnoreNotebookSectionClick,
} from "../notebook-cell-interaction";

function createTarget(interactiveAncestor: unknown = null) {
  return {
    closest: () => interactiveAncestor,
  };
}

describe("notebook cell interaction helpers", () => {
  test("ignores clicks from embedded interactive descendants", () => {
    const currentTarget = createTarget();
    const interactiveTarget = createTarget({ role: "slider" });

    expect(
      shouldIgnoreNotebookSectionClick(
        interactiveTarget as unknown as EventTarget,
        currentTarget as unknown as EventTarget,
      ),
    ).toBe(true);
  });

  test("allows clicks on non-interactive notebook content to select the cell", () => {
    const currentTarget = createTarget();
    const textTarget = createTarget(null);

    expect(
      shouldIgnoreNotebookSectionClick(
        textTarget as unknown as EventTarget,
        currentTarget as unknown as EventTarget,
      ),
    ).toBe(false);
  });

  test("handles section keydown only when the section itself is focused", () => {
    const currentTarget = { id: "section" } as unknown as EventTarget;
    const nestedTarget = { id: "editor" } as unknown as EventTarget;

    expect(
      shouldHandleNotebookSectionKeydown(currentTarget, currentTarget),
    ).toBe(true);
    expect(
      shouldHandleNotebookSectionKeydown(nestedTarget, currentTarget),
    ).toBe(false);
  });
});
