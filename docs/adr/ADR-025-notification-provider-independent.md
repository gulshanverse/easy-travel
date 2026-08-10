# ADR-025: Notification Platform is provider-independent

**Status:** Accepted — Phase P-1.3

## Context

Easy Trip must reach travellers through in-app, email, push and SMS. Every
transport vendor (SES, Twilio, FCM, APNs, …) has a different payload, error
taxonomy and delivery guarantee. Embedding any of them in domain logic would
make the notification path untestable and vendor-locked.

## Decision

The Notification & Communication Platform (NCP) defines its own normalized
domain: `Notification`, `Delivery`, `RenderedMessage`, `DeadLetter`,
`InAppItem`, `DigestBucket`. Channels are reached only through the
`ChannelAdapter` contract in `channels.ts`. Mock adapters are first-class and
deterministic; production adapters are registered at runtime bootstrap.

No file under `src/lib/notification/` may import a vendor SDK, an HTTP client,
or another subsystem directly. Cross-subsystem access is via `ports.ts` only.

## Consequences

- Providers are swappable with zero domain change.
- The whole platform is testable without network access.
- Provider-specific retry semantics must be normalized into `FailureKind`.
