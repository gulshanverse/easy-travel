# Notification & Communication Platform (P-1.3)

Provider-independent communication layer for Easy Trip. Owns the full path
from an intent to notify a traveller through routing, rendering, delivery,
retries and the in-app inbox.

## Entry point

```ts
import { createNotificationRuntime, SECURITY_BRIDGE_TEMPLATES } from "@/lib/notification";

const ncp = createNotificationRuntime({
  ports: { persistence, identity, workflow, audit, eventStore, outbox },
  adapters: [inAppAdapter, emailAdapter, pushAdapter, smsAdapter],
  templates: SECURITY_BRIDGE_TEMPLATES,
});
await ncp.bootstrap();               // persists a version row per template
await ncp.notify({ ... });           // create → route → render → deliver
await ncp.dispatchDue();             // scheduler pass
```

`NotificationRuntime` is the only sanctioned import surface outside the
package; everything is re-exported from `@/lib/notification`.

## Modules

| Module | Responsibility |
| --- | --- |
| `types.ts` | Immutable domain models (frozen) |
| `config.ts` | Config + production hardening gates |
| `collections.ts` | P-1.1 collection names (`ncp_*`) |
| `ports.ts` | Persistence / Identity / Workflow / Agent / Studio contracts |
| `stores.ts` | Persistence-backed collection stores |
| `lifecycle.ts` | Notification and delivery state machines |
| `security.ts` | Sanitisation, HTML escaping, PII masking, redaction |
| `templates.ts` / `catalog.ts` | Registry, locale fallback, built-in copy |
| `versioning.ts` | Immutable template version rows + fingerprints |
| `routing.ts` | Deterministic preference / quiet-hours / digest routing |
| `subscriptions.ts` | Topic opt-outs and one-click unsubscribe tokens |
| `dedupe.ts` | Dedupe, idempotency, rate limiting |
| `retry.ts` | Exponential backoff with deterministic jitter |
| `channels.ts` / `providers.ts` | Adapter registry + deterministic mocks |
| `inbox.ts` | In-app inbox, digests, dead-letter queue |
| `manager.ts` / `runtime.ts` | Orchestration and facade |
| `bridges.ts` | Identity / IAM / Workflow adapters (structural only) |

## Guarantees

- **Deterministic** — same inputs produce the same routing decision, dedupe
  key and render fingerprint.
- **Immutable** — every model is frozen; updates return new objects.
- **Persistent** — no authoritative in-memory state; everything lives in P-1.1.
- **Safe** — security and account notifications can never be unsubscribed;
  PII is masked in events, audits and logs.
- **Observable** — metrics, an event log and telemetry spans for every stage.

## ADRs

ADR-025 provider independence · ADR-026 deterministic routing ·
ADR-027 reliability · ADR-028 ports-only integration.

## Verification

`tests/notification/runtime.test.ts` (13), `integration.test.ts` (10),
`stress.test.ts` (5) — delivery, dedupe, idempotency, quiet hours, retries,
rate limiting, subscriptions, template versioning, bridges, security,
concurrency bursts and sustained load.
