# ADR-024 — Explicit preferences are never silently overwritten

Status: Accepted (Sprint I-018)

## Context
Observed, learned and recommended signals can appear more confident than a
value the user actually chose.

## Decision
Every preference carries a source (`explicit`, `inherited`, `observed`,
`learned`, `recommended`), a confidence in [0,1], a timestamp and a reason.
When merging, an explicit preference is only replaced by another explicit
preference. Non-explicit sources may only refine other non-explicit sources.

## Consequences
- User intent always wins over inference.
- Confidence is scaled by source authority when ranking candidates.
- Every resolved value is auditable back to its source and reason.
