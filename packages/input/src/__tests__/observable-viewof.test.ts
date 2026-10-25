import { describe, expect, test } from "vitest";
import { transformObservableViewof } from "../observable-viewof";

describe("notebook view transform", () => {
  test("transforms top-level plain view declarations into lapis.view calls", () => {
    const result = transformObservableViewof(
      [
        "const gain = view(Inputs.range([0, 10], {",
        "  value: 5,",
        "  step: 1,",
        "}));",
        "lapis.markdown(String(gain));",
      ].join("\n"),
    );

    expect(result.viewDefs).toEqual(["gain"]);
    expect(result.requiresDom).toBe(true);
    expect(result.code).toContain(
      'const gain = await lapis.view("gain", (Inputs.range([0, 10], {',
    );
    expect(result.code).toContain("lapis.markdown(String(gain));");
  });

  test("does not rewrite plain function calls that are not declarations", () => {
    const result = transformObservableViewof(
      [
        "const widget = render(view(Inputs.range([0, 10], { value: 5 })));",
        "lapis.markdown(String(widget));",
      ].join("\n"),
    );

    expect(result.viewDefs).toEqual([]);
    expect(result.requiresDom).toBe(false);
    expect(result.code).toContain(
      "const widget = render(view(Inputs.range([0, 10], { value: 5 })));",
    );
  });
});
