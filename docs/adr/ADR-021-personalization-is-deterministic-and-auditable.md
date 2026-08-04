# ADR-021 — Personalization is deterministic and auditable

Status: Accepted (Sprint I-018)

## Context
Personalization that varies run-to-run cannot be tested, replayed or
explained to a user, and silently erodes trust.

## Decision
The personalization engine is a pure function of its inputs: identical
identity state always yields identical signals, the same ordering and the
same fingerprint (FNV-1a over the canonical signal set). Every signal carries
its source, weight and reason, and privacy settings gate signal production
before any signal is emitted.

## Consequences
- Personalization output is snapshot-testable and replayable.
- Every signal can be explained back to the preference that produced it.
- No randomness, wall-clock reads or hidden state inside signal derivation.
