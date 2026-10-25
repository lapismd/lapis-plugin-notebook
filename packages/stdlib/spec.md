# Notebook Stdlib Package Spec

Canonical rendered spec: [Notebook Stdlib Package](../../../spec/src/20-packages/notebook-stdlib/index.md).

## Purpose

`@lapis-notes/notebook-stdlib` owns reusable notebook standard-library contracts that are independent of the product plugin, host APIs, Svelte rendering, DuckDB-Wasm service ownership, and worker transport.

## Current Functionality

- Defines the canonical `lapis` global name and current Lapis-owned builtin member names, including vault-backed `vault` and `FileAttachment` helpers plus bundled `md`, `tex`, `d3`, `Plot`, `DOM`, `Generators`, and `Promises` helpers.
- Provides the pure `lapis` output helper implementations for typed text, markdown, HTML, DOM, input, table, chart, image, and error outputs.
- Defines documented bare convenience globals currently exposed by notebooks: `Inputs`, `html`, `svg`, `md`, `tex`, `d3`, `Plot`, `DOM`, `Generators`, and `Promises`.
- Validates future user dependency global names against JavaScript identifier syntax, reserved Lapis names, documented bare globals, and duplicate configured globals.
- Defines host-neutral user dependency descriptors with pinned package versions, optional explicit globals, resolver metadata, package-name-derived default globals, whole-registry validation for missing versions, reserved globals, and duplicate globals, plus shared runtime dependency resolution helpers for referenced globals.
- Provides source-level runtime feature detection for current stdlib-backed DOM, live browser DOM, DuckDB, d3, and Plot references so the product plugin can choose worker versus in-process execution without owning those builtin-name rules locally.
- Provides host-neutral notebook file helpers for notebook-relative path normalization, vault runtime adapters backed by host file readers, and vault-backed `FileAttachment` implementations including DSV table loaders for CSV and TSV data.
- Provides the raw host-neutral DOM helper loader for `htl`, which notebook-input combines with its own `Inputs` namespace during DOM-backed notebook execution.
- Provides host-neutral `DOM` helper implementations for `canvas`, `context2d`, `download`, and `uid`, patterned after the Observable stdlib namespace.
- Provides host-neutral `Promises` and `Generators` helper implementations patterned after Observable stdlib namespaces.
- Provides a host-neutral stdlib bootstrap so JavaScript-like notebook execution can inject `lapis.md`, `lapis.tex`, `lapis.d3`, `lapis.Plot`, `lapis.DOM`, `lapis.Generators`, `lapis.Promises`, and the documented bare `md`/`tex`/`d3`/`Plot`/`DOM`/`Generators`/`Promises` globals from one shared implementation.

## Boundary Rules

The package must remain host-neutral. It should not import `@lapis-notes/api`, Svelte, DuckDB-Wasm, htl, workers, remote ESM resolvers, or product-plugin modules. Runtime implementations for DOM controls, DuckDB queries, and user dependency loading remain in the product plugin, while host-neutral file helper implementations, stdlib helper namespaces, and bundled-helper bootstrap may live here so notebook-callable helper behavior stays centralized.
