import { expect, test } from "vitest";
import { privatePackageImports } from "./check-npm-package.mjs";

test("detects unpublished runtime, re-export and declaration imports", () => {
  expect(
    privatePackageImports(`
    import { value } from "@lapis-notes/notebook-core";
    export { helper } from "@lapis-notes/notebook-stdlib/helpers";
    type Worker = import("@lapis-notes/notebook-worker").Worker;
  `),
  ).toEqual([
    "@lapis-notes/notebook-core",
    "@lapis-notes/notebook-stdlib/helpers",
    "@lapis-notes/notebook-worker",
  ]);
});

test("allows public dependencies, relative chunks and inert example text", () => {
  expect(
    privatePackageImports(`
    import { Plugin } from "@lapis-notes/api";
    export { helper } from "./chunk.js";
    const example = 'import value from "@lapis-notes/notebook-core"';
    // import value from "@lapis-notes/notebook-worker";
  `),
  ).toEqual([]);
});
