# ADR-026: Routing is deterministic; explicit preferences win

**Status:** Accepted — Phase P-1.3

## Context

A notification may be requested by an agent, a workflow, IAM or the product.
Recipients control channels, categories, quiet hours and frequency through the
frozen Identity Platform. NCP also owns delivery-level unsubscribes produced by
one-click unsubscribe links.

## Decision

`route()` is a pure function of `(preferences, category, priority, requested
channels, enabled channels, available channels, local hour)`. Precedence:

1. Duplicate suppression (dedupe window).
2. Delivery subscription opt-out (`unsubscribed`) — never applies to
   `security` or `account`.
3. Rate limiting — bypassed only by `critical` priority.
4. Preference routing: category disabled, channel disabled, frequency `never`,
   quiet hours (falls back to in-app), marketing consent withdrawn.

Quiet hours are evaluated in the recipient's timezone. Digest frequencies open
a bucket instead of dispatching. Identical inputs always produce identical
decisions and identical dedupe keys (FNV-1a).

## Consequences

- Suppression is always explainable via a `SuppressionReason`.
- Security-critical messages are never silently dropped.
- Routing can be replayed and asserted in tests without any I/O.
