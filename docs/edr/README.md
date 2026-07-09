# Engineering Decision Records (EDR)

Permanent log of engineering decisions. Governed by `docs/DOCUMENTATION_HUB.md` §7.

## Index

Project-wide EDRs:

_None recorded here yet. Spec-local EDRs live inside their owning EDS document — currently:_

- **EDS-001 Memory Engine** — inline EDRs in §H8 (10 records covering pgvector, transactional outbox, RLS, etc.).
- **EDS-002 Prompt Orchestration Engine** — inline EDRs in §16 (12 records covering typed fragments, PromptIR, canonical stage ordering, repair limits, fingerprinting, etc.).

Future cross-cutting engineering decisions will be recorded here as `EDR-NNNN-title.md`.

## Template

```
# EDR-NNNN: <Title>

- Status: Proposed | Accepted | Superseded | Retired
- Date: YYYY-MM-DD
- Owner: <engineering team>
- Related: ADR-NNNN, EDS-NNN

## Context
Engineering trigger.

## Decision
Chosen approach.

## Alternatives
Options considered.

## Performance Impact
Latency, throughput, cost.

## Operational Impact
Observability, on-call, runbooks.

## Security Impact
Attack surface, blast radius, mitigations.

## Migration Impact
Data / API / behavioural migration required.

## Rollback Strategy
Concrete steps to revert.
```

## Rules

- Numbering is monotonic (`EDR-0001`, `EDR-0002`, …); numbers are never reused.
- EDRs are immutable once Accepted; changes create a new EDR that supersedes the previous.
- Spec-local EDRs (inside an EDS document) use short IDs (`EDR-01`, `EDR-02`) scoped to that document.
