# Notebook Core Package Spec

Canonical rendered spec: [Notebook Core Package](../../../spec/src/20-packages/notebook-core/index.md).

## Purpose

`@lapis-notes/notebook-core` owns reusable notebook contracts that should not depend on the bundled product plugin, Svelte views, DuckDB-Wasm, workers, or `@lapis-notes/api`.

## Current Functionality

- Exports the notebook output protocol, including text, markdown, HTML, structured input, DOM, table, chart, image, and error output types.
- Exports notebook cell, document, block, and frontmatter model contracts through the `./model` subpath.
- Exports notebook session state, run-state, checkpoint, setup-phase, and progress-event contracts through the `./session` subpath.
- Exports notebook runtime feature flags through the `./runtime-features` subpath, including the distinction between broad DOM-related helpers and live browser DOM requirements used by worker policy and runtime routing.
- Exports generic notebook execution result/options contracts, including a typed runtime dependency loader hook, a host-neutral notebook file reader provider contract, and a JavaScript-like compile provider contract for TypeScript/ESM rewriting hosts.
- Exports generic notebook graph types and pure graph helpers through the `./graph` subpath, including graph construction from analyzed cells, dependency closure, stale descendant collection, duplicate-definition detection, topological order, and cycle detection.
- Exports pure language-service projection helpers through the `./language-service` subpath for building virtual TypeScript documents from TypeScript cells and mapping provider positions/ranges back to cell-local positions.
- Provides compatibility for `@lapis-notes/notebook` to re-export the same output protocol while the rest of the runtime is still extracted incrementally.

## Tests And Follow-Up

The package owns focused tests for generic graph helpers, model contracts, session contracts, runtime feature flags, and execution contract typing.
