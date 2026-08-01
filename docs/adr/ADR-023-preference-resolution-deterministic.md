# ADR-023 — Preference resolution is deterministic and explainable

Status: Accepted (Sprint I-018)

## Context
Preferences arrive from several sources and can conflict or be unavailable.

## Decision
A single Preference Resolution Engine resolves each key using a fixed ordering
(source authority → effective confidence → recency → value), then a declared
fallback ladder, then an engine default. Every resolution returns its candidate
chain, detected conflicts and a human-readable explanation.

## Consequences
- Identical inputs always yield identical resolutions and explanations.
- Unsatisfied keys are reported rather than silently guessed.
- Resolution never selects or ranks travel options.
