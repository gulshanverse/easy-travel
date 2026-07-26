# ADR-011: Railway connectors use provider-independent contracts

**Status:** Accepted — Sprint I-015

## Context
Railway data is served by many operators with incompatible payloads. If any
domain engine learned a provider's vocabulary, swapping or adding operators
would ripple through the platform.

## Decision
Railway capabilities are defined once as provider-independent contracts
(`RAILWAY_CONTRACTS`) and every provider response is normalized into shared
immutable models (`NormalizedTrain`, `NormalizedStation`, …) before leaving
the suite. Execution always flows
`Agent → CTOR → IPCF → Railway Connector → adapter`; adapters are reachable
only from the IPCF executor hook (ADR-008).

## Consequences
- No domain engine can know which provider served a request.
- Adding an operator means adding an adapter plus normalization, nothing else.
- Contracts are the stable unit of versioning, not provider APIs.
