# Notebook Worker Package Spec

Canonical rendered spec: [Notebook Worker Package](../../../spec/src/20-packages/notebook-worker/index.md).

## Purpose

`@lapis-notes/notebook-worker` owns shared notebook worker transport contracts that can be reused by browser/PWA and future host-specific notebook runtimes.

## Current Functionality

- Exposes stable notebook worker channel names.
- Exposes generic command, command-response, progress, host-request, host-response, incoming, and outgoing message contracts.
- Exposes `NotebookWorkerCommandBroker` for main-thread worker command id creation, pending promise tracking, command context lookup, and rejection of outstanding worker commands.
- Exposes `NotebookWorkerShell` for worker-side message dispatch, host-response settlement, execute-command success/error response wrapping, and progress message posting.
- Exposes `NotebookWorkerHostRequestBroker` for worker-side host request id creation, pending promise tracking, host response settlement, and rejection of outstanding host requests.
- Exposes `NotebookWorkerHostRequestResponder` for main-thread host request success/error response wrapping and transfer-list selection.
- Exposes `shouldUseNotebookWorkerRuntime()` and `hasUnsupportedNotebookWorkerRuntimeDependency()` for host-neutral worker eligibility policy based on worker availability, DuckDB usage, live browser DOM requirements, injected loaders, host-only providers, and resolver serializability.
- Keeps protocol contracts generic so product runtimes can bind their own document, execution result, cell state, and progress event types.

## Boundary Rules

The current package does not contain a worker entrypoint, notebook execution implementation, app host bridge, TypeScript runtime, DuckDB runtime, DOM runtime, or product-plugin model imports. `NotebookWorkerCommandBroker`, `NotebookWorkerShell`, `NotebookWorkerHostRequestBroker`, and `NotebookWorkerHostRequestResponder` only own generic request/response promise plumbing, response envelopes, transfer-list selection, and worker-side transport dispatch; product runtimes still own request semantics, response application, concrete progress semantics, and host adapters. The worker policy helper owns the pure eligibility decision only; `@lapis-notes/notebook` owns runtime feature analysis, the concrete worker entry, worker URL import, fallback execution, and notebook execution implementation.
