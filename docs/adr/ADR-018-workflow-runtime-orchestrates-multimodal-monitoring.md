# ADR-018: Workflow Runtime orchestrates multimodal monitoring

Status: Accepted (Sprint I-017)

## Context

Multi-modal travel introduces long-running observation tasks: flight status
polling, weather watches, hotel price tracking, transit monitoring, airport
delay reaction, reminders and replanning. These outlive a single request, need
retries, checkpoints and replay, and must never be driven by ad-hoc timers
inside a connector suite.

## Decision

All long-running multimodal work is owned by the Workflow Runtime (WAR),
consistent with ADR-013 and ADR-014. MTIP contributes **workflow blueprints
only** — pure immutable data in `src/lib/multimodal/workflows.ts` whose steps
reference CTOR capability ids (`multimodal.*`). Execution path:

```
Workflow Runtime → CTOR → IPCF → MTIP connector → mock provider
```

MTIP owns no scheduler, no timer, no retry loop and no polling code. Seven
blueprints ship: flight monitoring, weather monitoring, hotel price monitoring,
transit monitoring, airport delay monitoring, travel reminder and travel
replanning.

## Alternatives considered

1. **A polling loop inside each mode runtime.** Duplicates WAR, loses
   checkpointing and replay, and makes tests time-dependent. Rejected.
2. **Registering workflows by importing WAR from MTIP.** Creates an engine
   import that violates ADR-002 boundaries. Rejected; blueprints are structural
   data that WAR adapts.
3. **Provider-side subscriptions/webhooks.** Requires network and real
   providers, both out of scope for this sprint. Rejected.

## Consequences

- Monitoring behaviour is deterministic and replayable through WAR history.
- Blueprints are inert until an integrator registers them with WAR, keeping MTIP
  side-effect free at import time.
- Adding a monitored signal means adding a blueprint, not new runtime machinery.
