import { transformObservableViewof } from "@lapis-notes/notebook-input";
import { describe, expect, test } from "vitest";
import { analyzeTsCell } from "../analysis/analyze-ts-cell";

describe("transformObservableViewof", () => {
  test("exposes plain view variables to notebook dependency analysis", () => {
    const analysis = analyzeTsCell(
      [
        "const regions = ['North', 'South'];",
        "const region = view(Inputs.select(regions, { value: regions[0] }));",
        "lapis.markdown(region);",
      ].join("\n"),
    );

    expect(analysis.defs).toContain("regions");
    expect(analysis.defs).toContain("region");
    expect(analysis.refs).not.toContain("Inputs");
    expect(analysis.refs).not.toContain("view");
  });

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

  test("does not treat plain view as a free identifier after rewriting", () => {
    const analysis = analyzeTsCell(
      [
        "const regions = ['North', 'South'];",
        "const region = view(Inputs.select(regions, { value: regions[0] }));",
        "lapis.markdown(region);",
      ].join("\n"),
    );

    expect(analysis.defs).toContain("regions");
    expect(analysis.defs).toContain("region");
    expect(analysis.refs).not.toContain("Inputs");
    expect(analysis.refs).not.toContain("view");
  });
});
