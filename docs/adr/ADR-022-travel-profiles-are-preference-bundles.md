# ADR-022 — Travel Profiles are reusable preference bundles

Status: Accepted (Sprint I-018)

## Context
Users travel in different modes (business, backpacking, family). Encoding these
as ad-hoc flags spreads travel semantics across engines.

## Decision
A Travel Profile is an immutable, reusable bundle of weighted, confidence-scored
preferences. Built-in profiles are read-only templates; a user adopts a template
to obtain an owned, editable copy. Multiple active profiles flatten
deterministically into one bundle.

## Consequences
- Profiles carry preferences only — never options, prices or bookings.
- Editing a built-in profile is rejected; adoption is required.
- Profile bundles enter resolution as `inherited` sources.
