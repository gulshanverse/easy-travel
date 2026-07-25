# ADR-010: Connector contracts isolate provider-specific implementations

**Status:** Accepted — Sprint I-014

## Context
Each external service has its own auth scheme, pagination, error codes and rate
limit semantics. Those differences must not leak into callers.

## Decision
A connector is described by an immutable `ConnectorContract` + `ConnectorManifest`
(category, capabilities, supported authentication kinds, version, dependencies).
Provider-specific behaviour is confined to three injected seams:

1. `PipelineHooks.executors` — transport for one connector id.
2. `PipelineHooks.requestTransformers` / `responseTransformers` — wire mapping.
3. `AuthenticationRegistry` hooks — credential application and refresh.

Every response leaves the pipeline as a `NormalizedResponse` with uniform
metadata, pagination, rate-limit and diagnostics shapes.

## Consequences
- Callers program against one response shape regardless of supplier.
- Connectors are versioned and capability-validated before invocation.
- IPCF never stores secret values — only opaque `ConnectorCredentialReference`s.
