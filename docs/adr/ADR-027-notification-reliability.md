# ADR-027: Delivery reliability — dedupe, retry, dead-letter

**Status:** Accepted — Phase P-1.3

## Context

Transports fail transiently, callers retry, and workflows can fire the same
alert repeatedly. Duplicate or lost travel alerts both erode trust.

## Decision

- **Idempotency:** an `idempotencyKey` returns the original notification.
- **Deduplication:** `dedupeKeyFor(userId, type, variables)` collapses identical
  payloads inside `dedupeWindowMs`.
- **Rate limiting:** fixed windows per user and per channel; `critical`
  priority bypasses.
- **Retry:** exponential backoff with deterministic jitter derived from the
  delivery id — no `Math.random()`, so replays are reproducible. Only
  `transient`, `throttled` and `provider_error` failures are retried.
- **Dead-letter:** once attempts are exhausted the delivery moves to
  `dead_lettered` and is written to the DLQ; `replayDeadLetter()` re-enqueues.

Notification and delivery state transitions are validated by `lifecycle.ts`;
illegal transitions throw rather than silently mutate.

## Consequences

- At-most-once user-visible delivery, at-least-once attempt semantics.
- Every failure is observable through metrics, events and the DLQ.
