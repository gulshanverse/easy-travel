# ADR-008: All external systems integrate through IPCF

**Status:** Accepted — Sprint I-014

## Context
Prior to the Integration Platform & Connector Framework, any engine could in
principle reach an outside service directly. That would scatter authentication,
retries, rate limits, and failure semantics across the platform.

## Decision
Every outbound interaction with an external system MUST pass through the
Integration Platform & Connector Framework (`@/lib/integration`). No other
module may perform network I/O on behalf of a travel capability.

Call path: `Runtime Kernel → Agent Runtime → CTOR → IPCF → connector executor`.

## Consequences
- One place owns rate limiting, retries, circuit breaking, and normalization.
- Domain engines never import transport concerns.
- IPCF itself ships no transport: the executor hook is a deterministic stub;
  real transport is injected by the host at composition time.
