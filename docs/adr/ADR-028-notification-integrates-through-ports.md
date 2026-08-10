# ADR-028: NCP integrates only through ports

**Status:** Accepted — Phase P-1.3

## Context

NCP must react to IAM security events, be driven by workflows and agents,
surface cards in Journey Studio, and persist through the Production
Persistence Platform (P-1.1) — without coupling to any of them.

## Decision

`src/lib/notification/ports.ts` declares the only integration surface:
`NotificationPersistencePort`, `NotificationAuditPort`,
`NotificationEventStorePort`, `NotificationOutboxPort`,
`NotificationIdentityPort`, `NotificationWorkflowPort`,
`NotificationAgentPort`, `NotificationStudioPort`.

`src/lib/notification/bridges.ts` supplies adapters built from *structural*
shapes only — `IdentityNotificationSettingsLike`, `IamEventLike` — so no
subsystem is imported at compile time:

- `identityPortFromIdentity()` maps frozen Identity settings to preferences.
- `bridgeIamSecurityEvents()` maps IAM security events (`AccountLocked`,
  `PasswordChanged`, `TokenReuseDetected`, …) to critical/high security
  notifications with deterministic idempotency keys.
- `workflowSignalBridge()` emits workflow signals for terminal outcomes.

All notification state lives in P-1.1 collections (`ncp_*`). NCP holds no
authoritative in-memory state; template versions and subscriptions are
persisted like every other aggregate.

## Consequences

- NCP can be unit-tested with in-memory persistence and no other subsystem.
- Identity, IAM, Workflow and Studio remain frozen and unaware of NCP.
- Adding an integration means adding a port and a bridge, never an import.
