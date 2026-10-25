import { describe, expect, test } from "vitest";
import {
  normalizeNotebookFrontmatter,
  resolveNotebookAutoRunPreference,
} from "../notebook-frontmatter";

describe("notebook-frontmatter", () => {
  test("normalizes optional autorun booleans", () => {
    expect(normalizeNotebookFrontmatter({ version: 1, autorun: true })).toEqual(
      {
        version: 1,
        mode: "lazy",
        autorun: true,
        mounts: {},
      },
    );
    expect(
      normalizeNotebookFrontmatter({ version: 1, autorun: "false" }),
    ).toEqual({
      version: 1,
      mode: "lazy",
      autorun: false,
      mounts: {},
    });
  });

  test("falls back to the global autorun preference when note frontmatter omits it", () => {
    expect(resolveNotebookAutoRunPreference(null, true)).toBe(true);
    expect(
      resolveNotebookAutoRunPreference(
        { version: 1, mode: "lazy", mounts: {} },
        false,
      ),
    ).toBe(false);
    expect(
      resolveNotebookAutoRunPreference(
        { version: 1, mode: "lazy", autorun: true, mounts: {} },
        false,
      ),
    ).toBe(true);
  });
});
