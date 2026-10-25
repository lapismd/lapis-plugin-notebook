import { describe, expect, test, vi } from "vitest";
import { loadNotebookStdlibDomRuntime } from "../dom";

const { htmlSpy, svgSpy } = vi.hoisted(() => ({
  htmlSpy: vi.fn(),
  svgSpy: vi.fn(),
}));

vi.mock("htl", () => ({
  html: htmlSpy,
  svg: svgSpy,
}));

describe("notebook stdlib dom runtime", () => {
  test("loads the raw Inputs/html/svg surface", async () => {
    const scaleSpy = vi.fn();
    const createElement = vi.fn((tagName: string) => {
      if (tagName === "canvas") {
        return {
          width: 0,
          height: 0,
          style: {},
          getContext: vi.fn(() => ({ scale: scaleSpy })),
        };
      }
      if (tagName === "button") {
        return {
          textContent: "",
          disabled: false,
        };
      }
      return {
        download: "",
        href: "",
        onclick: null,
        appendChild(child: unknown) {
          return child;
        },
        removeAttribute: vi.fn(),
      };
    });
    vi.stubGlobal("document", {
      createElement,
    });
    vi.stubGlobal("location", {
      href: "https://example.com/notebook",
    });

    const runtime = await loadNotebookStdlibDomRuntime();

    expect(runtime.html).toBe(htmlSpy);
    expect(runtime.svg).toBe(svgSpy);
    expect(runtime.DOM.canvas(12, 18)).toMatchObject({ width: 12, height: 18 });

    const context = runtime.DOM.context2d(10, 20, 2);
    expect(context.scale).toBe(scaleSpy);
    expect(scaleSpy).toHaveBeenCalledWith(2, 2);

    const anchor = runtime.DOM.download(
      new Blob(["ready"]),
      "demo.txt",
      "Save",
    );
    expect(anchor.download).toBe("demo.txt");

    const marker = runtime.DOM.uid("plot");
    expect(marker.id).toMatch(/^O-plot-\d+$/);
    expect(marker.href).toContain(`#${marker.id}`);
  });
});
