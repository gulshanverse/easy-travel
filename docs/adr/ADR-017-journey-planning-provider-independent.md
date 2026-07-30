# ADR-017: Journey planning remains provider-independent

Status: Accepted (Sprint I-017)

## Context

Journey Intelligence, Travel Decision Intelligence, Goal, Trust and Journey
Studio all need travel data. The tempting shortcut is to let a planning engine
import a connector or provider directly for "just this one call". That shortcut
would make planning quality depend on a specific vendor and would break the
frozen engine boundaries established in ADR-002 and ADR-008.

## Decision

Planning engines never import MTIP internals, connectors or providers. They
reach travel data only through:

```
Agent Runtime / Journey engines
        ↓ (capability id, never a provider id)
      CTOR
        ↓
      IPCF
        ↓
  MTIP connectors → providers (mock only today)
```

MTIP publishes its capabilities to CTOR through a **structural contract source**
(`multiModalContractSource()` in `src/lib/multimodal/ctor.ts`) so that MTIP does
not import CTOR either. Presentation models in
`src/lib/multimodal/presentation.ts` are plain immutable data with no UI,
framework or engine dependency.

## Alternatives considered

1. **Direct provider injection into planning engines.** Simple, but binds
   planning to vendors and makes replay non-deterministic. Rejected.
2. **A shared "travel data" singleton imported everywhere.** Hides the
   dependency graph and creates cycles. Rejected.
3. **Duplicate normalized models inside each planning engine.** Guarantees drift.
   Rejected.

## Consequences

- Provider swaps are invisible to planning and presentation.
- Architecture fitness tests can assert the absence of provider and engine
  imports mechanically.
- Aggregate capabilities (e.g. `travel_summary`) are composed inside MTIP from
  other MTIP capabilities, never by a planning engine reaching sideways.
