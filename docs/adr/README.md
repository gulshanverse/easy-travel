# Architecture Decision Records (ADR)

Permanent log of architectural decisions. Governed by `docs/DOCUMENTATION_HUB.md` §6.

## Index

_No project-wide ADRs recorded yet. Architectural decisions to date are embedded in JIP v1.0–v1.3 and in the subsystem specs. Future architecture-level decisions will be logged here as `ADR-NNNN-title.md`._

## Template

```
# ADR-NNNN: <Title>

- Status: Proposed | Accepted | Superseded by ADR-XXXX | Deprecated
- Date: YYYY-MM-DD
- Owner: <team>
- Related Documents: <links>

## Context
Why this decision is needed.

## Decision
The choice made.

## Alternatives
Options considered.

## Trade-offs
Explicit gains and losses.

## Consequences
Impact on architecture, teams, roadmap.
```

## Rules

- Numbering is monotonic (`ADR-0001`, `ADR-0002`, …); numbers are never reused.
- ADRs are immutable once Accepted; changes create a new ADR that supersedes the previous.
- Every ADR links to at least one document in the Hub index.
